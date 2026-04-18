"""Pydantic 스키마 패키지 — 요청/응답 모델 정의."""
from schemas.evaluate import EvaluateResponse, ScalePracticeResponse, TensionDetail
from schemas.onboarding import (
    ConsultationResponse,
    OnboardingAnalyzeResponse,
    OnboardingTensionResponse,
    TTSRequest,
)
from schemas.vocal_dna import VocalDnaResponse

__all__ = [
    "EvaluateResponse",
    "ScalePracticeResponse",
    "TensionDetail",
    "ConsultationResponse",
    "OnboardingAnalyzeResponse",
    "OnboardingTensionResponse",
    "TTSRequest",
    "VocalDnaResponse",
]
