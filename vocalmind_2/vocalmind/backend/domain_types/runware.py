"""Runware 관련 도메인 타입 — RunwareTask, TierSpec, Kind."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

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


@dataclass(frozen=True)
class RunwareTask:
    """Runware task 응답."""
    task_id: str
    status: Literal["pending", "processing", "success", "failed"]
    result_url: str | None
    error: str | None
    raw: dict[str, Any]

    @property
    def cost_usd(self) -> float:
        cost = self.raw.get("cost")
        try:
            return float(cost) if cost is not None else 0.0
        except (TypeError, ValueError):
            return 0.0


class RunwareError(Exception):
    """Runware API 호출 실패."""
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        task_id: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.task_id = task_id
