"""Scene 도메인 타입 — scene_plan JSONB 구조."""
from __future__ import annotations

from typing import Literal, TypedDict

SceneAssetKind = Literal["image", "video", "lipsync"]


class Scene(TypedDict, total=False):
    """씬 한 조각. studio_jobs.scene_plan.scenes[i] 구조.

    모든 필드 optional — orchestrator가 단계별로 채운다.
    """
    id: str
    prompt: str
    duration_sec: float
    imageUrl: str
    videoUrl: str
    image_url: str
    video_url: str
    image_cost_usd: float
    video_cost_usd: float
    image_model: str
    video_model: str
    error: str


class ScenePlan(TypedDict, total=False):
    """studio_jobs.scene_plan JSONB 래퍼."""
    scenes: list[Scene]
    total_duration_sec: float
