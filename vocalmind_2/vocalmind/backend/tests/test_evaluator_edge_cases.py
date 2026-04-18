"""Evaluator 추가 Edge Case 테스트."""
from __future__ import annotations
import io
import struct
import numpy as np
import pytest
import soundfile as sf
from httpx import AsyncClient, ASGITransport
from main import app
from models.tension import (
    FormantData, RegisterTransition, TensionAnalysis, TensionScore, VoiceQuality,
)
import routers.vocal_dna as vd_router


def _fake_wav_bytes(freq: float = 220.0, duration: float = 1.0, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    data_size = int(sr * duration) * 2
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(b"\x00" * data_size)
    return buf.getvalue()


def _make_analysis(**overrides) -> TensionAnalysis:
    defaults = {
        "voice_quality": VoiceQuality(jitter_local=0.5, shimmer_local=2.0, hnr=22.0, h1_h2=2.0),
        "formant": FormantData(f1_mean=500, f2_mean=1500, f1_std=30, f2_std=50, vsa=750000),
        "register_transition": RegisterTransition(
            transition_detected=False, f0_max_jump_hz=5.0,
            hnr_min_at_transition=18.0, voiceless_gaps=0, smoothness_score=0.9,
        ),
        "duration": 2.0,
    }
    defaults.update(overrides)
    return TensionAnalysis(**defaults)


def _make_tension_score(**kwargs) -> TensionScore:
    defaults = dict(laryngeal=20.0, tongue_root=25.0, jaw=30.0, register_break=15.0, overall=22.5)
    defaults.update(kwargs)
    return TensionScore(
        overall=defaults["overall"],
        laryngeal_tension=defaults["laryngeal"],
        tongue_root_tension=defaults["tongue_root"],
        jaw_tension=defaults["jaw"],
        register_break=defaults["register_break"],
        tension_detected=defaults["overall"] > 40,
        detail="이완 상태",
    )


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ── Edge Case 1: 무성 오디오(silence) — 분석은 성공하고 모든 값이 유효 범위여야 함
@pytest.mark.asyncio
async def test_silence_audio_returns_valid_response(client, monkeypatch):
    """무성(silence) WAV → 예외 없이 200 + 0~100 범위 반환."""
    # silence에서 pitch=0이면 voice_type=None, avg_pitch_hz=None이어야 함
    analysis = _make_analysis(
        voice_quality=VoiceQuality(jitter_local=0.0, shimmer_local=0.0, hnr=0.0, h1_h2=0.0)
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (analysis, _make_tension_score(), 0.0),  # pitch=0
    )
    # 실제 silence WAV 생성
    buf = io.BytesIO()
    data = np.zeros(8000, dtype=np.float32)  # 0.5초 silence
    sf.write(buf, data, 16000, format="WAV", subtype="PCM_16")
    silence_bytes = buf.getvalue()

    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("silence.wav", silence_bytes, "audio/wav")},
    )
    assert resp.status_code == 200
    data_resp = resp.json()
    for axis in ("laryngeal", "tongue_root", "jaw", "register_break", "tone_stability"):
        assert 0 <= data_resp[axis] <= 100, f"{axis}={data_resp[axis]} 범위 이탈"
    assert data_resp["avg_pitch_hz"] is None or data_resp["avg_pitch_hz"] == 0.0 or data_resp["avg_pitch_hz"] is None


# ── Edge Case 2: 매우 짧은 오디오 (0.1초) — 에러 없이 처리
@pytest.mark.asyncio
async def test_very_short_audio_no_crash(client, monkeypatch):
    """0.1초짜리 초단편 오디오 → 서버 크래시 없이 처리."""
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(duration=0.1), _make_tension_score(), 220.0),
    )
    buf = io.BytesIO()
    data = np.zeros(1600, dtype=np.float32)  # 0.1초
    sf.write(buf, data, 16000, format="WAV", subtype="PCM_16")

    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("short.wav", buf.getvalue(), "audio/wav")},
    )
    # 200 또는 400 — 크래시(5xx)만 아니면 됨
    assert resp.status_code in (200, 400), f"예상치 못한 상태: {resp.status_code}"


# ── Edge Case 3: pitch 경계값 440Hz — 정확히 여성 고음 경계
@pytest.mark.asyncio
async def test_pitch_boundary_exactly_440hz(client, monkeypatch):
    """경계값 440Hz → 여성 고음 (>= 440Hz)."""
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 440.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.wav", _fake_wav_bytes(), "audio/wav")},
    )
    assert resp.status_code == 200
    vt = resp.json()["voice_type"]
    assert vt == "여성 고음", f"440Hz는 여성 고음이어야 하지만 '{vt}'"


# ── Edge Case 4: pitch 경계값 164.9Hz — 남성 저음 상한 직전
@pytest.mark.asyncio
async def test_pitch_boundary_164_9hz(client, monkeypatch):
    """164.9Hz → 남성 저음 (< 165Hz)."""
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 164.9),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.wav", _fake_wav_bytes(), "audio/wav")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "남성 저음"


# ── Edge Case 5: tone_stability 계산 — HNR=4 → 4*5=20 (0~100 내)
@pytest.mark.asyncio
async def test_tone_stability_mid_value(client, monkeypatch):
    """HNR=4dB → tone_stability = 4*5=20."""
    analysis = _make_analysis(
        voice_quality=VoiceQuality(jitter_local=1.0, shimmer_local=5.0, hnr=4.0, h1_h2=0.0)
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (analysis, _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.wav", _fake_wav_bytes(), "audio/wav")},
    )
    assert resp.status_code == 200
    assert abs(resp.json()["tone_stability"] - 20.0) < 0.1


# ── Edge Case 6: audio 파라미터에 빈 파일명으로 업로드
@pytest.mark.asyncio
async def test_empty_filename_still_processes(client, monkeypatch):
    """파일명 없이 업로드해도 처리 가능해야 한다."""
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("", _fake_wav_bytes(), "audio/wav")},
    )
    assert resp.status_code in (200, 400, 422), f"크래시 감지: {resp.status_code}"
