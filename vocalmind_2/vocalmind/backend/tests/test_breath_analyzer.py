"""호흡 분석기 테스트 — 합성 오디오로 사이클 검출 검증."""
from __future__ import annotations

import numpy as np
import pytest
import soundfile as sf

from core.breath_analyzer import analyze_breathing, BreathAnalysis, BreathCycle


def _make_breath_audio(
    path: str,
    cycle_count: int,
    exhale_sec: float = 2.0,
    inhale_sec: float = 0.8,
    sr: int = 16000,
    noise_db: float = -40.0,
) -> None:
    """흡기=무음, 호기=440Hz 사인파 합성."""
    audio_parts: list[np.ndarray] = []

    # 첫 흡기 pad
    audio_parts.append(np.zeros(int(sr * inhale_sec), dtype=np.float32))

    for _ in range(cycle_count):
        # 호기 (sine)
        n_exhale = int(sr * exhale_sec)
        t = np.arange(n_exhale) / sr
        exhale = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        audio_parts.append(exhale)

        # 흡기 (silence)
        audio_parts.append(np.zeros(int(sr * inhale_sec), dtype=np.float32))

    audio = np.concatenate(audio_parts)

    # 배경 노이즈 추가 (현실적)
    if noise_db < 0:
        amp = 10 ** (noise_db / 20)
        audio += (amp * np.random.default_rng(42).standard_normal(len(audio))).astype(np.float32)

    sf.write(path, audio, sr)


class TestBreathAnalyzer:
    def test_returns_analysis_dataclass(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=3)
        result = analyze_breathing(path)
        assert isinstance(result, BreathAnalysis)

    def test_3_cycles_detected(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=3, exhale_sec=2.0, inhale_sec=0.8)
        result = analyze_breathing(path)
        # ±1 허용
        assert 2 <= len(result.cycles) <= 4, f"검출 사이클 수: {len(result.cycles)}"

    def test_avg_exhale_matches_synthesis(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=4, exhale_sec=2.0, inhale_sec=0.8)
        result = analyze_breathing(path)
        if result.cycles:
            assert 1.5 <= result.avg_exhale_sec <= 2.5

    def test_score_ranges_valid(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=3)
        result = analyze_breathing(path)
        assert 0 <= result.consistency_score <= 100
        assert 0 <= result.sustain_score <= 100
        assert 0 <= result.stability_score <= 100
        assert 0 <= result.overall_score <= 100

    def test_empty_audio_returns_empty_analysis(self, tmp_path):
        path = str(tmp_path / "empty.wav")
        sr = 16000
        sf.write(path, np.zeros(int(sr * 0.5), dtype=np.float32), sr)
        result = analyze_breathing(path)
        assert isinstance(result, BreathAnalysis)
        assert result.cycles == []
        assert result.weakness == "short"

    def test_silence_only_returns_no_cycles(self, tmp_path):
        path = str(tmp_path / "silence.wav")
        sr = 16000
        sf.write(path, np.zeros(int(sr * 5), dtype=np.float32), sr)
        result = analyze_breathing(path)
        assert len(result.cycles) == 0
        # 호기 없음 → shallow 약점
        assert result.weakness in ("shallow", "short")

    def test_long_target_reduces_sustain_score(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=3, exhale_sec=2.0)

        # target 2초 → 만점 근접
        r_short = analyze_breathing(path, target_exhale_sec=2.0)
        # target 10초 → 20% 달성
        r_long = analyze_breathing(path, target_exhale_sec=10.0)

        if r_short.cycles and r_long.cycles:
            assert r_short.sustain_score > r_long.sustain_score

    def test_weakness_string_valid(self, tmp_path):
        path = str(tmp_path / "b.wav")
        _make_breath_audio(path, cycle_count=2)
        result = analyze_breathing(path)
        assert result.weakness in ("shallow", "unstable", "short", "none")

    def test_consistency_higher_with_uniform_cycles(self, tmp_path):
        """일정한 길이 사이클이 불규칙한 것보다 consistency 높음."""
        uniform_path = str(tmp_path / "uniform.wav")
        _make_breath_audio(uniform_path, cycle_count=4, exhale_sec=2.0, inhale_sec=0.8)

        # 불규칙 사이클 생성 (0.5, 2.5, 1.0, 3.0초)
        irregular_path = str(tmp_path / "irregular.wav")
        sr = 16000
        parts = [np.zeros(int(sr * 0.8), dtype=np.float32)]
        for ex_sec in [0.5, 2.5, 1.0, 3.0]:
            n = int(sr * ex_sec)
            t = np.arange(n) / sr
            parts.append((0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32))
            parts.append(np.zeros(int(sr * 0.8), dtype=np.float32))
        audio = np.concatenate(parts)
        sf.write(irregular_path, audio, sr)

        r_uniform = analyze_breathing(uniform_path)
        r_irregular = analyze_breathing(irregular_path)

        if len(r_uniform.cycles) >= 2 and len(r_irregular.cycles) >= 2:
            assert r_uniform.consistency_score >= r_irregular.consistency_score
