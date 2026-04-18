"""Onset 감지기 — parselmouth intensity 미분 기반 타격 시각 추출."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import soundfile as sf
import parselmouth

from analyzers.utils import safe


@dataclass
class OnsetEvent:
    """단일 onset 이벤트."""
    time_sec: float
    confidence: float


def detect_onsets(
    audio_path: str,
    time_step: float = 0.005,
    min_pitch: float = 75.0,
    delta_db_threshold: float = 3.0,
    min_interval_sec: float = 0.08,
) -> list[OnsetEvent]:
    """오디오 파일에서 onset(타격 시작) 시각을 감지한다.

    알고리즘:
      1. soundfile.read() → parselmouth.Sound
      2. to_intensity(time_step=0.005) → intensity 배열
      3. 1차 차분(dB 변화량) 계산
      4. peak-picking: threshold 3dB, 최소 간격 80ms
      5. 각 peak 시각의 F0 유효성 검증 (pitch가 NaN이면 제외)
      6. OnsetEvent(time_sec, confidence) 리스트 반환 (시간순)

    Args:
        audio_path: WAV 파일 경로
        time_step: intensity 분석 시간 간격 (초)
        min_pitch: to_intensity의 minimum_pitch 파라미터 (Hz)
        delta_db_threshold: onset 판정 dB 상승 임계값
        min_interval_sec: 연속 onset 간 최소 간격 (초)

    Returns:
        시간순 정렬된 OnsetEvent 리스트 (감지 실패 시 빈 리스트)
    """
    try:
        data, sr = sf.read(str(audio_path), dtype="float32", always_2d=False)
    except Exception:
        return []

    if data.ndim > 1:
        data = data.mean(axis=1)

    # 너무 짧은 오디오 (100ms 미만) 스킵
    duration_sec = len(data) / sr
    if duration_sec < 0.1:
        return []

    # 무음 판정: RMS가 매우 낮으면 빈 리스트
    rms = float(np.sqrt(np.mean(data ** 2)))
    if rms < 1e-5:
        return []

    try:
        snd = parselmouth.Sound(data, sampling_frequency=float(sr))

        # Intensity 분석 (dB)
        intensity = snd.to_intensity(
            time_step=time_step,
            minimum_pitch=min_pitch,
            subtract_mean=True,
        )
        int_times = intensity.xs()          # shape (N,)
        int_values = intensity.values[0]    # shape (N,) dB 값

        # NaN → 0으로 치환
        int_values = np.array([safe(float(v), 0.0) for v in int_values], dtype=float)

        if len(int_values) < 2:
            return []

        # 1차 차분 (dB/frame): 상승 엣지만 감지
        delta = np.diff(int_values, prepend=int_values[0])

        # F0 분석 (onset 유효성 검증용)
        pitch = snd.to_pitch(time_step=time_step, pitch_floor=min_pitch, pitch_ceiling=800.0)

        # peak-picking
        onsets: list[OnsetEvent] = []
        last_onset_time = -min_interval_sec

        for i, t in enumerate(int_times):
            if delta[i] < delta_db_threshold:
                continue
            if (t - last_onset_time) < min_interval_sec:
                continue

            # F0 유효성 검증: pitch 값이 NaN이 아니거나 인근에 voiced 구간 존재
            f0 = pitch.get_value_at_time(float(t))
            if f0 != f0:  # NaN — voiced 구간 탐색 (±50ms 범위)
                has_voiced = _has_voiced_nearby(pitch, float(t), window_sec=0.05)
                if not has_voiced:
                    continue

            # confidence: delta를 최대 delta 대비 비율로 정규화 (나중에 归一化)
            confidence_raw = float(delta[i])
            onsets.append(OnsetEvent(time_sec=float(t), confidence=confidence_raw))
            last_onset_time = t

        if not onsets:
            return []

        # confidence 정규화: 최대값 기준 [0, 1]
        max_conf = max(ev.confidence for ev in onsets)
        if max_conf > 0:
            onsets = [
                OnsetEvent(ev.time_sec, min(1.0, ev.confidence / max_conf))
                for ev in onsets
            ]

        return sorted(onsets, key=lambda e: e.time_sec)

    except Exception:
        return []


def _has_voiced_nearby(
    pitch: parselmouth.Pitch,
    center_sec: float,
    window_sec: float = 0.05,
) -> bool:
    """center_sec ± window_sec 범위에 voiced 프레임이 하나라도 있으면 True."""
    try:
        start = max(pitch.xmin, center_sec - window_sec)
        end = min(pitch.xmax, center_sec + window_sec)
        step = pitch.time_step
        t = start
        while t <= end:
            val = pitch.get_value_at_time(t)
            if val == val and val > 0:  # 유효한 F0
                return True
            t += step
        return False
    except Exception:
        return False
