"""Studio 도메인 타입 — JobStatus, StudioJob, StylePreset, AvatarMode.

순수 타입만 포함. httpx/os/Supabase 참조 금지.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

JobStatus = Literal[
    "pending",
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "scene_planning", "scene_image_gen", "scene_video_gen",
    "lipsync", "composing", "formatting", "watermarking",
    "finalizing", "completed", "failed", "refunded",
]

StylePreset = Literal["cinematic", "cozy", "retro", "ghibli", "neon_city", "fantasy"]
AvatarMode = Literal["user_photo", "ai_realistic", "ai_anime", "faceless"]
QualityTier = Literal["draft", "pro", "studio"]


TERMINAL_STATUSES: frozenset[str] = frozenset({"completed", "failed", "refunded"})

CANCELLABLE_STATUSES: frozenset[str] = frozenset({
    "pending", "vocal_separating", "vocal_rvc", "vocal_mixing", "scene_planning",
})

ACTIVE_STATUSES: frozenset[str] = frozenset({
    "pending", "vocal_separating", "vocal_rvc", "vocal_mixing",
    "scene_planning", "scene_image_gen", "scene_video_gen",
    "lipsync", "composing", "formatting", "watermarking", "finalizing",
})


@dataclass(frozen=True)
class StudioJob:
    """studio_jobs 한 행. raw dict는 `from_row`로 변환."""
    id: str
    user_id: str
    status: JobStatus
    cost_credits: int
    attempt_count: int
    max_attempts: int
    style_preset: StylePreset
    quality_tier: QualityTier
    avatar_mode: AvatarMode
    raw: dict[str, Any]

    @classmethod
    def from_row(cls, row: dict) -> "StudioJob":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            status=row["status"],
            cost_credits=int(row.get("cost_credits") or 0),
            attempt_count=int(row.get("attempt_count") or 0),
            max_attempts=int(row.get("max_attempts") or 3),
            style_preset=row.get("style_preset") or "cinematic",
            quality_tier=row.get("quality_tier") or "pro",
            avatar_mode=row.get("avatar_mode") or "faceless",
            raw=row,
        )

    def get(self, key: str, default: Any = None) -> Any:
        return self.raw.get(key, default)


@dataclass(frozen=True)
class CreateJobSpec:
    """신규 job 생성 요청 — BFF/FastAPI 공용."""
    user_id: str
    user_mr_path: str
    raw_recording_path: str
    style_preset: StylePreset
    quality_tier: QualityTier
    avatar_mode: AvatarMode
    voice_identity_id: str | None = None
    avatar_ref_path: str | None = None
    title: str | None = None
