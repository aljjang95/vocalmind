"""audio_service.analyze_audio_file 테스트."""
from __future__ import annotations
import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from tests.fixtures.generate_wav import generate_stable_tone


@pytest.fixture
def stable_wav(tmp_path):
    """정상 220Hz 사인파 WAV."""
    return generate_stable_tone(str(tmp_path / "stable.wav"), freq=220.0, duration=2.0)


@pytest.fixture
def silent_wav(tmp_path):
    """무음 WAV (amplitude ~0)."""
    import soundfile as sf
    path = str(tmp_path / "silent.wav")
    data = np.zeros(16000 * 2, dtype=np.float32)  # 2초 무음
    sf.write(path, data, 16000)
    return path


@pytest.fixture
def stereo_wav(tmp_path):
    """스테레오 WAV."""
    import soundfile as sf
    path = str(tmp_path / "stereo.wav")
    t = np.linspace(0, 2.0, 32000, endpoint=False)
    left = 0.5 * np.sin(2 * np.pi * 220 * t)
    right = 0.5 * np.sin(2 * np.pi * 330 * t)
    data = np.column_stack([left, right]).astype(np.float32)
    sf.write(path, data, 16000)
    return path


class TestAnalyzeAudioFile:
    """analyze_audio_file 함수 테스트."""

    def test_normal_wav_returns_valid_dict(self, stable_wav):
        """정상 WAV → 올바른 키와 타입의 딕셔너리 반환."""
        from services.audio_service import analyze_audio_file
        result = analyze_audio_file(stable_wav)

        assert isinstance(result, dict)
        assert "pitch_values" in result
        assert "avg_pitch" in result
        assert "tone_stability" in result
        assert "duration" in result
        assert "tension_score" in result

        assert isinstance(result["pitch_values"], list)
        assert len(result["pitch_values"]) > 0
        assert result["avg_pitch"] > 0
        assert 0.0 <= result["tone_stability"] <= 100.0
        assert result["duration"] > 0

    def test_silent_wav_returns_zero_pitch(self, silent_wav):
        """무음 WAV → avg_pitch 0, pitch_values 빈 리스트, tension_score None."""
        from services.audio_service import analyze_audio_file
        result = analyze_audio_file(silent_wav)

        assert result["pitch_values"] == []
        assert result["avg_pitch"] == 0.0
        assert result["tone_stability"] == 0.0
        assert result["tension_score"] is None

    def test_stereo_wav_converted_to_mono(self, stereo_wav):
        """스테레오 WAV → mono 변환 후 정상 분석."""
        from services.audio_service import analyze_audio_file
        result = analyze_audio_file(stereo_wav)

        assert isinstance(result, dict)
        assert result["duration"] > 0
        # 스테레오도 정상 분석되어야 함
        assert "pitch_values" in result
        assert "avg_pitch" in result

    def test_praat_error_returns_safe_defaults(self, tmp_path):
        """parselmouth PraatError 시 안전한 기본값 반환."""
        import soundfile as sf
        import parselmouth

        # 아주 짧은 WAV (parselmouth가 처리 못할 수 있음)
        path = str(tmp_path / "tiny.wav")
        sf.write(path, np.zeros(10, dtype=np.float32), 16000)

        with patch("services.audio_service.parselmouth") as mock_pm:
            mock_snd = MagicMock()
            mock_snd.to_pitch.side_effect = parselmouth.PraatError("too short")
            mock_pm.Sound.return_value = mock_snd
            mock_pm.PraatError = parselmouth.PraatError

            from services.audio_service import analyze_audio_file
            result = analyze_audio_file(path)

        assert result["pitch_values"] == []
        assert result["avg_pitch"] == 0.0
        assert result["tension_score"] is None
        assert result["duration"] > 0

    def test_tension_analysis_exception_returns_none_score(self, stable_wav):
        """tension_analyzer 예외 시 tension_score = None, 나머지는 정상."""
        with patch("services.audio_service.tension_analyzer") as mock_ta:
            mock_ta.analyze_tension.side_effect = RuntimeError("analysis failed")

            from services.audio_service import analyze_audio_file
            result = analyze_audio_file(stable_wav)

        assert result["tension_score"] is None
        # 피치 분석은 정상이어야 함
        assert result["avg_pitch"] > 0
        assert len(result["pitch_values"]) > 0
