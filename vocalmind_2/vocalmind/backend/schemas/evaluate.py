"""평가 API 요청/응답 스키마."""
from __future__ import annotations
from pydantic import BaseModel


class TensionDetail(BaseModel):
    detected: bool
    detail: str


class EvaluateResponse(BaseModel):
    score: int
    pitch_accuracy: int
    tone_stability: float
    tension_detected: bool
    tension: TensionDetail
    feedback: str
    passed: bool


class ScalePracticeResponse(BaseModel):
    score: int
    passed: bool
    level: str
    feedback_hint: str
    tension_overall: float
    pitch_accuracy: int
    tone_stability: float
