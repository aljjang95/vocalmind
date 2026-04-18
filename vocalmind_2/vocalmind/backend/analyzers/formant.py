"""포먼트 분석기 — F1/F2 평균/표준편차, VSA (혀뿌리/턱 긴장 지표)."""
from __future__ import annotations
import math
import numpy as np
import parselmouth
from parselmouth.praat import call
from models.tension import FormantData


def measure_formants(snd: parselmouth.Sound) -> FormantData:
    """F1/F2 평균·표준편차 + VSA(모음공간 넓이)를 측정한다.

    - F1↑ + F2↓ → 혀뿌리 긴장
    - VSA 축소 → 턱 긴장
    """
    formant_obj = call(snd, "To Formant (burg)", 0.0, 5, 5500, 0.025, 50)
    n_frames = call(formant_obj, "Get number of frames")

    f1_vals: list[float] = []
    f2_vals: list[float] = []

    for i in range(1, n_frames + 1):
        t = call(formant_obj, "Get time from frame number", i)
        v1 = call(formant_obj, "Get value at time", 1, t, "Hertz", "Linear")
        v2 = call(formant_obj, "Get value at time", 2, t, "Hertz", "Linear")
        if v1 == v1 and not math.isinf(v1) and v1 > 0:
            f1_vals.append(v1)
        if v2 == v2 and not math.isinf(v2) and v2 > 0:
            f2_vals.append(v2)

    f1_arr = np.array(f1_vals) if f1_vals else np.array([0.0])
    f2_arr = np.array(f2_vals) if f2_vals else np.array([0.0])

    f1_mean = float(np.mean(f1_arr))
    f2_mean = float(np.mean(f2_arr))
    f1_std = float(np.std(f1_arr))
    f2_std = float(np.std(f2_arr))

    vsa = float(f1_mean * f2_mean) if f1_mean > 0 and f2_mean > 0 else 0.0

    return FormantData(
        f1_mean=f1_mean,
        f2_mean=f2_mean,
        f1_std=f1_std,
        f2_std=f2_std,
        vsa=vsa,
    )
