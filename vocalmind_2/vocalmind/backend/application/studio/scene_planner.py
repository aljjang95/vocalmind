"""Scene planner — Claude Haiku 호출 + 스타일 앵커 + 폴백 프롬프트.

core.studio.scene_plan에서 pick_scene_count/normalize_scenes를 가져다 쓴다.
Claude 호출은 infra.anthropic_client. 폴백 프롬프트는 여기 상주(곡 무드 데이터).
"""
from __future__ import annotations

import logging
import uuid

import infra.anthropic_client as ai
from core.studio import scene_plan as core_scene
from infra import runware_catalog as cat

logger = logging.getLogger(__name__)

StylePreset = cat.StylePreset

SCENE_SYSTEM = """당신은 뮤직비디오 씬 디자이너입니다.

## 역할
곡의 분위기와 선택된 스타일 프리셋에 맞춰 4~6개의 비주얼 씬을 설계합니다.
각 씬은 10~15초 길이의 짧은 영상 클립이 되며, FLUX/HunyuanVideo로 생성됩니다.

## 규칙
1. 사람 얼굴이 명확히 드러나지 않도록 합니다 (립싱크는 별도 단계에서 추가).
2. NSFW, 미성년자, 유명인 묘사 금지.
3. 저작권 있는 캐릭터·로고 언급 금지.
4. 프롬프트는 영어로 작성 (FLUX 품질 최적화).
5. 각 씬은 내러티브적으로 연결 가능하되 개별로도 완결성 있게.

## 스타일 프리셋별 톤
- cinematic: 영화적 조명, anamorphic lens flare, 컬러 그레이딩, 깊은 쉐도우
- cozy: 따뜻한 골든아워, 홈 인테리어, 담요와 촛불, 소프트 포커스
- retro: 레트로 사이버펑크, synth-wave, 네온 조명, 빈티지 감성
- ghibli: 지브리풍 수채화 애니메이션, 부드러운 파스텔, 노스탤직한 전원 풍경
- neon_city: 사이버펑크 야경, 비 내리는 아스팔트, 네온 반사, 홀로그램
- fantasy: 초현실 풍경, 꿈결 같은 안개, 유영하는 꽃잎, 마법의 빛

## 출력 형식
반드시 JSON만 반환하세요:
{
  "scenes": [
    {"prompt": "...", "duration_sec": 12},
    {"prompt": "...", "duration_sec": 10}
  ]
}
"""


