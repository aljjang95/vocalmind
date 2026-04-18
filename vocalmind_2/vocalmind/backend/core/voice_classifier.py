"""음역대 분류 — vocal_dna 라우터에서 추출."""
from __future__ import annotations


def classify_voice_type(avg_pitch_hz: float) -> str | None:
    """피치 기반 음역대 분류.

    남성 범위 (< 330Hz):  < 165Hz 저음 / 165~330Hz 중음
    여성 범위 (>= 330Hz): 330~440Hz 중음 / >= 440Hz 고음
    """
    if avg_pitch_hz <= 0:
        return None
    if avg_pitch_hz < 165.0:
        return "남성 저음"
    if avg_pitch_hz < 330.0:
        return "남성 중음"
    if avg_pitch_hz < 440.0:
        return "여성 중음"
    return "여성 고음"
