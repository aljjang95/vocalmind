"""긴장 분석 도메인 서브패키지 — parselmouth 4축 측정.

구성:
- voice_quality: Jitter/Shimmer/HNR/H1-H2 (후두)
- formant: F1/F2/VSA (혀뿌리·턱)
- register: F0 점프/smoothness (성구전환)
- utils: safe(), load_audio()

엔트리 포인트는 analyze_tension() 하나.
"""
from __future__ import annotations
import parselmouth
from models.tension import TensionAnalysis
from analyzers.utils import load_audio
from analyzers.voice_quality import measure_voice_quality
from analyzers.formant import measure_formants
from analyzers.register import analyze_register_transition


def analyze_tension(audio_path: str) -> TensionAnalysis:
    """오디오 파일을 4축 측정하여 통합 TensionAnalysis를 반환한다."""
    audio, sr = load_audio(audio_path)
    snd = parselmouth.Sound(audio, sampling_frequency=sr)
    return TensionAnalysis(
        voice_quality=measure_voice_quality(snd),
        formant=measure_formants(snd),
        register_transition=analyze_register_transition(snd),
        duration=len(audio) / sr,
    )


__all__ = ["analyze_tension"]
