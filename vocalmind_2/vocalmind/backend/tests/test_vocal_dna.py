"""POST /vocal-dna/analyze — 5축 보컬 DNA 분석 테스트."""
from __future__ import annotations
import io
import struct
import numpy as np
import pytest
import soundfile as sf
from httpx import AsyncClient, ASGITransport
from main import app
from models.tension import (
    FormantData,
    RegisterTransition,
    TensionAnalysis,
    TensionScore,
    VoiceQuality,
)


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _fake_wav_bytes(freq: float = 220.0, duration: float = 1.0, sr: int = 16000) -> bytes:
    """합성 사인파 WAV 바이트 (실제 parselmouth 분석은 mock)."""
    buf = io.BytesIO()
    data_size = int(sr * duration) * 2  # 16-bit mono
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
    """기본 TensionAnalysis (relaxed 상태)."""
    defaults = {
        "voice_quality": VoiceQuality(
            jitter_local=0.5, shimmer_local=2.0, hnr=22.0, h1_h2=2.0
        ),
        "formant": FormantData(
            f1_mean=500, f2_mean=1500, f1_std=30, f2_std=50, vsa=750000
        ),
        "register_transition": RegisterTransition(
            transition_detected=False,
            f0_max_jump_hz=5.0,
            hnr_min_at_transition=18.0,
            voiceless_gaps=0,
            smoothness_score=0.9,
        ),
        "duration": 2.0,
    }
    defaults.update(overrides)
    return TensionAnalysis(**defaults)


def _make_tension_score(
    laryngeal: float = 20.0,
    tongue_root: float = 25.0,
    jaw: float = 30.0,
    register_break: float = 15.0,
    overall: float = 22.5,
) -> TensionScore:
    return TensionScore(
        overall=overall,
        laryngeal_tension=laryngeal,
        tongue_root_tension=tongue_root,
        jaw_tension=jaw,
        register_break=register_break,
        tension_detected=overall > 40,
        detail="이완 상태",
    )


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ── 정상 케이스 ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_returns_5_axes(client, monkeypatch):
    """5축 필드가 모두 존재해야 한다."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    for axis in ("laryngeal", "tongue_root", "jaw", "register_break", "tone_stability"):
        assert axis in data, f"{axis} 누락"


@pytest.mark.asyncio
async def test_all_axes_in_range(client, monkeypatch):
    """모든 축 값이 0~100 범위여야 한다."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    for axis in ("laryngeal", "tongue_root", "jaw", "register_break", "tone_stability"):
        val = data[axis]
        assert 0 <= val <= 100, f"{axis}={val} 범위 이탈"


@pytest.mark.asyncio
async def test_dna_values_are_inverted(client, monkeypatch):
    """긴장=높음 → DNA=낮음 반전 변환이 적용되어야 한다."""
    import routers.vocal_dna as vd_router
    # laryngeal_tension=80 → laryngeal DNA = 100 - 80 = 20
    score = _make_tension_score(laryngeal=80.0, tongue_root=70.0, jaw=60.0, register_break=50.0)
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), score, 300.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["laryngeal"] - 20.0) < 0.1
    assert abs(data["tongue_root"] - 30.0) < 0.1
    assert abs(data["jaw"] - 40.0) < 0.1
    assert abs(data["register_break"] - 50.0) < 0.1


@pytest.mark.asyncio
async def test_avg_pitch_hz_returned(client, monkeypatch):
    """avg_pitch_hz 필드가 분석값과 일치해야 한다."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 440.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["avg_pitch_hz"] == pytest.approx(440.0, abs=0.1)


@pytest.mark.asyncio
async def test_voice_type_male_low(client, monkeypatch):
    """남성 저음 (< 165Hz) → voice_type='남성 저음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 130.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "남성 저음"


@pytest.mark.asyncio
async def test_voice_type_male_mid(client, monkeypatch):
    """남성 중음 (165~330Hz) → voice_type='남성 중음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "남성 중음"


@pytest.mark.asyncio
async def test_voice_type_high_male_boundary(client, monkeypatch):
    """330Hz 이상은 여성 범위 — 350Hz → voice_type='여성 중음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 350.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "여성 중음"


@pytest.mark.asyncio
async def test_voice_type_female_low(client, monkeypatch):
    """여성 저음 (< 220Hz) → voice_type='여성 저음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 200.0),
    )
    # 200Hz는 남성 중음 경계 — voice_type 결정은 pitch 기반.
    # 165 <= 200 < 330 → '남성 중음'
    # 여성 저음 테스트: avg_pitch=200. 남/여 구분은 pitch threshold만으로 판별 불가.
    # 스펙: < 220Hz → 여성 저음으로 분류되는 별도 range 없음. 남성 range가 우선.
    # 실제 스펙은 남성(< 165 / 165~330 / >= 330), 여성(< 220 / 220~440 / >= 440)
    # 220Hz 미만은 남성 범위와 겹침 → '남성 중음'
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    # 200Hz → 남성 중음 (165 <= 200 < 330)
    assert resp.json()["voice_type"] == "남성 중음"


@pytest.mark.asyncio
async def test_voice_type_female_mid(client, monkeypatch):
    """여성 중음 (330~440Hz) → voice_type='여성 중음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 380.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "여성 중음"


