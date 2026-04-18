"""WebSocket /ws/rhythm — 리듬 실시간 분석 테스트."""
from __future__ import annotations

import io
import json
import math
import struct

from starlette.testclient import TestClient

from main import app


# ──────────────────────────────
# 공용 헬퍼
# ──────────────────────────────

def _make_wav(duration_sec: float = 1.0, sr: int = 16000, silent: bool = False) -> bytes:
    """테스트용 WAV 파일 바이트 생성."""
    channels, bps = 1, 16
    n_samples = int(sr * duration_sec)
    buf = io.BytesIO()
    data_size = n_samples * channels * (bps // 8)

    if silent:
        pcm = b"\x00" * data_size
    else:
        amp = 8000
        pcm = b""
        for i in range(n_samples):
            val = int(amp * math.sin(2 * math.pi * 440 * i / sr))
            pcm += struct.pack("<h", val)

    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, channels, sr, sr * channels * (bps // 8), channels * (bps // 8), bps))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm)
    return buf.getvalue()


def _start_msg(n_beats: int = 4, bpm: float = 120.0) -> str:
    """start 제어 메시지 JSON 문자열."""
    interval = 60.0 / bpm
    beat_times = [round(i * interval, 3) for i in range(n_beats)]
    return json.dumps({
        "type": "start",
        "beat_grid": {
            "bpm": bpm,
            "first_beat_offset_sec": 0.0,
            "beat_times": beat_times,
            "source": "manual",
        },
        "output_latency_ms": 0,
        "sections": [],
    })


# ──────────────────────────────
# 케이스 a: Connect → 성공
# ──────────────────────────────

class TestWsRhythmConnect:
    def test_connect_success(self):
        """토큰 포함 연결 성공."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test_token") as ws:
            ws.send_text(json.dumps({"type": "end"}))
            resp = ws.receive_json()
            # beat_grid 없이 end → error 응답
            assert resp["type"] == "error"

    def test_connect_without_token(self):
        """토큰 없이도 연결 가능 (경고만)."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm") as ws:
            ws.send_text(json.dumps({"type": "end"}))
            resp = ws.receive_json()
            assert resp["type"] == "error"  # beat_grid 없음


# ──────────────────────────────
# 케이스 b: start → ready 응답
# ──────────────────────────────

class TestWsRhythmStart:
    def test_start_returns_ready(self):
        """start 메시지 전송 → {"type":"ready"} 응답."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(_start_msg())
            resp = ws.receive_json()
            assert resp["type"] == "ready"

    def test_start_without_beat_grid_returns_error(self):
        """beat_grid 없는 start → error 응답."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(json.dumps({"type": "start"}))
            resp = ws.receive_json()
            assert resp["type"] == "error"
            assert "beat_grid" in resp["message"].lower() or "없" in resp["message"]


# ──────────────────────────────
# 케이스 c: binary chunk → onsets 응답
# ──────────────────────────────

class TestWsRhythmChunks:
    def test_binary_chunk_returns_onsets(self, monkeypatch):
        """바이너리 청크 수신 → {"type":"onsets", ...} 응답."""
        import core.onset_detector as od
        import routers.ws_rhythm as ws_mod

        monkeypatch.setattr(ws_mod, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.1, confidence=0.9),
        ])

        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(_start_msg(n_beats=4, bpm=120))
            ws.receive_json()  # ready

            wav = _make_wav(duration_sec=1.0)
            ws.send_bytes(wav)
            resp = ws.receive_json()

            assert resp["type"] == "onsets"
            assert "events" in resp
            assert "chunk_start_sec" in resp
            assert isinstance(resp["events"], list)

    def test_multiple_chunks_accumulate(self, monkeypatch):
        """청크 2회 → 두 번째 onsets의 chunk_start_sec > 0."""
        import core.onset_detector as od
        import routers.ws_rhythm as ws_mod

        monkeypatch.setattr(ws_mod, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.0, confidence=0.8),
        ])

        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(_start_msg(n_beats=8, bpm=120))
            ws.receive_json()  # ready

            wav = _make_wav(duration_sec=2.0)

            ws.send_bytes(wav)
            resp1 = ws.receive_json()
            assert resp1["type"] == "onsets"
            assert resp1["chunk_start_sec"] == 0.0

            ws.send_bytes(wav)
            resp2 = ws.receive_json()
            assert resp2["type"] == "onsets"
            # 두 번째 청크는 첫 번째 청크 duration 이후 시작
            assert resp2["chunk_start_sec"] > 0.0


# ──────────────────────────────
# 케이스 d: end → report 응답
# ──────────────────────────────

class TestWsRhythmEnd:
    def test_end_returns_report(self, monkeypatch):
        """start → 청크 2개 → end → report 응답."""
        import core.onset_detector as od
        import routers.ws_rhythm as ws_mod

        monkeypatch.setattr(ws_mod, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.0, confidence=1.0),
            od.OnsetEvent(time_sec=0.5, confidence=0.8),
        ])

        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(_start_msg(n_beats=4, bpm=120))
            ws.receive_json()  # ready

            wav = _make_wav(duration_sec=1.0)
            ws.send_bytes(wav)
            ws.receive_json()  # onsets
            ws.send_bytes(wav)
            ws.receive_json()  # onsets

            ws.send_text(json.dumps({"type": "end"}))
            report = ws.receive_json()

            assert report["type"] == "report"
            assert "rhythm_score" in report
            assert "section_scores" in report
            assert "problem_segments" in report
            assert "coverage_ratio" in report
            assert 0 <= report["rhythm_score"] <= 100
            assert isinstance(report["coverage_ratio"], float)

    def test_end_without_start_returns_error(self):
        """start 없이 end → error 응답."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            ws.send_text(json.dumps({"type": "end"}))
            resp = ws.receive_json()
            assert resp["type"] == "error"


# ──────────────────────────────
# 케이스 e: 잘못된 JSON 텍스트 → error + 연결 유지
# ──────────────────────────────

class TestWsRhythmBadJson:
    def test_bad_json_returns_error_connection_alive(self):
        """잘못된 JSON 텍스트 → error 응답 + 연결 유지 후 정상 흐름 가능."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            # 잘못된 JSON 전송
            ws.send_text("NOT_VALID_JSON{{{{")
            err = ws.receive_json()
            assert err["type"] == "error"
            assert "json" in err["message"].lower() or "형식" in err["message"]

            # 이후 정상 start가 가능해야 함 (연결 유지 확인)
            ws.send_text(_start_msg())
            ready = ws.receive_json()
            assert ready["type"] == "ready"


# ──────────────────────────────
# 케이스 f: beat_grid 없이 start → error
# ──────────────────────────────

class TestWsRhythmNoBeatGrid:
    def test_chunk_before_start_returns_error(self):
        """start 없이 청크 전송 → error 응답."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            wav = _make_wav()
            ws.send_bytes(wav)
            resp = ws.receive_json()
            assert resp["type"] == "error"
            assert "start" in resp["message"].lower() or "없" in resp["message"]

    def test_invalid_beat_grid_in_start_returns_error(self):
        """start 메시지에 잘못된 beat_grid → error, 연결 유지."""
        client = TestClient(app)
        with client.websocket_connect("/ws/rhythm?token=test") as ws:
            bad_start = json.dumps({
                "type": "start",
                "beat_grid": {"bpm": "not_a_number"},  # 잘못된 타입
                "output_latency_ms": 0,
                "sections": [],
            })
            ws.send_text(bad_start)
            resp = ws.receive_json()
            assert resp["type"] == "error"
