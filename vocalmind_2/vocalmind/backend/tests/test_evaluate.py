"""POST /evaluate — 음성 분석 + 채점 테스트."""
from __future__ import annotations
import io
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _fake_wav_bytes() -> bytes:
    """최소 WAV 헤더 (실제 분석은 mock하므로 내용 무관)."""
    buf = io.BytesIO()
    # RIFF header
    import struct
    sr, channels, bps = 16000, 1, 16
    data_size = sr * channels * (bps // 8)  # 1초
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, channels, sr, sr * channels * (bps // 8), channels * (bps // 8), bps))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(b"\x00" * data_size)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    # Phase 0 환경변수 누락 목록도 응답에 포함
    assert "status" in body
    assert "phase0_missing_env" in body
    assert isinstance(body["phase0_missing_env"], list)


@pytest.mark.asyncio
async def test_evaluate_requires_audio(client):
    """audio 파일 없이 요청하면 422."""
    resp = await client.post("/evaluate", data={"stage_id": "1", "target_pitches": "[]"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_evaluate_with_mock_audio(client, monkeypatch):
    """multipart 업로드 + mock 분석 → 정상 응답."""
    import services.audio_service as audio_svc
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7, 329.6, 349.2, 392.0],
        "avg_pitch": 325.2, "tone_stability": 88.0, "duration": 5.0,
        "tension_score": None,
    })

    wav_bytes = _fake_wav_bytes()
    resp = await client.post("/evaluate", data={
        "stage_id": "1",
        "target_pitches": "[261.6, 293.7, 329.6, 349.2, 392.0]",
    }, files={"audio": ("recording.webm", wav_bytes, "audio/webm")})

    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data and "feedback" in data
    assert 0 <= data["score"] <= 100
    assert "tension" in data
    assert data["tension"]["detected"] is False


@pytest.mark.asyncio
async def test_evaluate_with_tension_detected(client, monkeypatch):
    """tension_score가 있을 때 tension_detected가 반영되어야 한다."""
    from models.tension import TensionScore
    import services.audio_service as audio_svc
    mock_tension = TensionScore(
        overall=60.0, laryngeal_tension=65.0, tongue_root_tension=55.0,
        jaw_tension=50.0, register_break=60.0, tension_detected=True, detail="후두 긴장",
    )
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7, 329.6, 349.2, 392.0],
        "avg_pitch": 325.2, "tone_stability": 88.0, "duration": 5.0,
        "tension_score": mock_tension,
    })

    wav_bytes = _fake_wav_bytes()
    resp = await client.post("/evaluate", data={
        "stage_id": "1",
        "target_pitches": "[261.6, 293.7, 329.6, 349.2, 392.0]",
    }, files={"audio": ("recording.webm", wav_bytes, "audio/webm")})

    assert resp.status_code == 200
    data = resp.json()
    assert data["tension_detected"] is True
    assert data["tension"]["detected"] is True
    assert "후두 긴장" in data["tension"]["detail"]


@pytest.mark.asyncio
async def test_scale_practice_beginner(client, monkeypatch):
    """3단계 채점: 초급(stage 3)은 긴장도만으로 채점."""
    import services.audio_service as audio_svc
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7],
        "avg_pitch": 277.0, "tone_stability": 70.0, "duration": 3.0,
        "tension_score": None,
    })
    wav_bytes = _fake_wav_bytes()
    resp = await client.post("/evaluate/scale-practice", data={
        "stage_id": "3",
        "target_pitches": "[261.6, 293.7]",
    }, files={"audio": ("rec.webm", wav_bytes, "audio/webm")})

    assert resp.status_code == 200
    data = resp.json()
    assert data["level"] == "beginner"
    assert "score" in data
    assert "passed" in data
    assert "feedback_hint" in data


@pytest.mark.asyncio
async def test_scale_practice_with_tension(client, monkeypatch):
    """3단계 채점: 긴장 감지 시 긴장도 반영."""
    from models.tension import TensionScore
    import services.audio_service as audio_svc
    mock_tension = TensionScore(
        overall=55.0, laryngeal_tension=60.0, tongue_root_tension=50.0,
        jaw_tension=40.0, register_break=50.0, tension_detected=True, detail="후두 긴장",
    )
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6],
        "avg_pitch": 261.6, "tone_stability": 80.0, "duration": 2.0,
        "tension_score": mock_tension,
    })
    wav_bytes = _fake_wav_bytes()
    resp = await client.post("/evaluate/scale-practice", data={
        "stage_id": "5",
        "target_pitches": "[261.6]",
    }, files={"audio": ("rec.webm", wav_bytes, "audio/webm")})

    assert resp.status_code == 200
    data = resp.json()
    assert data["tension_overall"] == 55.0
    assert data["passed"] is False  # 긴장도 55 > 45 → 불통과


@pytest.mark.asyncio
async def test_scale_practice_requires_audio(client):
    """audio 없이 요청 시 422."""
    resp = await client.post("/evaluate/scale-practice", data={
        "stage_id": "1", "target_pitches": "[]",
    })
    assert resp.status_code == 422
