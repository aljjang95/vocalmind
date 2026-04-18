"""Onset 감지기 테스트 — 합성 WAV로 parselmouth 기반 onset 검증."""
from __future__ import annotations

import numpy as np
import pytest
import soundfile as sf

from core.onset_detector import OnsetEvent, detect_onsets


# ─────────────────────────────────────────
# 합성 오디오 생성 헬퍼
# ─────────────────────────────────────────

def _make_burst_audio(
    path: str,
    n_bursts: int = 10,
    interval_sec: float = 0.5,
    burst_duration: float = 0.4,
    attack_ms: float = 10.0,
    freq: float = 440.0,
    sr: int = 22050,
    noise_level: float = 0.03,
) -> list[float]:
    """n_bursts개의 사인파 burst + pink noise 합성.

    각 burst: 시작 attack + sustain + 다음 onset까지 무음.
    반환: burst 시작 시각 리스트 (초).
    """
    total_samples = int(sr * (n_bursts * interval_sec + 0.5))
    signal = np.zeros(total_samples, dtype=np.float32)

    attack_samples = int(sr * attack_ms / 1000.0)
    burst_samples = int(sr * burst_duration)
    onset_times: list[float] = []

    for i in range(n_bursts):
        start = int(sr * i * interval_sec)
        onset_times.append(i * interval_sec)
        end = start + burst_samples
        t = np.arange(burst_samples) / sr
        tone = 0.8 * np.sin(2 * np.pi * freq * t)
        # envelope: linear attack
        envelope = np.ones(burst_samples)
        envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
        signal[start:end] += (tone * envelope).astype(np.float32)

    # pink noise 추가 (배경 잡음)
    rng = np.random.default_rng(seed=42)
    white = rng.standard_normal(total_samples).astype(np.float32)
    # 간단한 pink noise 근사: 1/f 필터
    fft = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(total_samples, 1.0 / sr)
    freqs[0] = 1.0  # DC 방지
    fft /= np.sqrt(freqs)
    pink = np.fft.irfft(fft, n=total_samples).astype(np.float32)
    pink = pink / np.max(np.abs(pink) + 1e-8) * noise_level
    signal += pink

    signal = signal / (np.max(np.abs(signal)) + 1e-8) * 0.9
    sf.write(path, signal, sr)
    return onset_times


def _make_silence(path: str, duration: float = 1.0, sr: int = 22050) -> None:
    """완전 무음 WAV 생성."""
    signal = np.zeros(int(sr * duration), dtype=np.float32)
    sf.write(path, signal, sr)


def _make_short_burst(path: str, duration: float = 0.1, freq: float = 440.0, sr: int = 22050) -> None:
    """매우 짧은 단일 burst WAV 생성."""
    samples = int(sr * duration)
    t = np.arange(samples) / sr
    signal = (0.8 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
    # 전체 attack envelope
    envelope = np.linspace(0, 1, samples)
    signal = signal * envelope
    sf.write(path, signal, sr)


# ─────────────────────────────────────────
# 테스트 클래스
# ─────────────────────────────────────────

class TestOnsetDetectorBasic:
    """detect_onsets() 기본 기능 — 반환 타입, 개수, 시각 정확도."""

    def test_returns_list_of_onset_events(self, tmp_path):
        """반환 타입이 list[OnsetEvent]인지 확인."""
        wav = str(tmp_path / "burst.wav")
        _make_burst_audio(wav, n_bursts=3)
        result = detect_onsets(wav)
        assert isinstance(result, list)
        for ev in result:
            assert isinstance(ev, OnsetEvent)
            assert isinstance(ev.time_sec, float)
            assert isinstance(ev.confidence, float)

    def test_burst_count_within_tolerance(self, tmp_path):
        """10개 burst → 감지 개수 10±1개."""
        wav = str(tmp_path / "burst10.wav")
        expected_onsets = _make_burst_audio(wav, n_bursts=10, interval_sec=0.5)
        result = detect_onsets(wav)
        assert 9 <= len(result) <= 11, (
            f"expected 10±1 onsets, got {len(result)}"
        )

    def test_onset_timing_accuracy(self, tmp_path):
        """각 onset 시각이 기준 burst 시작 ±50ms 이내.

        parselmouth intensity 분석은 내부 스무딩(time_step=5ms) 때문에
        실제 attack 엣지 대비 최대 ±30ms 지연이 발생할 수 있음.
        ±50ms tolerance로 검증.
        """
        wav = str(tmp_path / "timing.wav")
        expected_onsets = _make_burst_audio(wav, n_bursts=10, interval_sec=0.5)
        result = detect_onsets(wav)
        detected_times = sorted(ev.time_sec for ev in result)
        tolerance_sec = 0.050  # ±50ms

        matched = 0
        for ref in expected_onsets:
            for det in detected_times:
                if abs(det - ref) <= tolerance_sec:
                    matched += 1
                    break

        # 최소 8개 이상 (80%) 정확히 매칭
        assert matched >= 8, (
            f"only {matched}/10 onsets matched within ±50ms. "
            f"detected: {detected_times}, expected: {expected_onsets}"
        )

    def test_confidence_in_valid_range(self, tmp_path):
        """confidence 값이 [0.0, 1.0] 범위 내."""
        wav = str(tmp_path / "conf.wav")
        _make_burst_audio(wav, n_bursts=5)
        result = detect_onsets(wav)
        for ev in result:
            assert 0.0 <= ev.confidence <= 1.0, (
                f"confidence {ev.confidence} out of range"
            )


class TestOnsetDetectorEdgeCases:
    """edge case — 무음, 짧은 오디오."""

    def test_silence_returns_empty(self, tmp_path):
        """무음 WAV → 빈 리스트 반환."""
        wav = str(tmp_path / "silence.wav")
        _make_silence(wav, duration=1.0)
        result = detect_onsets(wav)
        assert result == [], f"expected empty list for silence, got {result}"

    def test_short_audio_returns_few_onsets(self, tmp_path):
        """100ms 짧은 WAV → 빈 리스트 또는 최대 1개."""
        wav = str(tmp_path / "short.wav")
        _make_short_burst(wav, duration=0.1)
        result = detect_onsets(wav)
        assert len(result) <= 1, (
            f"expected 0 or 1 onset for 100ms audio, got {len(result)}"
        )

    def test_invalid_path_returns_empty(self):
        """존재하지 않는 파일 경로 → 빈 리스트 (예외 미전파)."""
        result = detect_onsets("/nonexistent/path/audio.wav")
        assert result == []

    def test_onset_events_sorted_by_time(self, tmp_path):
        """반환된 OnsetEvent 리스트가 시간순 정렬되어 있는지 확인."""
        wav = str(tmp_path / "sorted.wav")
        _make_burst_audio(wav, n_bursts=5, interval_sec=0.4)
        result = detect_onsets(wav)
        times = [ev.time_sec for ev in result]
        assert times == sorted(times), "OnsetEvents not sorted by time"
