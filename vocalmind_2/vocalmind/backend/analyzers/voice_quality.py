"""음질 분석기 — Jitter/Shimmer/HNR/H1-H2 (후두 긴장 지표)."""
from __future__ import annotations
import math
import parselmouth
from parselmouth.praat import call
from models.tension import VoiceQuality
from analyzers.utils import safe


def measure_voice_quality(snd: parselmouth.Sound) -> VoiceQuality:
    """Jitter, Shimmer, HNR, H1-H2를 측정한다."""
    point_process = call(snd, "To PointProcess (periodic, cc)", 75, 600)

    # Jitter (local) — 비율(0~1) 반환이면 *100
    jitter_raw = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
    jitter_raw = safe(jitter_raw, 0.0)
    jitter_pct = jitter_raw * 100 if jitter_raw < 1.0 else jitter_raw

    # Shimmer (local) — 비율(0~1) 반환이면 *100
    shimmer_raw = call([snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    shimmer_raw = safe(shimmer_raw, 0.0)
    shimmer_pct = shimmer_raw * 100 if shimmer_raw < 1.0 else shimmer_raw

    # HNR (Harmonics-to-Noise Ratio)
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr = safe(call(harmonicity, "Get mean", 0, 0), 0.0)

    # H1-H2 (LTAS 기반 배음 에너지 차이)
    h1_h2 = _measure_h1_h2(snd)

    return VoiceQuality(
        jitter_local=jitter_pct,
        shimmer_local=shimmer_pct,
        hnr=hnr,
        h1_h2=h1_h2,
    )


def _measure_h1_h2(snd: parselmouth.Sound) -> float:
    """LTAS 기반 H1(f0) vs H2(2*f0) 에너지 차이 (dB)."""
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    f0_median = safe(call(pitch, "Get quantile", 0, 0, 0.5, "Hertz"), 0.0)
    if f0_median <= 0:
        return 0.0

    ltas = call(snd, "To Ltas", 100)

    h1_low = max(f0_median - 50, 1.0)
    h1_high = f0_median + 50
    h1_energy = safe(call(ltas, "Get mean", h1_low, h1_high, "energy"), 0.0)

    h2_low = 2 * f0_median - 50
    h2_high = 2 * f0_median + 50
    h2_energy = safe(call(ltas, "Get mean", h2_low, h2_high, "energy"), 0.0)

    if h1_energy <= 0 or h2_energy <= 0:
        return 0.0

    return float(10 * math.log10(h1_energy / h2_energy))
