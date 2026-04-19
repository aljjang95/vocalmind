"""Runware Qwen3-TTS 제로샷 — HLB 마스터 보이스 클로닝.

CosyVoice 로컬 모델 대신 Runware API 경유 Qwen3-TTS를 사용.
참조 클립(20초 WAV) + transcript로 ICL 모드 활성화 (xVectorOnly=False).

API 문서: https://runware.ai/docs/models/alibaba-qwen3-tts-1-7b-base
"""
from __future__ import annotations

import base64
import json
import os
import uuid
from pathlib import Path
from typing import Optional

import requests

_API_URL = "https://api.runware.ai/v1"
_MODEL = "alibaba:qwen@3-tts-1.7b-base"

_REF_WAV = Path(__file__).parent.parent / "assets" / "hlb_master_ref_clean.wav"

_REF_TRANSCRIPT = (
    "성대는 본래 운동하고자 하는 그 운동성대로 아래부터 위로 붙는 운동성을 띄기 때문에 "
    "막히는게 아니라 힘만 빼놔도 알아서 바뀌어 줘서 올라가질 수가 있거든요. "
    "그래서 우리가 목의 힘을 가장 빼기 쉬운 방법은"
)

_session: requests.Session | None = None


def _get_session() -> requests.Session:
    """API 세션 싱글톤."""
    global _session
    if _session is not None:
        return _session

    api_key = os.environ.get("RUNWARE_API_KEY", "")
    if not api_key:
        raise RuntimeError("RUNWARE_API_KEY 환경변수가 설정되지 않았습니다")

    _session = requests.Session()
    _session.headers.update({
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    return _session


def _audio_to_base64(wav_path: Path) -> str:
    with open(wav_path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def synthesize_zero_shot(text: str, max_chars: int = 500) -> Optional[bytes]:
    """마스터 음성으로 제로샷 TTS. MP3 바이트 반환."""
    if not text or not text.strip():
        return None

    if not _REF_WAV.exists():
        raise RuntimeError(f"참조 오디오 파일 없음: {_REF_WAV}")

    truncated = text[:max_chars]
    session = _get_session()
    ref_base64 = _audio_to_base64(_REF_WAV)

    payload = [
        {
            "taskType": "audioInference",
            "taskUUID": str(uuid.uuid4()),
            "model": _MODEL,
            "speech": {
                "text": truncated,
                "voice": "clone",
                "language": "Korean",
                "speed": 1.0,
            },
            "settings": {
                "transcript": _REF_TRANSCRIPT,
                "xVectorOnly": False,
                "maxNewTokens": 2048,
            },
            "inputs": {
                "audio": ref_base64,
            },
            "audioSettings": {
                "channels": 1,
                "sampleRate": 48000,
                "bitrate": 192,
            },
            "outputType": "base64Data",
            "outputFormat": "MP3",
        }
    ]

    try:
        resp = session.post(_API_URL, json=payload, timeout=(10, 120))
        resp.raise_for_status()
        result = resp.json()
    except requests.Timeout:
        raise RuntimeError("Runware TTS 타임아웃")
    except requests.RequestException as e:
        raise RuntimeError(f"Runware TTS 요청 실패: {e}")

    errors = result.get("errors", []) if isinstance(result, dict) else []
    if errors:
        err_msg = errors[0].get("message", str(errors[0]))
        raise RuntimeError(f"Runware TTS 에러: {err_msg}")

    data_list = result.get("data", []) if isinstance(result, dict) else result
    if isinstance(data_list, list) and len(data_list) > 0:
        data = data_list[0]
    elif isinstance(result, dict) and "audioBase64Data" in result:
        data = result
    else:
        raise RuntimeError("Runware TTS 응답에 오디오 데이터 없음")

    audio_b64 = data.get("audioBase64Data") or data.get("audioURL")
    if not audio_b64:
        raise RuntimeError("Runware TTS 응답에 오디오 없음")

    if audio_b64.startswith("http"):
        audio_resp = session.get(audio_b64, timeout=(10, 60))
        audio_resp.raise_for_status()
        return audio_resp.content

    return base64.b64decode(audio_b64)
