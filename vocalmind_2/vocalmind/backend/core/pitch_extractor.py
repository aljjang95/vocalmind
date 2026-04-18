"""평균 피치(F0) 추출 — vocal_dna 라우터 + realtime_analyzer 중복 통합."""
from __future__ import annotations

import math
from pathlib import Path

import parselmouth
import soundfile as sf
from parselmouth.praat import call


def extract_avg_pitch(audio_path: str | Path) -> float:
    """parselmouth F0 평균 추출. 감지 불가 시 0.0 반환."""
    try:
        data, sr = sf.read(str(audio_path), dtype="float32", always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        snd = parselmouth.Sound(data, sampling_frequency=float(sr))
        pitch = call(snd, "To Pitch", 0.0, 75, 600)
        f0_mean = call(pitch, "Get mean", 0, 0, "Hertz")
        if f0_mean != f0_mean or math.isinf(f0_mean) or f0_mean <= 0:
            return 0.0
        return round(float(f0_mean), 1)
    except Exception:
        return 0.0
