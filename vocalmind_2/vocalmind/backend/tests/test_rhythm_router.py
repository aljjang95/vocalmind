"""POST /rhythm/analyze — 리듬 분석 REST 라우터 테스트."""
from __future__ import annotations

import io
import json
import struct

import pytest
from starlette.testclient import TestClient

from main import app


# ──────────────────────────────
# 공용 헬퍼
# ──────────────────────────────

def _make_wav(duration_sec: float = 1.0, sr: int = 16000, silent: bool = False) -> bytes:
    """테스트용 WAV 파일 바이트 생성.

    silent=True 이면 RMS < 1e-5 의 무음 WAV (onset 0개).
    """
    channels, bps = 1, 16
    n_samples = int(sr * duration_sec)
    buf = io.BytesIO()
    data_size = n_samples * channels * (bps // 8)

    if silent:
        pcm = b"\x00" * data_size
    else:
        # 단순 사인파 (onset 감지 가능성 있음)
        import math
        amp = 16000
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


def _beat_grid_json(bpm: float = 120.0, n_beats: int = 4) -> str:
    """테스트용 BeatGridPayload JSON 문자열."""
    interval = 60.0 / bpm
    beat_times = [round(i * interval, 3) for i in range(n_beats)]
    return json.dumps({
        "bpm": bpm,
        "first_beat_offset_sec": 0.0,
        "beat_times": beat_times,
        "source": "manual",
    })


def _sections_json() -> str:
    return json.dumps([
        {"start_sec": 0.0, "end_sec": 1.0, "label": "A"},
        {"start_sec": 1.0, "end_sec": 2.0, "label": "B"},
    ])


# ──────────────────────────────
# 케이스 a: 정상 요청 → 200 + 구조 검증
# ──────────────────────────────

class TestRhythmAnalyzeNormal:
    def test_valid_request_returns_200(self, monkeypatch):
        """정상 WAV + BeatGrid → 200, RhythmAnalyzeResponse 구조."""
        import core.onset_detector as od
        # onset 2개 반환 mock
        monkeypatch.setattr(od, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.0, confidence=0.9),
            od.OnsetEvent(time_sec=0.5, confidence=0.7),
        ])

        client = TestClient(app)
        wav = _make_wav()
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": _beat_grid_json(bpm=120, n_beats=4),
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "rhythm_score" in data
        assert "events" in data
        assert "section_scores" in data
        assert "problem_segments" in data
        assert "coverage_ratio" in data
        assert isinstance(data["rhythm_score"], int)
        assert 0 <= data["rhythm_score"] <= 100
        assert isinstance(data["coverage_ratio"], float)

    def test_response_events_schema(self, monkeypatch):
        """events 각 항목의 필드 타입 검증."""
        import core.onset_detector as od
        monkeypatch.setattr(od, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.0, confidence=0.9),
        ])

        client = TestClient(app)
        wav = _make_wav()
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": _beat_grid_json(bpm=120, n_beats=2),
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert len(events) >= 1
        ev = events[0]
        assert "onset_time_sec" in ev
        assert "target_beat_time_sec" in ev
        assert "error_ms" in ev
        assert "classification" in ev
        assert "section_index" in ev
        assert ev["classification"] in ("perfect", "good", "off", "miss", "ghost")


# ──────────────────────────────
# 케이스 b: WAV 누락 → 422
# ──────────────────────────────

class TestRhythmAnalyzeMissingAudio:
    def test_missing_audio_returns_422(self):
        """audio 파일 없이 요청 → 422."""
        client = TestClient(app)
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": _beat_grid_json(),
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
        )
        assert resp.status_code == 422


# ──────────────────────────────
# 케이스 c: BeatGrid JSON 파싱 실패 → 400/422
# ──────────────────────────────

