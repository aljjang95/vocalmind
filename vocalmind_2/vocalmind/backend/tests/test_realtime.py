"""실시간 분석 서비스 + WebSocket 테스트."""
from __future__ import annotations
import json
from unittest.mock import MagicMock, patch
from starlette.testclient import TestClient
from main import app
from models.tension import TensionScore
from services.realtime_analyzer import (
    SessionAccumulator,
    get_somatic_feedback,
)


# ── 유닛 테스트: SessionAccumulator ──────────────────────────────────────────

class TestSessionAccumulator:
    def test_empty_session(self):
        session = SessionAccumulator(stage_id=1)
        stats = session.summary_stats()
        assert stats["chunk_count"] == 0
        assert stats["avg_tension"] == 0

    def test_add_scores(self):
        session = SessionAccumulator(stage_id=1)
        score = TensionScore(
            overall=45.0, laryngeal_tension=55.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=40.0, tension_detected=True, detail="후두 긴장",
        )
        session.add(score, "피드백")
        assert session.chunk_count == 1
        stats = session.summary_stats()
        assert stats["avg_tension"] == 45.0
        assert stats["tension_events"] == 1
        assert "후두" in stats["main_issues"]

    def test_multiple_scores(self):
        session = SessionAccumulator(stage_id=1)
        for overall in [30.0, 50.0, 70.0]:
            score = TensionScore(
                overall=overall, laryngeal_tension=overall, tongue_root_tension=20.0,
                jaw_tension=20.0, register_break=20.0,
                tension_detected=overall > 40, detail="후두 긴장" if overall > 40 else "이완",
            )
            session.add(score, "fb")
        stats = session.summary_stats()
        assert stats["chunk_count"] == 3
        assert stats["avg_tension"] == 50.0
        assert stats["max_tension"] == 70.0
        assert stats["min_tension"] == 30.0

    def test_pitch_history_accumulates(self):
        """피치 있는 청크는 pitch_history에 누적, 0Hz는 스킵."""
        session = SessionAccumulator(stage_id=7)
        score = TensionScore(
            overall=30.0, laryngeal_tension=20.0, tongue_root_tension=20.0,
            jaw_tension=20.0, register_break=20.0, tension_detected=False, detail="이완",
        )
        session.add(score, "fb", pitch=261.6)
        session.add(score, "fb", pitch=0.0)       # 무성 — 스킵
        session.add(score, "fb", pitch=329.6)
        session.add(score, "fb")                   # 기본값 0.0 → 스킵
        stats = session.summary_stats()
        assert stats["chunk_count"] == 4
        assert stats["pitch_history"] == [261.6, 329.6]
        assert stats["voiced_ratio"] == 0.5

    def test_main_issues_multiple_areas(self):
        """여러 긴장 부위가 혼재할 때 빈도 순 정렬."""
        session = SessionAccumulator(stage_id=1)
        # 후두 3회, 턱 2회, 혀뿌리 1회
        configs = [
            (60, 30, 60, 30),  # 후두+턱
            (70, 60, 55, 30),  # 후두+혀뿌리+턱
            (55, 30, 30, 60),  # 후두+성구전환
        ]
        for lar, tongue, jaw, reg in configs:
            score = TensionScore(
                overall=60.0, laryngeal_tension=lar, tongue_root_tension=tongue,
                jaw_tension=jaw, register_break=reg,
                tension_detected=True, detail="",
            )
            session.add(score, "fb")
        stats = session.summary_stats()
        issues = stats["main_issues"]
        assert issues[0] == "후두"  # 3회로 가장 많음
        assert len(issues) <= 3


# ── 유닛 테스트: 감각 피드백 템플릿 ──────────────────────────────────────────

class TestSomaticFeedback:
    def test_relaxed_feedback(self):
        score = TensionScore(
            overall=20.0, laryngeal_tension=15.0, tongue_root_tension=10.0,
            jaw_tension=10.0, register_break=10.0, tension_detected=False, detail="이완",
        )
        fb = get_somatic_feedback(score, 0)
        assert len(fb) > 0

    def test_laryngeal_tension_feedback(self):
        score = TensionScore(
            overall=65.0, laryngeal_tension=80.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=30.0, tension_detected=True, detail="후두 긴장",
        )
        fb = get_somatic_feedback(score, 0)
        assert "목" in fb or "하품" in fb or "숨" in fb

    def test_tongue_root_tension_feedback(self):
        score = TensionScore(
            overall=60.0, laryngeal_tension=30.0, tongue_root_tension=80.0,
            jaw_tension=20.0, register_break=20.0, tension_detected=True, detail="혀뿌리 긴장",
        )
        fb = get_somatic_feedback(score, 0)
        assert "혀" in fb or "공간" in fb

    def test_feedback_rotates(self):
        score = TensionScore(
            overall=65.0, laryngeal_tension=80.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=30.0, tension_detected=True, detail="후두 긴장",
        )
        fb0 = get_somatic_feedback(score, 0)
        fb1 = get_somatic_feedback(score, 1)
        fb2 = get_somatic_feedback(score, 2)
        # 3개 템플릿이 순환
        assert fb0 != fb1 or fb1 != fb2


