"""공용 유틸 — NaN/Inf 가드 + 오디오 로드 (parselmouth 분석 전처리)."""
from __future__ import annotations
import math
import numpy as np
import soundfile as sf


def safe(val: float, default: float = 0.0) -> float:
    """NaN/Inf를 default로 치환 (parselmouth 실패 값 방어)."""
    if val != val or math.isinf(val):
        return default
    return val


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """WAV 로드 — soundfile 사용 (librosa 금지: Windows parselmouth 데드락)."""
    data, sr = sf.read(path, dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr
