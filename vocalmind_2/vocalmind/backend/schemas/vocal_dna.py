"""보컬 DNA 분석 응답 스키마."""
from __future__ import annotations
from pydantic import BaseModel, Field


class VocalDnaResponse(BaseModel):
    laryngeal: float = Field(ge=0, le=100, description="후두 이완도 (높을수록 좋음)")
    tongue_root: float = Field(ge=0, le=100, description="혀뿌리 이완도")
    jaw: float = Field(ge=0, le=100, description="턱 이완도")
    register_break: float = Field(ge=0, le=100, description="성구전환 안정도")
    tone_stability: float = Field(ge=0, le=100, description="음색 안정도 (HNR 기반)")
    avg_pitch_hz: float | None = Field(default=None, description="평균 기본주파수 (Hz)")
    voice_type: str | None = Field(default=None, description="음역대 분류")
