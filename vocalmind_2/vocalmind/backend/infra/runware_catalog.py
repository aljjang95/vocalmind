"""Runware 모델 카탈로그 + 품질 티어 × 스타일 매트릭스 (Phase 0+).

마스터 각인(feedback_vocalmind_bond_quality_first.md) 반영:
- 최고 품질을 겨냥하되 낭비 방지.
- 티어별 예산 상한(BUDGET_USD_BY_TIER)을 넘으면 orchestrator가 차단.
- 프리미엄 모델(Seedream 5.0, Kling 3.0 Pro)은 Studio 티어에만.

AIR 식별자는 Runware 공식 /docs/models 기준 (2026-04-18 확인).
신규 모델 추가 시 이 파일 한 곳만 수정.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

QualityTier = Literal["draft", "pro", "studio"]
StylePreset = Literal["cinematic", "cozy", "retro", "ghibli"]
Kind = Literal["image", "video", "lipsync"]


@dataclass(frozen=True)
class TierSpec:
    """티어별 생성 스펙."""
    credits: int
    price_krw: int
    duration_sec: float
    scene_count: int
    budget_usd: float
    image_model: str
    video_model: str
    lipsync_model: str
    image_resolution: tuple[int, int]
    video_resolution: tuple[int, int]

    def per_scene_duration(self) -> float:
        return round(self.duration_sec / max(1, self.scene_count), 2)


# ── 모델 AIR 식별자 (Runware 공식) ──────────────────────────────────
# 업데이트: 2026-04-18. 변경 시 통합 테스트 재실행 필수.
#
# ⚠️ FAILURES.md #3 검증 완료 (2026-04-18):
#   runware:100@1 = FLUX.1 Schnell  (4-step distilled, ultra-fast, 싸다)
#   runware:101@1 = FLUX.1 Dev      (high-quality, 느리다, 약 6배 비쌈)
# 출처: https://runware.ai/models/bfl-flux-1-schnell (Runware docs)
# 다른 프로젝트(크루즈자동)의 상수 이름은 과거 오명명으로 실제와 반대였으므로
# 절대 이름만 보고 복붙하지 말 것. AIR 문자열만 truth source.

MODEL_IMAGE_FLUX_SCHNELL     = "runware:100@1"  # FLUX.1 Schnell
MODEL_IMAGE_FLUX_DEV         = "runware:101@1"  # FLUX.1 Dev
MODEL_IMAGE_FLUX_KONTEXT_PRO = "bfl:flux-1-kontext-pro@1"
MODEL_IMAGE_SEEDREAM_4_5     = "bytedance:seedream@4.5"
MODEL_IMAGE_SEEDREAM_5_LITE  = "bytedance:seedream@5.0-lite"

# ── 모델별 픽셀 제약 (FAILURES.md #1 방지) ───────────────────────────
# Runware 공식 문서의 "Total pixels between X and Y" 값을 그대로 박제.
# 카탈로그 TIERS 작성 시 tier.image_resolution의 W*H가 이 범위에 들어야 함.
# 누락된 모델은 제약 없음으로 간주(FLUX 계열 등).
MODEL_MIN_PIXELS: dict[str, int] = {
    MODEL_IMAGE_SEEDREAM_4_5:    3_686_400,   # Runware docs 2026-04-18
    MODEL_IMAGE_SEEDREAM_5_LITE: 3_686_400,   # Runware docs 2026-04-18
}
MODEL_MAX_PIXELS: dict[str, int] = {
    MODEL_IMAGE_SEEDREAM_4_5:    16_777_216,
    MODEL_IMAGE_SEEDREAM_5_LITE: 10_404_496,
}

MODEL_VIDEO_WAN_2_2          = "alibaba:wan@2.2-a14b"
MODEL_VIDEO_WAN_2_7          = "alibaba:wan@2.7"
MODEL_VIDEO_KLING_2_6_PRO    = "klingai:kling-video@2.6-pro"
MODEL_VIDEO_KLING_3_0_PRO    = "klingai:kling-video@3-pro"

MODEL_LIPSYNC_LATENT         = "runware:latentsync@1"
MODEL_LIPSYNC_SYNC3          = "sync:sync-3@1"


# ── 티어 스펙 (가격·예산·모델 ID 한 번에) ─────────────────────────────
# 마스터 지시(2026-04-18): 품질 우선, 원가 역전 시 가격 상향 허용.
# draft는 체험용(유인), pro가 표준, studio가 프리미엄 포지셔닝.

TIERS: dict[QualityTier, TierSpec] = {
    "draft": TierSpec(
        credits=3,
        price_krw=3_000,
        duration_sec=15.0,
        scene_count=3,
        budget_usd=2.0,
        image_model=MODEL_IMAGE_FLUX_SCHNELL,
        video_model=MODEL_VIDEO_WAN_2_2,
        lipsync_model=MODEL_LIPSYNC_LATENT,
        image_resolution=(1024, 576),   # 16:9
        video_resolution=(1024, 576),
    ),
    "pro": TierSpec(
        credits=15,
        price_krw=15_000,
        duration_sec=30.0,
        scene_count=5,
        budget_usd=7.0,
        image_model=MODEL_IMAGE_SEEDREAM_4_5,
        video_model=MODEL_VIDEO_KLING_2_6_PRO,
        lipsync_model=MODEL_LIPSYNC_LATENT,
        image_resolution=(2560, 1440),  # QHD 16:9, 3.69M pixels — Seedream 4.5 하한 통과
        video_resolution=(1280, 720),
    ),
    "studio": TierSpec(
        credits=40,
        price_krw=40_000,
        duration_sec=60.0,
        scene_count=8,
        budget_usd=18.0,
        image_model=MODEL_IMAGE_SEEDREAM_5_LITE,
        video_model=MODEL_VIDEO_KLING_3_0_PRO,
        lipsync_model=MODEL_LIPSYNC_SYNC3,
        image_resolution=(2880, 1620),  # 3K 16:9, 4.67M pixels — Seedream 5.0 Lite 여유 통과
        video_resolution=(1920, 1080),
    ),
}


DEFAULT_TIER: QualityTier = "pro"


# ── 스타일 앵커 (이미지 프롬프트 후위에 붙는 꾸밈) ──────────────────
# scene_planner.py의 기존 anchor 체계와 동일 설계. 티어가 올라가도 스타일은 유지.

STYLE_ANCHORS: dict[StylePreset, str] = {
    "cinematic":
        "shot on ARRI Alexa 65, anamorphic lens, cinematic color grading, "
        "dramatic lighting, shallow depth of field, 35mm film grain",
    "cozy":
        "Kinfolk aesthetic, warm natural light, soft pastel palette, "
        "minimalist composition, lifestyle editorial photography",
    "retro":
        "Blade Runner 2049 neon, volumetric fog, teal-and-magenta palette, "
        "synth-wave cyberpunk atmosphere, rain reflection",
    "ghibli":
        "Studio Ghibli hand-painted anime aesthetic, soft watercolor textures, "
        "pastoral backgrounds, warm nostalgic tone, Hayao Miyazaki style",
}


# ── 조회 헬퍼 ───────────────────────────────────────────────────────

def select_model(kind: Kind, tier: QualityTier) -> str:
    """티어 + 종류에 따른 AIR 식별자. 존재하지 않는 조합은 ValueError."""
    spec = TIERS[tier]
    mapping: dict[Kind, str] = {
        "image":   spec.image_model,
        "video":   spec.video_model,
        "lipsync": spec.lipsync_model,
    }
    if kind not in mapping:
        raise ValueError(f"알 수 없는 kind: {kind!r}")
    return mapping[kind]


def style_anchor(style: StylePreset) -> str:
    """스타일 프리셋의 프롬프트 앵커."""
    return STYLE_ANCHORS[style]


def apply_style(prompt: str, style: StylePreset) -> str:
    """프롬프트 뒤에 스타일 앵커를 덧붙임. 이미 포함돼 있으면 그대로."""
    anchor = style_anchor(style)
    if anchor.split(",")[0].strip().lower() in prompt.lower():
        return prompt
    return f"{prompt}. {anchor}."


def tier_spec(tier: QualityTier) -> TierSpec:
    """티어 스펙 조회. 잘못된 티어면 KeyError — 호출자가 validate 책임."""
    return TIERS[tier]


def validate_tier(value: str) -> QualityTier:
    """외부 입력 → QualityTier 안전 변환. 실패 시 ValueError."""
    if value not in TIERS:
        raise ValueError(f"알 수 없는 quality_tier: {value!r}. 허용: {list(TIERS)}")
    return value  # type: ignore[return-value]


def validate_dimensions(model: str, width: int, height: int) -> None:
    """모델의 픽셀 제약을 클라이언트 측에서 사전 검증 (FAILURES.md #1).

    API에 400을 맞기 전에 ValueError로 빠르게 차단 — 실패 호출 = 무효 비용.
    MIN/MAX 테이블에 모델이 없으면 제약 없음으로 통과.
    """
    if width <= 0 or height <= 0:
        raise ValueError(f"width/height 양수여야 함: {width}x{height}")
    pixels = width * height
    min_req = MODEL_MIN_PIXELS.get(model)
    max_req = MODEL_MAX_PIXELS.get(model)
    if min_req is not None and pixels < min_req:
        raise ValueError(
            f"{model}: 최소 픽셀 {min_req:,} 요구, 현재 {pixels:,} "
            f"({width}x{height}) — 해상도 상향 필요"
        )
    if max_req is not None and pixels > max_req:
        raise ValueError(
            f"{model}: 최대 픽셀 {max_req:,} 초과, 현재 {pixels:,} "
            f"({width}x{height}) — 해상도 축소 필요"
        )