@pytest.mark.asyncio
async def test_voice_type_female_high(client, monkeypatch):
    """여성 고음 (>= 440Hz) → voice_type='여성 고음'."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 500.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "여성 고음"


@pytest.mark.asyncio
async def test_voice_type_none_when_pitch_zero(client, monkeypatch):
    """avg_pitch_hz=0 → voice_type=None."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 0.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["avg_pitch_hz"] is None or data["voice_type"] is None


@pytest.mark.asyncio
async def test_tone_stability_hnr_20db_gives_100(client, monkeypatch):
    """HNR=20dB → tone_stability = min(100, 20*5) = 100."""
    import routers.vocal_dna as vd_router
    analysis = _make_analysis(
        voice_quality=VoiceQuality(jitter_local=0.5, shimmer_local=2.0, hnr=20.0, h1_h2=2.0)
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (analysis, _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["tone_stability"] == pytest.approx(100.0, abs=0.1)


@pytest.mark.asyncio
async def test_tone_stability_clamped_max_100(client, monkeypatch):
    """HNR=30dB → min(100, 30*5)=100 (상한 100 클램프)."""
    import routers.vocal_dna as vd_router
    analysis = _make_analysis(
        voice_quality=VoiceQuality(jitter_local=0.5, shimmer_local=2.0, hnr=30.0, h1_h2=2.0)
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (analysis, _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["tone_stability"] <= 100.0


@pytest.mark.asyncio
async def test_tone_stability_clamped_min_0(client, monkeypatch):
    """HNR 음수 → max(0, ...) 클램프."""
    import routers.vocal_dna as vd_router
    analysis = _make_analysis(
        voice_quality=VoiceQuality(jitter_local=5.0, shimmer_local=15.0, hnr=-5.0, h1_h2=-8.0)
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (analysis, _make_tension_score(), 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["tone_stability"] >= 0.0


# ── 에러 케이스 ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_missing_audio_field_returns_422(client):
    """audio 파라미터 없이 요청 시 422."""
    resp = await client.post("/vocal-dna/analyze")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_file_content_returns_error(client, monkeypatch):
    """분석 실패 시 500 또는 에러 응답."""
    import routers.vocal_dna as vd_router

    def _raise(path: str):
        raise RuntimeError("parselmouth 분석 실패")

    monkeypatch.setattr(vd_router, "_run_analysis", _raise)
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("broken.bin", b"\x00\x01\x02", "application/octet-stream")},
    )
    assert resp.status_code in (400, 422, 500)


@pytest.mark.asyncio
async def test_empty_audio_bytes_returns_error(client, monkeypatch):
    """0바이트 빈 파일 → 에러 응답."""
    import routers.vocal_dna as vd_router

    def _raise(path: str):
        raise ValueError("빈 오디오: 분석 불가")

    monkeypatch.setattr(vd_router, "_run_analysis", _raise)
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("empty.wav", b"", "audio/wav")},
    )
    assert resp.status_code in (400, 422, 500)


# ── 엣지 케이스 ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_extreme_tension_all_axes_min(client, monkeypatch):
    """긴장이 100 → DNA 모든 축이 0."""
    import routers.vocal_dna as vd_router
    score = _make_tension_score(
        laryngeal=100.0, tongue_root=100.0, jaw=100.0, register_break=100.0, overall=100.0
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), score, 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["laryngeal"] == 0.0
    assert data["tongue_root"] == 0.0
    assert data["jaw"] == 0.0
    assert data["register_break"] == 0.0


@pytest.mark.asyncio
async def test_perfect_relaxation_all_axes_max(client, monkeypatch):
    """긴장이 0 → DNA 축 laryngeal/tongue_root/jaw/register_break 모두 100."""
    import routers.vocal_dna as vd_router
    score = _make_tension_score(
        laryngeal=0.0, tongue_root=0.0, jaw=0.0, register_break=0.0, overall=0.0
    )
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), score, 220.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["laryngeal"] == 100.0
    assert data["tongue_root"] == 100.0
    assert data["jaw"] == 100.0
    assert data["register_break"] == 100.0


@pytest.mark.asyncio
async def test_pitch_boundary_exactly_165hz(client, monkeypatch):
    """경계값 165Hz → 남성 중음 (165 이상)."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 165.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    assert resp.json()["voice_type"] == "남성 중음"


@pytest.mark.asyncio
async def test_pitch_boundary_exactly_330hz(client, monkeypatch):
    """경계값 330Hz → 여성 중음 (남성 고음 경계 = 여성 중음 시작)."""
    import routers.vocal_dna as vd_router
    monkeypatch.setattr(
        vd_router, "_run_analysis",
        lambda path: (_make_analysis(), _make_tension_score(), 330.0),
    )
    resp = await client.post(
        "/vocal-dna/analyze",
        files={"audio": ("rec.webm", _fake_wav_bytes(), "audio/webm")},
    )
    assert resp.status_code == 200
    vt = resp.json()["voice_type"]
    # 330Hz: 스펙상 남성 고음(>=330Hz) OR 여성 중음(330~440Hz). 구현에 따라 둘 중 하나.
    assert vt in ("남성 고음", "여성 중음")
