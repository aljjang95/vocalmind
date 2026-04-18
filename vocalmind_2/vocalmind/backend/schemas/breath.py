"""호흡 분석 API 요청/응답 스키마."""
from __future__ import annotations

from pydantic import BaseModel


class BreathCycleResponse(BaseModel):
    inhale_start_sec: float
    inhale_end_sec: float
    exhale_end_sec: float
    inhale_duration_sec: float
    exhale_duration_sec: float
    exhale_stability: float


class BreathAnalyzeResponse(BaseModel):
    cycles: list[BreathCycleResponse]
    avg_inhale_sec: float
    avg_exhale_sec: float
    consistency_score: int
    sustain_score: int
    stability_score: int
    overall_score: int
    duration_sec: float
    weakness: str
