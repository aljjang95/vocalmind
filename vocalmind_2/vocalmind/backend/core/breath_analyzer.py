"""호흡 분석기 — RMS envelope + voicing으로 흡기/호기 사이클 검출."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import parselmouth
from parselmouth.praat import call

from analyzers.utils import load_audio, safe


@dataclass
class BreathCycle:
    """단일 호흡 사이클 — 흡기(inhale) 직후 호기(exhale) 쌍."""
    inhale_start_sec: float
    inhale_end_sec: float  # = exhale_start_sec
    exhale_end_sec: float
    inhale_duration_sec: float
    exhale_duration_sec: float
    exhale_stability: float  # 0~1 (호기 중 RMS 떨림 적을수록 높음)


@dataclass
class BreathAnalysis:
    """전체 호흡 분석 결과."""
    cycles: list[BreathCycle]
    avg_inhale_sec: float
    avg_exhale_sec: float
    consistency_score: int  # 0~100
    sustain_score: int      # 0~100 (목표 길이 대비 달성률)
    stability_score: int    # 0~100 (호기 안정성)
    overall_score: int      # 0~100 (종합)
    duration_sec: float
    weakness: str           # shallow / unstable / short / none


# ── 상수 ────────────────────────────────────────────
DEFAULT_TARGET_EXHALE_SEC = 10.0  # 발성전문반 목표 호기 시간
MIN_SILENCE_FOR_INHALE_SEC = 0.3  # 최소 흡기 구간
MIN_VOICED_FOR_EXHALE_SEC = 0.5   # 최소 호기 구간
INTENSITY_TIME_STEP = 0.02         # 20ms 분해능


def analyze_breathing(
    audio_path: str,
    target_exhale_sec: float = DEFAULT_TARGET_EXHALE_SEC,
) -> BreathAnalysis:
    """오디오 파일에서 호흡 사이클을 검출하고 점수를 계산한다."""
    audio, sr = load_audio(audio_path)
    duration = len(audio) / sr

    if duration < 1.0:
        return _empty_analysis(duration, "short")

    snd = parselmouth.Sound(audio, sampling_frequency=sr)

    # intensity envelope (20ms time step)
    try:
        intensity = call(snd, "To Intensity", 100.0, INTENSITY_TIME_STEP, "yes")
    except parselmouth.PraatError:
        return _empty_analysis(duration, "short")

    n_frames = call(intensity, "Get number of frames")
    if n_frames < 10:
        return _empty_analysis(duration, "short")

    dt = call(intensity, "Get time step")
    values = np.array(
        [safe(call(intensity, "Get value in frame", i), 0.0) for i in range(1, n_frames + 1)],
        dtype=np.float64,
    )

    # adaptive threshold: 상위 60% 기준 (호기가 들숨보다 에너지 높다는 가정)
    threshold = _adaptive_threshold(values)

    # frame 단위 voicing mask (True=호기, False=흡기/무음)
    voiced_mask = values >= threshold

    # 사이클 검출
    cycles = _detect_cycles(voiced_mask, dt, values)

    if not cycles:
        return _empty_analysis(duration, "shallow")

    # 점수 계산
    avg_inhale = float(np.mean([c.inhale_duration_sec for c in cycles]))
    avg_exhale = float(np.mean([c.exhale_duration_sec for c in cycles]))

    consistency = _consistency_score(cycles)
    sustain = _sustain_score(cycles, target_exhale_sec)
    stability = _stability_score(cycles)
    overall = int(round(0.35 * sustain + 0.35 * stability + 0.30 * consistency))
    overall = max(0, min(100, overall))

    weakness = _identify_weakness(sustain, stability, consistency, len(cycles))

    return BreathAnalysis(
        cycles=cycles,
        avg_inhale_sec=avg_inhale,
        avg_exhale_sec=avg_exhale,
        consistency_score=consistency,
        sustain_score=sustain,
        stability_score=stability,
        overall_score=overall,
        duration_sec=duration,
        weakness=weakness,
    )


# ── 내부 헬퍼 ────────────────────────────────────────

def _adaptive_threshold(values: np.ndarray) -> float:
    """노이즈 플로어 대비 상위 에너지 threshold."""
    noise_floor = float(np.quantile(values, 0.2))
    peak = float(np.quantile(values, 0.95))
    return noise_floor + (peak - noise_floor) * 0.35


def _detect_cycles(
    voiced_mask: np.ndarray,
    dt: float,
    values: np.ndarray,
) -> list[BreathCycle]:
    """voiced mask를 스캔하여 호흡 사이클 추출."""
    cycles: list[BreathCycle] = []
    min_inhale_frames = max(1, int(MIN_SILENCE_FOR_INHALE_SEC / dt))
    min_exhale_frames = max(1, int(MIN_VOICED_FOR_EXHALE_SEC / dt))

    n = len(voiced_mask)
    i = 0

    # 첫 흡기 구간 찾기 (pad 역할)
    while i < n and voiced_mask[i]:
        i += 1

    while i < n:
        # 흡기 구간 시작
        inhale_start = i
        while i < n and not voiced_mask[i]:
            i += 1
        inhale_end = i

        if inhale_end - inhale_start < min_inhale_frames:
            # 흡기 구간이 너무 짧음 → 사이클 무효
            # 다음 호기 찾기
            while i < n and voiced_mask[i]:
                i += 1
            continue

        # 호기 구간
        exhale_start = i
        while i < n and voiced_mask[i]:
            i += 1
        exhale_end = i

        if exhale_end - exhale_start < min_exhale_frames:
            continue

        # 호기 안정성 (RMS 변동 계수)
        exhale_values = values[exhale_start:exhale_end]
        if len(exhale_values) > 1 and np.mean(exhale_values) > 0:
            cv = float(np.std(exhale_values) / np.mean(exhale_values))
            stability = max(0.0, min(1.0, 1.0 - cv))
        else:
            stability = 0.0

        cycles.append(
            BreathCycle(
                inhale_start_sec=inhale_start * dt,
                inhale_end_sec=exhale_start * dt,
                exhale_end_sec=exhale_end * dt,
                inhale_duration_sec=(exhale_start - inhale_start) * dt,
                exhale_duration_sec=(exhale_end - exhale_start) * dt,
                exhale_stability=stability,
            )
        )

    return cycles


def _consistency_score(cycles: list[BreathCycle]) -> int:
    """사이클 간 호기 시간 표준편차 기반 일관성 (0~100)."""
    if len(cycles) < 2:
        return 50
    exhales = np.array([c.exhale_duration_sec for c in cycles])
    mean = float(np.mean(exhales))
    if mean <= 0:
        return 0
    cv = float(np.std(exhales) / mean)
    # cv 0 → 100점, cv 0.5 이상 → 0점
    score = 100.0 * max(0.0, 1.0 - cv / 0.5)
    return int(round(max(0, min(100, score))))


def _sustain_score(cycles: list[BreathCycle], target_sec: float) -> int:
    """목표 호기 시간 대비 달성률 (0~100)."""
    if not cycles or target_sec <= 0:
        return 0
    max_exhale = max(c.exhale_duration_sec for c in cycles)
    ratio = min(1.0, max_exhale / target_sec)
    return int(round(100.0 * ratio))


def _stability_score(cycles: list[BreathCycle]) -> int:
    """사이클별 호기 안정성 평균 (0~100)."""
    if not cycles:
        return 0
    avg_stab = float(np.mean([c.exhale_stability for c in cycles]))
    return int(round(100.0 * max(0.0, min(1.0, avg_stab))))


def _identify_weakness(
    sustain: int,
    stability: int,
    consistency: int,
    n_cycles: int,
) -> str:
    """가장 낮은 점수 항목을 약점으로 식별."""
    if n_cycles < 2:
        return "short"
    scores = {
        "sustain": sustain,
        "stability": stability,
        "consistency": consistency,
    }
    weakest = min(scores, key=lambda k: scores[k])
    if scores[weakest] >= 75:
        return "none"
    weakness_map = {
        "sustain": "short",        # 호기 지속 부족
        "stability": "unstable",   # 호기 떨림
        "consistency": "shallow",  # 사이클 일관성 부족
    }
    return weakness_map[weakest]


def _empty_analysis(duration: float, weakness: str) -> BreathAnalysis:
    return BreathAnalysis(
        cycles=[],
        avg_inhale_sec=0.0,
        avg_exhale_sec=0.0,
        consistency_score=0,
        sustain_score=0,
        stability_score=0,
        overall_score=0,
        duration_sec=duration,
        weakness=weakness,
    )
