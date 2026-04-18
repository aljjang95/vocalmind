"""리듬 분석 API 요청/응답 스키마."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class BeatGridPayload(BaseModel):
    """클라이언트에서 전달하는 박자 그리드 정보."""
    bpm: float
    first_beat_offset_sec: float
    beat_times: list[float]
    source: Literal["manual", "ai", "none"] = "none"


class SectionBoundary(BaseModel):
    """구간 경계 — 섹션별 분석용."""
    start_sec: float
    end_sec: float
    label: str


class RhythmAnalyzeRequest(BaseModel):
    """리듬 분석 요청 (Form 필드로 직렬화되어 전달)."""
    beat_grid: BeatGridPayload
    output_latency_ms: int = 0
    sections: list[SectionBoundary] = []


class RhythmEventResponse(BaseModel):
    """단일 리듬 이벤트 응답."""
    onset_time_sec: float | None
    target_beat_time_sec: float | None
    error_ms: float | None
    classification: Literal["perfect", "good", "off", "miss", "ghost"]
    section_index: int


class SectionScoreResponse(BaseModel):
    """섹션별 점수 응답."""
    section_index: int
    label: str
    score: int
    event_count: int


class RhythmAnalyzeResponse(BaseModel):
    """리듬 분석 전체 응답."""
    rhythm_score: int
    events: list[RhythmEventResponse]
    section_scores: list[SectionScoreResponse]
    problem_segments: list[SectionScoreResponse]
    coverage_ratio: float


class BeatEstimateResponse(BaseModel):
    """자동 BPM + 비트 격자 추정 응답."""
    bpm: float
    first_beat_offset_sec: float
    beat_times: list[float]
    confidence: float
    source: Literal["ai", "none"]
