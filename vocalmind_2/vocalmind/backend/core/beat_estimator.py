"""오디오에서 BPM + 비트 격자를 추정한다.

parselmouth intensity envelope autocorrelation으로 주기성 감지.
신뢰도 0.7 이상일 때만 유효 결과.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import parselmouth
from parselmouth.praat import call

from analyzers.utils import load_audio, safe


@dataclass
class BeatEstimation:
    bpm: float
    first_beat_offset_sec: float
    beat_times: list[float]
    confidence: float  # 0~1


# 음악 BPM 일반 범위
MIN_BPM = 60.0
MAX_BPM = 200.0


def estimate_beats(audio_path: str) -> BeatEstimation:
    """오디오에서 BPM + 비트 시각을 추정한다.

    신뢰도 < 0.7이면 빈 beat_times 반환 (호출자가 폴백 처리).
    """
    audio, sr = load_audio(audio_path)
    if len(audio) < sr:  # 1초 미만은 거부
        return BeatEstimation(bpm=0.0, first_beat_offset_sec=0.0, beat_times=[], confidence=0.0)

    snd = parselmouth.Sound(audio, sampling_frequency=sr)

    # intensity envelope 추출 (10ms 분해능)
    intensity = call(snd, "To Intensity", 100.0, 0.01, "yes")
    n_frames = call(intensity, "Get number of frames")
    if n_frames < 50:
        return BeatEstimation(bpm=0.0, first_beat_offset_sec=0.0, beat_times=[], confidence=0.0)

    # intensity 값 + 시간 추출
    dt = call(intensity, "Get time step")
    values = np.array(
        [safe(call(intensity, "Get value in frame", i), 0.0) for i in range(1, n_frames + 1)],
        dtype=np.float64,
    )

    # 평균 제거 (에너지 envelope의 DC 성분 제거)
    values = values - float(np.mean(values))

    # autocorrelation으로 주기 탐색
    n = len(values)
    acf = np.correlate(values, values, mode="full")[n - 1:]
    acf_norm = acf[0] if acf[0] != 0 else 1.0
    acf = acf / acf_norm

    # BPM 범위 → lag 범위 (초 당 프레임 수 / bpm/60)
    frames_per_sec = 1.0 / dt if dt > 0 else 100.0
    min_lag = max(1, int(frames_per_sec * 60.0 / MAX_BPM))
    max_lag = min(n - 1, int(frames_per_sec * 60.0 / MIN_BPM))

    if max_lag <= min_lag:
        return BeatEstimation(bpm=0.0, first_beat_offset_sec=0.0, beat_times=[], confidence=0.0)

    # 유효 lag 구간에서 최대값 탐색
    peak_lag = int(np.argmax(acf[min_lag:max_lag + 1])) + min_lag
    peak_value = float(acf[peak_lag])  # 0~1, 높을수록 주기성 강함

    bpm = 60.0 * frames_per_sec / peak_lag
    bpm = float(max(MIN_BPM, min(MAX_BPM, bpm)))

    # 신뢰도 = ACF peak 값
    confidence = max(0.0, min(1.0, peak_value))

    if confidence < 0.7:
        return BeatEstimation(
            bpm=float(bpm),
            first_beat_offset_sec=0.0,
            beat_times=[],
            confidence=float(confidence),
        )

    # 비트 시각 생성: 첫 강한 피크 시각을 offset으로 사용
    beat_interval_sec = 60.0 / bpm
    # intensity 상위 20% 임계값 초과 첫 프레임을 offset 추정
    threshold = float(np.quantile(values, 0.8))
    first_frame = 0
    for i, v in enumerate(values):
        if v >= threshold:
            first_frame = i
            break
    first_beat_offset_sec = first_frame * dt

    total_duration_sec = n * dt
    beat_times: list[float] = []
    t = first_beat_offset_sec
    while t < total_duration_sec:
        beat_times.append(round(t, 3))
        t += beat_interval_sec

    return BeatEstimation(
        bpm=float(bpm),
        first_beat_offset_sec=float(first_beat_offset_sec),
        beat_times=beat_times,
        confidence=float(confidence),
    )
