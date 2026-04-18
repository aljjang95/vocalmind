"""POST /breath/analyze 라우터 테스트."""
from __future__ import annotations

import io
import math
import struct

import numpy as np
import pytest
from starlette.testclient import TestClient

from main import app


def _make_wav_bytes(duration_sec: float = 10.0, sr: int = 16000, cycles: int = 3) -> bytes:
    """흡기 800ms + 호기 2s 반복 WAV."""
    parts: list[np.ndarray] = [np.zeros(int(sr * 0.8), dtype=np.float32)]
    for _ in range(cycles):
        n_exhale = int(sr * 2.0)
        t = np.arange(n_exhale) / sr
        parts.append((0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32))
        parts.append(np.zeros(int(sr * 0.8), dtype=np.float32))
    audio = np.concatenate(parts)

    # WAV 직렬화
    pcm = (audio * 32767).astype(np.int16).tobytes()
    buf = io.BytesIO()
    data_size = len(pcm)
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm)
    return buf.getvalue()


class TestBreathAnalyzeRouter:
    def test_valid_wav_returns_200(self):
        client = TestClient(app)
        wav = _make_wav_bytes()
        resp = client.post(
            "/breath/analyze",
            files={"audio": ("breath.wav", wav, "audio/wav")},
            data={"target_exhale_sec": "2.0"},
        )
        assert resp.status_code == 200, resp.text

    def test_response_structure_valid(self):
        client = TestClient(app)
        wav = _make_wav_bytes()
        resp = client.post(
            "/breath/analyze",
            files={"audio": ("b.wav", wav, "audio/wav")},
            data={"target_exhale_sec": "2.0"},
        )
        body = resp.json()
        assert "cycles" in body
        assert "overall_score" in body
        assert "weakness" in body
        assert 0 <= body["overall_score"] <= 100

    def test_audio_missing_returns_422(self):
        client = TestClient(app)
        resp = client.post("/breath/analyze", data={"target_exhale_sec": "10.0"})
        assert resp.status_code == 422

    def test_invalid_target_exhale_returns_400(self):
        client = TestClient(app)
        wav = _make_wav_bytes()
        resp = client.post(
            "/breath/analyze",
            files={"audio": ("b.wav", wav, "audio/wav")},
            data={"target_exhale_sec": "0"},
        )
        assert resp.status_code == 400

    def test_silent_audio_returns_low_score(self):
        client = TestClient(app)
        sr = 16000
        silence = np.zeros(int(sr * 5), dtype=np.float32)
        pcm = (silence * 32767).astype(np.int16).tobytes()
        buf = io.BytesIO()
        data_size = len(pcm)
        buf.write(b"RIFF")
        buf.write(struct.pack("<I", 36 + data_size))
        buf.write(b"WAVE")
        buf.write(b"fmt ")
        buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16))
        buf.write(b"data")
        buf.write(struct.pack("<I", data_size))
        buf.write(pcm)
        wav = buf.getvalue()

        resp = client.post(
            "/breath/analyze",
            files={"audio": ("s.wav", wav, "audio/wav")},
            data={"target_exhale_sec": "10.0"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["overall_score"] <= 50
        assert len(body["cycles"]) == 0
