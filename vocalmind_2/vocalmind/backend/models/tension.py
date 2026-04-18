"""긴장 분석 데이터 모델."""
from __future__ import annotations
from pydantic import BaseModel, Field

class VoiceQuality(BaseModel):
    jitter_local: float = Field(description="Local jitter (%)")
    shimmer_local: float = Field(description="Local shimmer (%)")
    hnr: float = Field(description="Harmonics-to-Noise Ratio (dB)")
    h1_h2: float = Field(description="H1-H2 에너지 차이 (dB)")

class FormantData(BaseModel):
    f1_mean: float = Field(description="F1 평균 (Hz)")
    f2_mean: float = Field(description="F2 평균 (Hz)")
    f1_std: float = Field(description="F1 표준편차")
    f2_std: float = Field(description="F2 표준편차")
    vsa: float = Field(description="Vowel Space Area")

class RegisterTransition(BaseModel):
    transition_detected: bool = Field(description="전환 구간 감지 여부")
    f0_max_jump_hz: float = Field(description="최대 F0 점프 크기 (Hz)")
    hnr_min_at_transition: float = Field(description="전환 구간 최소 HNR (dB)")
    voiceless_gaps: int = Field(description="무성 구간(10ms+) 개수")
    smoothness_score: float = Field(description="전환 매끄러움 (0=끊김, 1=매끄러움)")

class TensionAnalysis(BaseModel):
    voice_quality: VoiceQuality
    formant: FormantData
    register_transition: RegisterTransition
    duration: float

class TensionScore(BaseModel):
    overall: float = Field(ge=0, le=100)
    laryngeal_tension: float = Field(ge=0, le=100)
    tongue_root_tension: float = Field(ge=0, le=100)
    jaw_tension: float = Field(ge=0, le=100)
    register_break: float = Field(ge=0, le=100)
    tension_detected: bool = Field(description="overall > 40")
    detail: str = Field(default="")
