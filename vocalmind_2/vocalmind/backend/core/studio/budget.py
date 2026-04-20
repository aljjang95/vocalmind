"""Studio 티어별 예산 할당/초과 판정 — 순수 함수.

scene_dispatcher의 이미지 20% / 비디오 80% 경험값을 여기로 이관.
"""
from __future__ import annotations

IMAGE_BUDGET_RATIO = 0.2
VIDEO_BUDGET_RATIO = 0.8


def image_budget(tier_budget_usd: float) -> float:
    return tier_budget_usd * IMAGE_BUDGET_RATIO


def video_budget(tier_budget_usd: float, spent_on_images: float) -> float:
    """이미지 실지출 후 남은 비디오 예산. 음수 방지."""
    return max(0.0, tier_budget_usd - spent_on_images)


def is_exceeded(total_spent_usd: float, budget_usd: float) -> bool:
    return total_spent_usd > budget_usd
