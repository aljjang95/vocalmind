"""WebSocket /ws/scale-practice 테스트."""
from __future__ import annotations
import json
from starlette.testclient import TestClient
from main import app
from models.tension import TensionScore


class TestWsScale:
    def test_start_end_quiet(self):
        """quiet 모드: start → end → 리포트."""
        client = TestClient(app)
        with client.websocket_connect("/ws/scale-practice") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1, "feedback_mode": "quiet"}))
            resp = ws.receive_json()
            assert resp["type"] == "started"
            assert resp["stage_id"] == 1

            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            assert "summary" in report

    def test_gentle_sends_analysis(self, monkeypatch):
        """gentle 모드: 청크 전송 시 analysis 응답."""
        mock_score = TensionScore(
            overall=45.0, laryngeal_tension=55.0, tongue_root_tension=30.0,
            jaw_tension=20.0, register_break=40.0, tension_detected=True, detail="후두 긴장",
        )
        import routers.ws_scale as ws_mod
        monkeypatch.setattr(ws_mod, "convert_chunk_to_wav", lambda d, t: t / "m.wav")
        monkeypatch.setattr(ws_mod, "analyze_chunk", lambda p: mock_score)

        client = TestClient(app)
        with client.websocket_connect("/ws/scale-practice") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1, "feedback_mode": "gentle"}))
            ws.receive_json()  # started

            ws.send_bytes(b"\x00" * 100)
            result = ws.receive_json()
            assert result["type"] == "analysis"
            assert result["tension"]["detected"] is True
            assert len(result["feedback"]) > 0

            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            assert report["stats"]["chunk_count"] == 1

    def test_quiet_skips_analysis(self, monkeypatch):
        """quiet 모드: 청크 전송해도 analysis 안 옴 → end 시 리포트만."""
        mock_score = TensionScore(
            overall=20.0, laryngeal_tension=15.0, tongue_root_tension=10.0,
            jaw_tension=10.0, register_break=10.0, tension_detected=False, detail="이완",
        )
        import routers.ws_scale as ws_mod
        monkeypatch.setattr(ws_mod, "convert_chunk_to_wav", lambda d, t: t / "m.wav")
        monkeypatch.setattr(ws_mod, "analyze_chunk", lambda p: mock_score)

        client = TestClient(app)
        with client.websocket_connect("/ws/scale-practice") as ws:
            ws.send_text(json.dumps({"type": "start", "stage_id": 1, "feedback_mode": "quiet"}))
            ws.receive_json()  # started

            ws.send_bytes(b"\x00" * 100)
            # quiet 모드에서는 analysis가 오지 않음 → 바로 end
            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()
            assert report["type"] == "report"
            # 분석은 수행했으므로 chunk_count > 0
            assert report["stats"]["chunk_count"] == 1