_FALLBACK_PROMPTS: dict[str, list[str]] = {
    "cinematic": [
        "wide establishing shot of an empty vintage theater at dawn, a single warm tungsten spotlight cutting through dust motes, heavy velvet curtains parted",
        "extreme close-up of a vinyl record spinning on a vintage turntable, amber desk lamp behind, soft dust particles catching the light",
        "silhouette of a faceless figure standing alone at the end of a rain-soaked alley, single distant neon sign throwing long reflections on wet cobblestones",
        "slow-motion shot of silk ribbons drifting through a shaft of golden afternoon light inside a cathedral-like empty warehouse",
        "overhead tracking shot of hands playing a grand piano, candlelit keys, soft orange glow, rose petals scattered across the black lacquer surface",
        "closing wide shot of a lone streetlamp at dawn, fog clearing, first rays of sun breaking over distant rooftops, quiet empty boulevard",
    ],
    "cozy": [
        "warm living room window seat at golden hour, woolen cream blanket draped over a wooden rocking chair, steaming ceramic mug on the oak sill",
        "extreme close-up of a hand gently turning the pages of an open hardcover book on a worn linen sofa, amber reading lamp spilling soft light",
        "top-down flatlay of a handwritten journal, vintage fountain pen, fresh espresso in a heavy ceramic cup, small bouquet of eucalyptus on rough linen fabric",
        "candlelit reading nook framed by tall wooden bookshelves, beeswax candle flickering, soft cashmere throw pillow, thick dog-eared novel",
        "quiet kitchen window at dusk, herbs in terracotta pots on the sill, warm pendant light above, distant glow of a wood-fired stove",
        "gentle snow falling past a frosted cottage window, firewood stacked neatly inside, knitted scarf folded on a wooden bench",
    ],
    "retro": [
        "synthwave sunset over a retro-futuristic city grid, chrome sports car parked on an empty highway, pink and purple gradient sky with geometric sun",
        "close-up of a glowing vintage jukebox in a dimly lit 1980s diner, neon tube signs reflected in chrome surfaces, checkerboard tile floor",
        "faceless figure in a leather jacket walking through a rain-soaked alley, flickering neon signs in Japanese and Korean, puddles reflecting teal and magenta",
        "top-down view of a vintage cassette tape on a glass table, purple neon light bleeding through venetian blinds, scattered polaroid photos",
        "wide shot of a retro arcade room at midnight, rows of glowing CRT monitors, pixelated reflections on the floor, a single empty stool bathed in blue light",
        "close-up of a rotating vinyl record under laser beam lighting, prismatic light spectrum across smoke, vintage turntable with chrome arm",
    ],
    "ghibli": [
        "hand-painted countryside path winding through golden rice paddies at sunset, a small wooden bridge over a gentle stream, cotton-candy clouds",
        "cozy forest clearing with oversized mushrooms and soft moss, fireflies beginning to glow at dusk, a small lantern hanging from a twisted branch",
        "wide view of a hilltop meadow with wildflowers swaying in the breeze, a distant European-style town with red rooftops, cumulus clouds",
        "interior of a cluttered but warm attic workshop, sunlight streaming through a round window, floating dust motes, dried herbs hanging from wooden beams",
        "a wooden pier extending into a calm mountain lake at dawn, mist rising from the water surface, distant snow-capped peaks in soft lavender",
        "rain falling gently on a cobblestone village street, paper lanterns glowing softly under eaves, reflections in shallow puddles",
    ],
    "neon_city": [
        "cyberpunk rooftop helipad at midnight overlooking a dense megacity, colossal animated holographic billboards in pink and cyan",
        "close-up of raindrops cascading down a floor-to-ceiling apartment window, out-of-focus neon signs of a Tokyo-inspired back alley glowing beyond",
        "empty subway platform washed in violet and cyan LED light, motion-blurred train arriving with lens flares, wet platform edge reflecting every color",
        "low-angle shot of a rain-soaked intersection, towering skyscrapers with scrolling Japanese kanji holograms, taxi headlights streaking through the frame",
        "futuristic ramen bar under a red paper lantern, steam rising from a bowl, faceless silhouette at the counter, analog neon reflections on polished wood",
        "quiet rooftop garden among megacity skyscrapers at 3am, bonsai trees and lanterns, soft rain, distant flying billboards in deep magenta and electric blue",
    ],
    "fantasy": [
        "vast floating islands suspended in a pastel dawn sky, cascading waterfalls falling into mist below, flocks of ethereal white birds circling",
        "mystical forest clearing at twilight, hundreds of glowing fireflies, oversized luminescent mushrooms, soft magical rays piercing the dense canopy",
        "underwater dream scene with iridescent bioluminescent jellyfish drifting upward, beams of sunlight refracting through gentle currents",
        "endless field of swaying lavender at sunset, distant ancient stone arch covered in ivy, warm orange clouds streaked with lilac",
        "ancient library of floating candles in a vast stone hall, open spellbooks hovering mid-air, glowing runes in golden light",
        "dawn cloudscape viewed from above, golden spiraling light columns piercing the stratosphere, translucent silk ribbons drifting through the air",
    ],
}


def plan_scenes(
    style_preset: StylePreset,
    total_duration_sec: float,
    *,
    scene_count_hint: int | None = None,
    lyrics_excerpt: str | None = None,
) -> list[dict]:
    """씬 플랜 생성. LLM 실패 시 fallback."""
    target_count = scene_count_hint or core_scene.pick_scene_count(total_duration_sec)
    target_duration = max(10.0, total_duration_sec / target_count)

    user_prompt = (
        f"다음 조건으로 뮤직비디오 씬을 설계해주세요.\n\n"
        f"- 스타일 프리셋: {style_preset}\n"
        f"- 전체 영상 길이: {total_duration_sec:.0f}초\n"
        f"- 씬 개수: {target_count}개\n"
        f"- 씬당 목표 길이: 약 {target_duration:.0f}초\n"
    )
    if lyrics_excerpt:
        user_prompt += f"\n가사 일부 (영감용):\n{lyrics_excerpt[:300]}"

    parsed = ai.complete_json(
        SCENE_SYSTEM,
        [{"role": "user", "content": user_prompt}],
        required_keys=["scenes"],
    )
    if parsed and isinstance(parsed.get("scenes"), list):
        scenes = core_scene.normalize_scenes(parsed["scenes"])
        if scenes:
            for s in scenes:
                s["prompt"] = cat.apply_style(s["prompt"], style_preset)
            return scenes

    logger.warning("scene_planner fallback — style=%s", style_preset)
    return _fallback_scenes(style_preset, target_count, target_duration)


def _fallback_scenes(style_preset: str, count: int, duration_sec: float) -> list[dict]:
    prompts = _FALLBACK_PROMPTS.get(style_preset, _FALLBACK_PROMPTS["cinematic"])
    anchor_key = style_preset if style_preset in cat.STYLE_ANCHORS else "cinematic"
    return [
        {
            "id": uuid.uuid4().hex[:8],
            "prompt": cat.apply_style(prompts[i % len(prompts)], anchor_key),  # type: ignore[arg-type]
            "duration_sec": duration_sec,
        }
        for i in range(count)
    ]
