"""오디션 AI 채점 API 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class AuditionScoreRequest(BaseModel):
    tension_overall: float
    pitch_accuracy: int
    rhythm_score: int | None = None
    vote_score: int = 0
    alpha: float = 0.3


class AuditionScoreResponse(BaseModel):
    ai_score: int
    tension_score: int
    pitch_accuracy: int
    rhythm_score: int | None
    vote_score: int
    final_score: int
    alpha: float
    status: Literal["complete", "partial", "failed"]
