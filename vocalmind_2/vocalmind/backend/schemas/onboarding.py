"""온보딩 API 요청/응답 스키마."""
from __future__ import annotations
from pydantic import BaseModel


class OnboardingTensionResponse(BaseModel):
    overall: float
    laryngeal: float
    tongue_root: float
    jaw: float
    register_break: float
    detail: str


class ConsultationResponse(BaseModel):
    problems: list[str]
    roadmap: list[str]
    suggested_stage_id: int
    summary: str


class OnboardingAnalyzeResponse(BaseModel):
    tension: OnboardingTensionResponse
    consultation: ConsultationResponse


class TTSRequest(BaseModel):
    text: str
