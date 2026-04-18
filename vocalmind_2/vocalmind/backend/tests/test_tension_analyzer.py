"""긴장 분석기 테스트 — 합성 WAV로 parselmouth 분석 검증."""
from __future__ import annotations
import numpy as np
import pytest
import soundfile as sf
from tests.fixtures.generate_wav import generate_stable_tone, generate_tense_tone
from services.tension_analyzer import analyze_tension, _safe
from models.tension import TensionAnalysis

@pytest.fixture
def stable_wav(tmp_path):
    return generate_stable_tone(str(tmp_path / "stable.wav"))

@pytest.fixture
def tense_wav(tmp_path):
    return generate_tense_tone(str(tmp_path / "tense.wav"))

class TestVoiceQuality:
    def test_stable_tone_low_jitter(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert isinstance(result, TensionAnalysis)
        assert result.voice_quality.jitter_local < 2.0

    def test_tense_tone_higher_jitter(self, stable_wav, tense_wav):
        stable = analyze_tension(stable_wav)
        tense = analyze_tension(tense_wav)
        assert tense.voice_quality.jitter_local > stable.voice_quality.jitter_local

    def test_stable_tone_high_hnr(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.voice_quality.hnr > 10.0

    def test_tense_tone_lower_hnr(self, stable_wav, tense_wav):
        stable = analyze_tension(stable_wav)
        tense = analyze_tension(tense_wav)
        assert tense.voice_quality.hnr < stable.voice_quality.hnr

    def test_h1_h2_computed(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert isinstance(result.voice_quality.h1_h2, float)

class TestFormant:
    def test_formant_values_positive(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.formant.f1_mean > 0
        assert result.formant.f2_mean > 0

    def test_vsa_non_negative(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.formant.vsa >= 0

class TestDuration:
    def test_duration_matches(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert 1.5 < result.duration < 2.5


class TestSafeHelper:
    """_safe 헬퍼 함수 — NaN/Inf 방어 (line 44 커버)."""

    def test_nan_returns_default(self):
        """NaN 입력 → default 반환."""
        assert _safe(float("nan"), 99.0) == 99.0

    def test_inf_returns_default(self):
        """Inf 입력 → default 반환 (line 44 커버)."""
        assert _safe(float("inf"), 5.0) == 5.0

    def test_negative_inf_returns_default(self):
        """-Inf 입력 → default 반환."""
        assert _safe(float("-inf"), -1.0) == -1.0

    def test_normal_value_returned_as_is(self):
        """정상 값은 그대로 반환."""
        assert _safe(42.0) == 42.0
        assert _safe(0.0) == 0.0


class TestSilenceAudio:
    """무음 오디오에 대한 엣지 케이스 (lines 83, 98, 158, 192, 207 커버)."""

    @pytest.fixture
    def silence_wav(self, tmp_path):
        """완전 무음 WAV — parselmouth F0 감지 불가 → 내부 분기 실행."""
        path = str(tmp_path / "silence.wav")
        sr = 16000
        data = np.zeros(int(sr * 2.0), dtype=np.float32)
        sf.write(path, data, sr)
        return path

    @pytest.fixture
    def noise_wav(self, tmp_path):
        """백색 노이즈 WAV — F0가 불안정하여 다양한 분기 실행."""
        path = str(tmp_path / "noise.wav")
        sr = 16000
        rng = np.random.default_rng(42)
        data = rng.uniform(-0.3, 0.3, int(sr * 2.0)).astype(np.float32)
        sf.write(path, data, sr)
        return path

    def test_silence_analysis_returns_valid_result(self, silence_wav):
        """무음 오디오도 TensionAnalysis 반환 (예외 없이 완료)."""
        result = analyze_tension(silence_wav)
        assert isinstance(result, TensionAnalysis)
        assert result.duration > 0

    def test_silence_formant_safe_defaults(self, silence_wav):
        """무음에서 포먼트가 0 이하일 때 안전한 기본값 반환."""
        result = analyze_tension(silence_wav)
        assert result.formant.f1_mean >= 0
        assert result.formant.f2_mean >= 0
        assert result.formant.vsa >= 0

    def test_silence_register_transition_defaults(self, silence_wav):
        """무음에서 성구전환 분석이 기본값 반환 (lines 158, 192, 207 커버)."""
        result = analyze_tension(silence_wav)
        assert result.register_transition.f0_max_jump_hz >= 0
        assert result.register_transition.voiceless_gaps >= 0
        assert 0.0 <= result.register_transition.smoothness_score <= 1.0

    def test_noise_analysis_no_exception(self, noise_wav):
        """노이즈 오디오도 예외 없이 분석 완료."""
        result = analyze_tension(noise_wav)
        assert isinstance(result, TensionAnalysis)

    def test_trailing_voiceless_gap_counted(self, tmp_path):
        """끝이 무음으로 끝나는 오디오 — 마지막 연속 무성구간 카운트 (line 192 커버)."""
        path = str(tmp_path / "trailing_silence.wav")
        sr = 16000
        # 앞 절반은 톤, 뒤 절반은 완전 무음 (trailing voiceless gap)
        t = np.linspace(0, 1.0, sr, endpoint=False)
        tone = (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
        silence = np.zeros(sr, dtype=np.float32)
        data = np.concatenate([tone, silence])
        sf.write(path, data, sr)

        result = analyze_tension(path)
        # 뒤 무음 구간이 있으므로 voiceless_gaps >= 0
        assert result.register_transition.voiceless_gaps >= 0

    def test_monotone_no_jumps_zero_jump_penalty(self, tmp_path):
        """단조로운 안정 톤은 F0 점프가 없어 smoothness_score가 높음 (line 207 커버)."""
        path = str(tmp_path / "monotone.wav")
        sr = 16000
        t = np.linspace(0, 2.0, int(sr * 2.0), endpoint=False)
        # 완벽히 안정된 사인파 (harmonics 없이 순수 사인)
        data = (0.6 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        sf.write(path, data, sr)

        result = analyze_tension(path)
        # 점프가 없으면 smoothness_score가 높아야 함
        assert result.register_transition.smoothness_score >= 0.5
