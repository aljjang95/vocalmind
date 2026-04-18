"""후처리 파이프라인 테스트 — 음성변환에서 이식된 audio_postprocess.py"""
from __future__ import annotations

import numpy as np
import pytest

from services.audio_postprocess import (
    PostProcessPreset,
    PRESETS,
    process_vocal,
    normalize_lufs,
    transfer_dynamics,
    gate_by_original,
    blend_high_frequency,
    add_warmth,
    mix_vocal_and_instrumental,
)


SR = 44100


def _sine(freq: float = 440, duration: float = 1.0, sr: int = SR) -> np.ndarray:
    """테스트용 사인파 생성"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
    return 0.5 * np.sin(2 * np.pi * freq * t)


def _noise(duration: float = 1.0, sr: int = SR, amplitude: float = 0.3) -> np.ndarray:
    """테스트용 노이즈 생성"""
    rng = np.random.default_rng(42)
    return (rng.random(int(sr * duration)) * 2 - 1).astype(np.float32) * amplitude


# ── 프리셋 ──


def test_presets_exist():
    assert "default" in PRESETS
    assert "hq_svc" in PRESETS
    assert "ballad" in PRESETS
    assert "pop" in PRESETS


def test_preset_vocal_lufs_range():
    for name, preset in PRESETS.items():
        assert -20 <= preset.vocal_lufs <= 0, f"{name} vocal_lufs out of range"


# ── process_vocal ──


def test_process_vocal_returns_same_length():
    audio = _sine(duration=2.0)
    result = process_vocal(audio, SR)
    # 스테레오로 변환되므로 shape[1] 확인
    assert result.shape[-1] >= len(audio) - SR  # 리버브 테일 허용


def test_process_vocal_no_clipping():
    audio = _sine(duration=1.0)
    result = process_vocal(audio, SR)
    assert np.max(np.abs(result)) <= 1.01  # 리미터가 1.0dB 이내로 제한


def test_process_vocal_with_preset():
    audio = _sine(duration=1.0)
    result = process_vocal(audio, SR, PRESETS["hq_svc"])
    assert result is not None
    assert result.shape[-1] > 0


def test_process_vocal_stereo_input():
    mono = _sine(duration=1.0)
    stereo = np.stack([mono, mono], axis=0)
    result = process_vocal(stereo, SR)
    assert result.ndim == 2


# ── normalize_lufs ──


def test_normalize_lufs_changes_level():
    audio = _sine(duration=2.0) * 0.1  # 조용한 신호
    result = normalize_lufs(audio, SR, -14.0)
    # 정규화 후 원본보다 커야 함
    assert np.mean(np.abs(result)) > np.mean(np.abs(audio)) * 0.5


def test_normalize_lufs_silent_audio():
    audio = np.zeros(SR * 2, dtype=np.float32)
    result = normalize_lufs(audio, SR, -14.0)
    # 무음은 변경 없이 반환
    assert np.allclose(result, audio)


# ── transfer_dynamics ──


def test_transfer_dynamics_preserves_shape():
    converted = _sine(440, 2.0)
    original = _sine(440, 2.0) * np.linspace(0.1, 1.0, len(converted))
    result = transfer_dynamics(converted, original, SR, strength=0.4)
    assert result.shape == converted.shape


def test_transfer_dynamics_zero_strength():
    converted = _sine(440, 1.0)
    original = _noise(1.0)
    result = transfer_dynamics(converted, original, SR, strength=0.0)
    # strength=0이면 원본과 거의 같아야 함
    min_len = min(len(result), len(converted))
    assert np.allclose(result[:min_len], converted[:min_len], atol=1e-4)


# ── gate_by_original ──


def test_gate_suppresses_quiet_sections():
    # 원곡이 중간에 무음인 경우
    original = np.concatenate([_sine(440, 0.5), np.zeros(SR // 2, dtype=np.float32)])
    converted = _sine(440, 1.0)
    result = gate_by_original(converted, original, SR, threshold=0.01)
    # 후반부(원곡 무음)가 원래보다 작아야 함
    second_half_original = np.mean(np.abs(converted[SR // 2:]))
    second_half_gated = np.mean(np.abs(result[SR // 2:]))
    assert second_half_gated < second_half_original * 0.5


# ── blend_high_frequency ──


def test_blend_hf_preserves_low_frequency():
    converted = _sine(440, 1.0)  # 440Hz = 저역
    source = _sine(440, 1.0)
    result = blend_high_frequency(converted, source, SR, cutoff_hz=10000)
    # 440Hz 신호는 10kHz 이하이므로 큰 변화 없어야 함
    min_len = min(len(result.ravel()), len(converted))
    corr = np.corrcoef(result.ravel()[:min_len], converted[:min_len])[0, 1]
    assert corr > 0.9


# ── add_warmth ──


def test_add_warmth_subtle_change():
    audio = _sine(440, 1.0)
    result = add_warmth(audio, drive=0.05)
    assert result.shape == audio.shape
    # 미세한 변화만 있어야 함
    diff = np.mean(np.abs(result - audio))
    assert diff < 0.05


def test_add_warmth_zero_drive():
    audio = _sine(440, 1.0)
    result = add_warmth(audio, drive=0.0)
    assert np.allclose(result, audio)


# ── mix_vocal_and_instrumental ──


def test_mix_returns_stereo():
    vocal = _sine(440, 2.0)
    instrumental = _noise(2.0)
    result = mix_vocal_and_instrumental(vocal, instrumental, SR)
    assert result.ndim == 2


def test_mix_no_clipping():
    vocal = _sine(440, 2.0) * 0.8
    instrumental = _noise(2.0) * 0.8
    result = mix_vocal_and_instrumental(vocal, instrumental, SR)
    assert np.max(np.abs(result)) <= 1.0