# ── WebSocket 통합 테스트 ────────────────────────────────────────────────────

class TestWebSocket:
    def test_ws_start_end_no_audio(self):
        """오디오 없이 start→end → 빈 리포트 받기."""
        client = TestClient(app)
        with client.websocket_connect("/ws/evaluate") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1}))
            resp = ws.receive_json()
            assert resp["type"] == "started"
            assert resp["stage_id"] == 1

            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            assert "summary" in report
            assert report["stats"]["chunk_count"] == 0

    def test_ws_binary_with_mock(self, monkeypatch):
        """mock 분석으로 바이너리 청크 전송 테스트."""
        mock_score = TensionScore(
            overall=45.0, laryngeal_tension=55.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=40.0, tension_detected=True, detail="후두 긴장",
        )
        import routers.ws_evaluate as ws_mod
        monkeypatch.setattr(ws_mod, "convert_chunk_to_wav", lambda data, tmp: tmp / "mock.wav")
        monkeypatch.setattr(ws_mod, "analyze_chunk", lambda path: mock_score)

        client = TestClient(app)
        with client.websocket_connect("/ws/evaluate") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1}))
            ws.receive_json()  # started

            # 가짜 바이너리 청크 전송
            ws.send_bytes(b"\x00" * 100)
            result = ws.receive_json()
            assert result["type"] == "analysis"
            assert result["tension"]["overall"] == 45.0
            assert result["tension"]["detected"] is True
            assert len(result["feedback"]) > 0

            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            assert report["stats"]["chunk_count"] == 1

    def test_ws_empty_bytes_skipped(self, monkeypatch):
        """빈 바이너리 청크는 무시되고 분석 메시지를 보내지 않는다 (line 62 커버)."""
        client = TestClient(app)
        with client.websocket_connect("/ws/evaluate") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1}))
            ws.receive_json()  # started

            # 빈 바이트 전송 — continue 분기 실행
            ws.send_bytes(b"")

            # 세션 종료 → 리포트만 받아야 함 (빈 청크는 무시됨)
            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            assert report["stats"]["chunk_count"] == 0  # 빈 청크 처리 안 됨


# ── 세션 리포트 (Claude API mock) ────────────────────────────────────────────

class TestSessionReport:
    """generate_session_report 함수 테스트."""

    def test_empty_session_returns_fallback(self):
        """청크 없는 세션 → 폴백 응답 반환."""
        from services.session_report import generate_session_report
        session = SessionAccumulator(stage_id=1)
        report = generate_session_report(session)
        assert "summary" in report
        assert "녹음" in report["summary"]

    def test_claude_success_path(self):
        """Claude API 성공 시 JSON 파싱."""
        from services.session_report import generate_session_report

        session = SessionAccumulator(stage_id=2)
        score = TensionScore(
            overall=45.0, laryngeal_tension=55.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=40.0, tension_detected=True, detail="후두 긴장",
        )
        session.add(score, "피드백1")
        session.add(score, "피드백2")
        session.add(score, "피드백3")

        mock_result = {
            "summary": "세션 잘 됐어요",
            "improvements": "좋아졌어요",
            "focus_area": "후두 이완",
            "exercise": "허밍",
            "encouragement": "수고했어요",
        }

        with patch("services.session_report.ai") as mock_ai:
            mock_ai.complete_json.return_value = mock_result
            report = generate_session_report(session)

        assert report["summary"] == "세션 잘 됐어요"
        assert report["improvements"] == "좋아졌어요"
        assert report["focus_area"] == "후두 이완"

    def test_claude_failure_uses_fallback(self):
        """Claude API 실패 시 폴백 템플릿 반환."""
        from services.session_report import generate_session_report

        session = SessionAccumulator(stage_id=3)
        score = TensionScore(
            overall=30.0, laryngeal_tension=35.0, tongue_root_tension=25.0,
            jaw_tension=20.0, register_break=30.0, tension_detected=False, detail="이완",
        )
        session.add(score, "fb")

        with patch("services.session_report.ai") as mock_ai:
            mock_ai.complete_json.side_effect = Exception("API error")
            report = generate_session_report(session)

        assert "summary" in report
        assert "1구간" in report["summary"]
