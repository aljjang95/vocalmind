"""온보딩 API 테스트."""
from __future__ import annotations
import io
import struct
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from main import app
from models.tension import TensionScore


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def _fake_wav_bytes() -> bytes:
    """최소 WAV 헤더 (실제 분석은 mock하므로 내용 무관)."""
    buf = io.BytesIO()
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


def _mock_tension_score(overall: float = 50.0) -> TensionScore:
    return TensionScore(
        overall=overall,
        laryngeal_tension=55.0,
        tongue_root_tension=45.0,
        jaw_tension=40.0,
        register_break=30.0,
        tension_detected=overall > 40,
        detail="후두 긴장이 감지됨",
    )


@pytest.mark.asyncio
async def test_onboarding_analyze_success(client, monkeypatch):
    """POST /onboarding/analyze — 정상 WAV 파일 -> 200 + 응답 구조 확인."""
    import services.audio_service as audio_svc
    mock_tension = _mock_tension_score(50.0)
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7],
        "avg_pitch": 277.0,
        "tone_stability": 80.0,
        "duration": 3.0,
        "tension_score": mock_tension,
    })

    mock_consultation = {
        "problems": ["후두 긴장이 높습니다"],
        "roadmap": ["1단계: 이완 기초부터 시작"],
        "suggested_stage_id": 1,
        "summary": "전반적인 긴장도가 높은 편이에요.",
    }
    with patch("routers.onboarding.generate_consultation", new_callable=AsyncMock, return_value=mock_consultation):
        wav_bytes = _fake_wav_bytes()
        resp = await client.post(
            "/onboarding/analyze",
            files={"audio": ("recording.wav", wav_bytes, "audio/wav")},
        )

    assert resp.status_code == 200
    data = resp.json()
    # tension 구조 확인
    assert "tension" in data
    tension = data["tension"]
    assert "overall" in tension
    assert "laryngeal" in tension
    assert "tongue_root" in tension
    assert "jaw" in tension
    assert "register_break" in tension
    assert "detail" in tension
    # consultation 구조 확인
    assert "consultation" in data
    consultation = data["consultation"]
    assert "problems" in consultation
    assert "roadmap" in consultation
    assert "suggested_stage_id" in consultation
    assert "summary" in consultation
    assert isinstance(consultation["problems"], list)
    assert isinstance(consultation["roadmap"], list)
    assert isinstance(consultation["suggested_stage_id"], int)


