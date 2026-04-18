"""Scene Planner — 곡 무드/스타일 → 4~6개 씬 프롬프트 생성.

Claude Haiku + cache_control로 비용 최소화 ($0.0005 per cover).

입력: style_preset, duration_sec (대략)
출력: [{id, prompt, duration_sec}, ...]
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Literal

import infra.anthropic_client as ai

logger = logging.getLogger(__name__)

StylePreset = Literal["cinematic", "cozy", "neon_city", "fantasy"]

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


def plan_scenes(
    style_preset: StylePreset,
    total_duration_sec: float,
    *,
    scene_count_hint: int | None = None,
    lyrics_excerpt: str | None = None,
) -> list[dict]:
    """씬 플랜 생성. 실패 시 fallback 4씬 반환."""
    target_count = scene_count_hint or _pick_scene_count(total_duration_sec)
    target_duration = max(10.0, total_duration_sec / target_count)

    user_prompt = f"""다음 조건으로 뮤직비디오 씬을 설계해주세요.

- 스타일 프리셋: {style_preset}
- 전체 영상 길이: {total_duration_sec:.0f}초
- 씬 개수: {target_count}개
- 씬당 목표 길이: 약 {target_duration:.0f}초
"""
    if lyrics_excerpt:
        user_prompt += f"\n가사 일부 (영감용):\n{lyrics_excerpt[:300]}"

    parsed = ai.complete_json(
        SCENE_SYSTEM,
        [{"role": "user", "content": user_prompt}],
        required_keys=["scenes"],
    )
    if parsed and isinstance(parsed.get("scenes"), list):
        scenes = _normalize_scenes(parsed["scenes"])
        if scenes:
            # LLM이 생성한 프롬프트에도 스타일 앵커 부착 — FLUX 일관성 보장
            for s in scenes:
                s["prompt"] = _apply_style_anchor(s["prompt"], style_preset)
            return scenes

    logger.warning("scene_planner fallback — style=%s", style_preset)
    return _fallback_scenes(style_preset, target_count, target_duration)


# ── 내부 헬퍼 ──────────────────────────────────────────────────────

def _pick_scene_count(duration_sec: float) -> int:
    """곡 길이에 따른 적정 씬 수. Phase 0은 4씬 기본."""
    if duration_sec < 60:
        return 3
    if duration_sec < 120:
        return 4
    if duration_sec < 200:
        return 5
    return 6


def _normalize_scenes(raw: list) -> list[dict]:
    """LLM 출력을 id+duration 정규화."""
    out: list[dict] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        prompt = s.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            continue
        duration = s.get("duration_sec", 12.0)
        try:
            duration = float(duration)
        except (TypeError, ValueError):
            duration = 12.0
        duration = max(6.0, min(20.0, duration))
        out.append({
            "id": uuid.uuid4().hex[:8],
            "prompt": prompt.strip(),
            "duration_sec": duration,
        })
    return out


# 각 스타일은 공통 "스타일 앵커" 토큰으로 i2i 일관성 유지.
# FLUX best practice: 영어 + 긴 문장 + 구체적 촬영 용어 + 텍스트/손 클로즈업 회피.
_STYLE_ANCHORS: dict[str, str] = {
    "cinematic":
        "cinematic film still, shot on ARRI Alexa 35mm, anamorphic 2.39:1 aspect ratio, "
        "deep shadows and controlled highlights, teal-and-orange color grade, subtle film grain, "
        "naturalistic volumetric lighting, shallow depth of field",
    "cozy":
        "warm interior photography, golden hour sunlight filtered through sheer curtains, "
        "Kinfolk magazine aesthetic, muted autumn palette of cream and terracotta, "
        "soft rim lighting, analog film look with gentle bokeh, 50mm lens",
    "neon_city":
        "cyberpunk night cinematography, wet reflective asphalt, holographic billboards in Japanese and English, "
        "neon magenta and cyan rim lighting, atmospheric haze and light rain, "
        "Blade Runner 2049 inspired composition, 35mm anamorphic lens flares",
    "fantasy":
        "ethereal dreamlike atmosphere, Studio Ghibli watercolor painterly quality, "
        "pastel sky with soft volumetric sunrays, floating translucent particles, "
        "enchanted natural landscape, ultra-wide painterly composition",
}

_FALLBACK_PROMPTS: dict[str, list[str]] = {
    "cinematic": [
        "wide establishing shot of an empty vintage theater at dawn, a single warm tungsten spotlight cutting through dust motes, heavy velvet curtains parted, rows of empty seats disappearing into deep shadow",
        "extreme close-up of a vinyl record spinning on a vintage turntable, amber desk lamp behind, soft dust particles catching the light, shallow focus on the needle arm",
        "silhouette of a faceless figure standing alone at the end of a rain-soaked alley, single distant neon sign throwing long reflections on wet cobblestones, atmospheric mist",
        "slow-motion shot of silk ribbons drifting through a shaft of golden afternoon light inside a cathedral-like empty warehouse, particles suspended in air",
        "overhead tracking shot of hands playing a grand piano, candlelit keys, soft orange glow, rose petals scattered across the black lacquer surface",
        "closing wide shot of a lone streetlamp at dawn, fog clearing, first rays of sun breaking over distant rooftops, quiet empty boulevard",
    ],
    "cozy": [
        "warm living room window seat at golden hour, woolen cream blanket draped over a wooden rocking chair, steaming ceramic mug on the oak sill, soft curtains gently moving",
        "extreme close-up of a hand gently turning the pages of an open hardcover book on a worn linen sofa, amber reading lamp spilling soft light, dried flowers in a vase",
        "top-down flatlay of a handwritten journal, vintage fountain pen, fresh espresso in a heavy ceramic cup, and a small bouquet of eucalyptus on rough linen fabric",
        "candlelit reading nook framed by tall wooden bookshelves, beeswax candle flickering, soft cashmere throw pillow, thick dog-eared novel open face down",
        "quiet kitchen window at dusk, herbs in terracotta pots on the sill, warm pendant light above, distant glow of a wood-fired stove reflecting on copper pots",
        "gentle snow falling past a frosted cottage window, firewood stacked neatly inside, knitted scarf folded on a wooden bench, muted winter afternoon light",
    ],
    "neon_city": [
        "cyberpunk rooftop helipad at midnight overlooking a dense megacity, colossal animated holographic billboards in pink and cyan rising from the skyline, atmospheric rain, distant air traffic",
        "close-up of raindrops cascading down a floor-to-ceiling apartment window, out-of-focus neon signs of a Tokyo-inspired back alley glowing beyond, purple-teal rim light",
        "empty subway platform washed in violet and cyan LED light, motion-blurred train arriving with lens flares, wet platform edge reflecting every color",
        "low-angle shot of a rain-soaked intersection, towering skyscrapers with scrolling Japanese kanji holograms, taxi headlights streaking through the frame",
        "futuristic ramen bar under a red paper lantern, steam rising from a bowl, faceless silhouette at the counter, analog neon reflections on the polished wood",
        "quiet rooftop garden among megacity skyscrapers at 3am, bonsai trees and lanterns, soft rain, distant flying billboards in deep magenta and electric blue",
    ],
    "fantasy": [
        "vast floating islands suspended in a pastel dawn sky, cascading waterfalls falling into mist below, flocks of ethereal white birds circling, drifting cherry petals",
        "mystical forest clearing at twilight, hundreds of glowing fireflies, oversized luminescent mushrooms, soft magical rays piercing the dense canopy, moss-covered stones",
        "underwater dream scene with iridescent bioluminescent jellyfish drifting upward, beams of sunlight refracting through gentle currents, silk seaweed swaying",
        "endless field of swaying lavender at sunset, distant ancient stone arch covered in ivy, warm orange clouds streaked with lilac, floating dandelion seeds",
        "ancient library of floating candles in a vast stone hall, open spellbooks hovering mid-air, glowing runes in golden light, soft blue volumetric mist",
        "dawn cloudscape viewed from above, golden spiraling light columns piercing the stratosphere, translucent silk ribbons drifting through the air in slow motion",
    ],
}


def _apply_style_anchor(prompt: str, style_preset: str) -> str:
    """본문 프롬프트 뒤에 스타일 앵커를 append하여 i2i 일관성 확보."""
    anchor = _STYLE_ANCHORS.get(style_preset)
    if not anchor:
        return prompt
    return f"{prompt}. {anchor}."


def _fallback_scenes(
    style_preset: str,
    count: int,
    duration_sec: float,
) -> list[dict]:
    prompts = _FALLBACK_PROMPTS.get(style_preset, _FALLBACK_PROMPTS["cinematic"])
    anchor_key = style_preset if style_preset in _STYLE_ANCHORS else "cinematic"
    return [
        {
            "id": uuid.uuid4().hex[:8],
            "prompt": _apply_style_anchor(prompts[i % len(prompts)], anchor_key),
            "duration_sec": duration_sec,
        }
        for i in range(count)
    ]