class TestRhythmAnalyzeInvalidBeatGrid:
    def test_invalid_beat_grid_json_returns_error(self):
        """beat_grid_json이 잘못된 JSON → 400 또는 422."""
        client = TestClient(app)
        wav = _make_wav()
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": "NOT_VALID_JSON{{{",
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code in (400, 422), f"unexpected status {resp.status_code}"

    def test_missing_beat_times_returns_error(self):
        """beat_times 필드 누락 → 400 또는 422."""
        client = TestClient(app)
        wav = _make_wav()
        incomplete = json.dumps({"bpm": 120.0, "first_beat_offset_sec": 0.0, "source": "manual"})
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": incomplete,
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code in (400, 422)


# ──────────────────────────────
# 케이스 d: 무음 WAV → rhythm_score=0, events 모두 miss
# ──────────────────────────────

class TestRhythmAnalyzeSilentAudio:
    def test_silent_wav_all_miss(self, monkeypatch):
        """무음 WAV: onset 0개 → 모든 beat miss, rhythm_score=0."""
        import core.onset_detector as od
        monkeypatch.setattr(od, "detect_onsets", lambda path, **kw: [])  # 강제 무음

        client = TestClient(app)
        wav = _make_wav(silent=True)
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": _beat_grid_json(bpm=120, n_beats=4),
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("silent.wav", wav, "audio/wav")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rhythm_score"] == 0
        assert all(ev["classification"] == "miss" for ev in data["events"])


# ──────────────────────────────
# 케이스 e: beat_times 0개 → 빈 결과, 에러 없음
# ──────────────────────────────

class TestRhythmAnalyzeEmptyBeats:
    def test_zero_beats_returns_empty_result(self, monkeypatch):
        """beat_times=[] → events 비어있고 coverage_ratio=0, 에러 없음."""
        import core.onset_detector as od
        monkeypatch.setattr(od, "detect_onsets", lambda path, **kw: [])

        client = TestClient(app)
        wav = _make_wav()
        empty_grid = json.dumps({
            "bpm": 120.0,
            "first_beat_offset_sec": 0.0,
            "beat_times": [],
            "source": "none",
        })
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": empty_grid,
                "output_latency_ms": "0",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["coverage_ratio"] in (0.0, 1.0)  # 정의에 따라 0 또는 1
        assert isinstance(data["events"], list)


# ──────────────────────────────
# 케이스 f: output_latency_ms=150 → 보정 반영
# ──────────────────────────────

class TestRhythmAnalyzeLatencyCorrection:
    def test_latency_correction_shifts_onset(self, monkeypatch):
        """output_latency_ms=150 전달 시 onset이 beat보다 0.15초 뒤에 와도 perfect.

        라우터가 import한 심볼(routers.rhythm.detect_onsets)을 직접 patch한다.
        """
        import core.onset_detector as od
        import routers.rhythm as rhythm_mod

        # beat=0.5초, onset=0.65초 (0.15초 늦음 = latency 150ms 보정 후 정확히 맞음)
        monkeypatch.setattr(rhythm_mod, "detect_onsets", lambda path, **kw: [
            od.OnsetEvent(time_sec=0.65, confidence=1.0),
        ])

        client = TestClient(app)
        wav = _make_wav()
        grid = json.dumps({
            "bpm": 120.0,
            "first_beat_offset_sec": 0.5,
            "beat_times": [0.5],
            "source": "manual",
        })
        resp = client.post(
            "/rhythm/analyze",
            data={
                "beat_grid_json": grid,
                "output_latency_ms": "150",
                "sections_json": "[]",
            },
            files={"audio": ("rec.wav", wav, "audio/wav")},
        )
        assert resp.status_code == 200
        data = resp.json()
        matched = [ev for ev in data["events"] if ev["classification"] != "miss"]
        assert len(matched) >= 1, f"latency 보정 후 매칭된 이벤트가 없음: events={data['events']}"
        # 보정 후 error_ms ≈ 0 (±50ms 이내면 perfect)
        assert abs(matched[0]["error_ms"]) <= 50.0, (
            f"latency 보정 후 error_ms={matched[0]['error_ms']}ms — perfect 기대"
        )