@pytest.mark.asyncio
async def test_onboarding_analyze_no_audio(client):
    """POST /onboarding/analyze — 오디오 없이 -> 422."""
    resp = await client.post("/onboarding/analyze")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_onboarding_tts_success(client):
    """POST /onboarding/tts — 정상 텍스트 -> 200 + audio/mpeg."""
    with patch("routers.onboarding.synthesize_feedback", new_callable=AsyncMock, return_value=b"\xff\xfb\x90\x00"):
        resp = await client.post("/onboarding/tts", json={"text": "안녕하세요"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert len(resp.content) > 0


@pytest.mark.asyncio
async def test_onboarding_tts_empty_text(client):
    """POST /onboarding/tts — 빈 텍스트 -> 400."""
    resp = await client.post("/onboarding/tts", json={"text": ""})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_generate_consultation_returns_dict():
    """onboarding_service.generate_consultation() — TensionScore -> dict 반환."""
    with patch("services.onboarding_service.ai") as mock_ai:
        mock_ai.complete_json.return_value = {
            "problems": ["후두 긴장"],
            "roadmap": ["1단계부터"],
            "suggested_stage_id": 1,
            "summary": "긴장도가 높아요.",
        }

        from services.onboarding_service import generate_consultation
        tension = _mock_tension_score(65.0)
        result = await generate_consultation(tension)

    assert isinstance(result, dict)
    assert "problems" in result
    assert "roadmap" in result
    assert "suggested_stage_id" in result
    assert "summary" in result
    assert isinstance(result["problems"], list)
    assert isinstance(result["suggested_stage_id"], int)


@pytest.mark.asyncio
async def test_audio_utils_convert_to_wav():
    """audio_utils.convert_to_wav — subprocess.run 호출 확인 (모킹)."""
    from pathlib import Path
    with patch("services.audio_utils.subprocess.run") as mock_run:
        from services.audio_utils import convert_to_wav
        convert_to_wav(Path("/tmp/input.webm"), Path("/tmp/output.wav"))

    mock_run.assert_called_once()
    args = mock_run.call_args
    cmd = args[0][0]
    assert cmd[0] == "ffmpeg"
    assert "-ar" in cmd
    assert "16000" in cmd
    assert "-ac" in cmd
    assert "1" in cmd


# ─── _fallback_consultation 직접 테스트 ─────────────────────────


class TestFallbackConsultation:
    """onboarding_service._fallback_consultation 템플릿 로직 테스트."""

    def _make_score(self, overall, laryngeal=20.0, tongue=20.0, jaw=20.0, register=20.0):
        return TensionScore(
            overall=overall,
            laryngeal_tension=laryngeal,
            tongue_root_tension=tongue,
            jaw_tension=jaw,
            register_break=register,
            tension_detected=overall > 40,
            detail="테스트",
        )

    def test_high_tension_suggests_stage_1(self):
        """overall > 60 → stage 1, 3개 roadmap."""
        from services.onboarding_service import _fallback_consultation
        result = _fallback_consultation(self._make_score(75.0, laryngeal=70.0))
        assert result["suggested_stage_id"] == 1
        assert len(result["roadmap"]) == 3
        assert "이완" in result["summary"]

    def test_mid_tension_suggests_stage_7(self):
        """overall 30~60 → stage 7."""
        from services.onboarding_service import _fallback_consultation
        result = _fallback_consultation(self._make_score(45.0))
        assert result["suggested_stage_id"] == 7
        assert len(result["roadmap"]) == 3

    def test_low_tension_suggests_stage_11(self):
        """overall < 30 → stage 11."""
        from services.onboarding_service import _fallback_consultation
        result = _fallback_consultation(self._make_score(20.0))
        assert result["suggested_stage_id"] == 11
        assert len(result["roadmap"]) == 3
        assert "공명" in result["summary"]

    def test_all_axes_low_shows_stable_message(self):
        """모든 긴장 축 <= 50 → '전반적으로 안정적' 포함."""
        from services.onboarding_service import _fallback_consultation
        result = _fallback_consultation(self._make_score(25.0, 30.0, 40.0, 50.0, 20.0))
        assert any("안정적" in p for p in result["problems"])

    def test_all_axes_high_shows_4_problems(self):
        """모든 긴장 축 > 50 → 4개 문제점."""
        from services.onboarding_service import _fallback_consultation
        result = _fallback_consultation(self._make_score(80.0, 70.0, 65.0, 60.0, 55.0))
        assert len(result["problems"]) == 4
        # 각 부위 관련 키워드 확인
        text = " ".join(result["problems"])
        assert "후두" in text
        assert "혀뿌리" in text
        assert "턱" in text
        assert "성구" in text


class TestGenerateConsultationFallback:
    """generate_consultation Claude 실패 시 폴백 호출 확인."""

    @pytest.mark.asyncio
    async def test_api_error_triggers_fallback(self):
        """Claude APIError 시 _fallback_consultation 호출."""
        with patch("services.onboarding_service.ai") as mock_ai:
            mock_ai.complete_json.side_effect = Exception("rate limited")

            from services.onboarding_service import generate_consultation
            tension = TensionScore(
                overall=70.0,
                laryngeal_tension=60.0,
                tongue_root_tension=55.0,
                jaw_tension=50.0,
                register_break=45.0,
                tension_detected=True,
                detail="테스트",
            )
            result = await generate_consultation(tension)

        # 폴백이 호출되어 stage 1 반환
        assert result["suggested_stage_id"] == 1
        assert isinstance(result["problems"], list)
        assert isinstance(result["roadmap"], list)

    @pytest.mark.asyncio
    async def test_invalid_json_triggers_fallback(self):
        """Claude가 필수 필드 없는 JSON 반환 시 폴백 호출."""
        with patch("services.onboarding_service.ai") as mock_ai:
            # complete_json이 None 반환 (필수 필드 누락)
            mock_ai.complete_json.return_value = None

            from services.onboarding_service import generate_consultation
            tension = TensionScore(
                overall=20.0,
                laryngeal_tension=15.0,
                tongue_root_tension=10.0,
                jaw_tension=10.0,
                register_break=10.0,
                tension_detected=False,
                detail="",
            )
            result = await generate_consultation(tension)

        # 필수 필드 누락 → 폴백 (stage 11)
        assert result["suggested_stage_id"] == 11
        assert "summary" in result
