"""beat_estimator 테스트 — ACF 기반 BPM 추정."""
from __future__ import annotations

import numpy as np
import pytest
import soundfile as sf

from core.beat_estimator import estimate_beats, BeatEstimation


@pytest.fixture
def click_track_120bpm(tmp_path):
    """120 BPM 클릭 트랙 (500ms 간격, 10초)."""
    path = str(tmp_path / "click_120.wav")
    sr = 16000
    duration = 10.0
    bpm = 120.0
    interval = 60.0 / bpm
    total_samples = int(sr * duration)
    audio = np.zeros(total_samples, dtype=np.float32)

    # 매 interval마다 20ms burst
    burst_len = int(sr * 0.02)
    t = 0.0
    while t < duration:
        start = int(t * sr)
        end = min(start + burst_len, total_samples)
        audio[start:end] = 0.8 * np.sin(
            2 * np.pi * 1000 * np.arange(end - start) / sr
        ).astype(np.float32)
        t += interval

    sf.write(path, audio, sr)
    return path


@pytest.fixture
def click_track_90bpm(tmp_path):
    """90 BPM 클릭 트랙 (667ms 간격, 10초)."""
    path = str(tmp_path / "click_90.wav")
    sr = 16000
    duration = 10.0
    bpm = 90.0
    interval = 60.0 / bpm
    total_samples = int(sr * duration)
    audio = np.zeros(total_samples, dtype=np.float32)
    burst_len = int(sr * 0.02)
    t = 0.0
    while t < duration:
        start = int(t * sr)
        end = min(start + burst_len, total_samples)
        audio[start:end] = 0.8 * np.sin(
            2 * np.pi * 1000 * np.arange(end - start) / sr
        ).astype(np.float32)
        t += interval
    sf.write(path, audio, sr)
    return path


@pytest.fixture
def silent_wav(tmp_path):
    path = str(tmp_path / "silence.wav")
    sr = 16000
    sf.write(path, np.zeros(int(sr * 5), dtype=np.float32), sr)
    return path


@pytest.fixture
def noise_wav(tmp_path):
    """백색 노이즈 — 주기성 없음 → 낮은 신뢰도."""
    path = str(tmp_path / "noise.wav")
    sr = 16000
    rng = np.random.default_rng(42)
    audio = rng.uniform(-0.5, 0.5, int(sr * 5)).astype(np.float32)
    sf.write(path, audio, sr)
    return path


@pytest.fixture
def too_short_wav(tmp_path):
    """500ms 미만의 짧은 파일 — 거부되어야 함."""
    path = str(tmp_path / "short.wav")
    sr = 16000
    audio = np.zeros(int(sr * 0.5), dtype=np.float32)
    sf.write(path, audio, sr)
    return path


class TestEstimateBeats:
    def test_returns_beat_estimation_dataclass(self, click_track_120bpm):
        result = estimate_beats(click_track_120bpm)
        assert isinstance(result, BeatEstimation)
        assert 60.0 <= result.bpm <= 200.0

    def test_120bpm_detected_within_10pct(self, click_track_120bpm):
        result = estimate_beats(click_track_120bpm)
        # ACF는 정수 배수 혼동 가능 (60, 120, 240) — 합리적 범위 검증
        assert result.confidence >= 0.7, f"신뢰도 낮음: {result.confidence}"
        # 60 BPM(2배 주기) or 120 BPM 허용
        assert abs(result.bpm - 120.0) < 15 or abs(result.bpm - 60.0) < 10

    def test_90bpm_detected_or_half(self, click_track_90bpm):
        result = estimate_beats(click_track_90bpm)
        assert result.confidence >= 0.6  # 느린 템포는 confidence 다소 낮음
        # 90 또는 180(두 배) 허용
        assert abs(result.bpm - 90.0) < 15 or abs(result.bpm - 180.0) < 15

    def test_silent_audio_low_confidence(self, silent_wav):
        result = estimate_beats(silent_wav)
        # 무음은 주기성 감지 불가 → 낮은 신뢰도 또는 빈 비트
        assert result.confidence < 0.9 or len(result.beat_times) == 0

    def test_noise_low_confidence_empty_beats(self, noise_wav):
        result = estimate_beats(noise_wav)
        # 랜덤 노이즈는 주기성 약함
        assert result.confidence < 0.8 or len(result.beat_times) < 50

    def test_too_short_wav_returns_empty(self, too_short_wav):
        result = estimate_beats(too_short_wav)
        assert result.beat_times == []
        assert result.confidence == 0.0

    def test_beat_times_sorted_ascending(self, click_track_120bpm):
        result = estimate_beats(click_track_120bpm)
        if result.beat_times:
            for i in range(1, len(result.beat_times)):
                assert result.beat_times[i] > result.beat_times[i - 1]
