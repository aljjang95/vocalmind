"""Modal 함수 dispatch 래퍼 (Phase 0).

기존 배포된 Modal 앱:
- vocalmind-demucs (separate)
- vocalmind-rvc (convert)
- vocalmind-compose (compose_final) — 신규

orchestrator는 이 모듈의 dispatch_* 함수를 호출.
Modal fastapi_endpoint는 HTTPS POST로 invoke (async, spawn 아님).

HTTPS 응답은 최종 결과 or task_id. Phase 0은 fastapi_endpoint 동기 응답을
callback URL로 POST하도록 Modal 함수가 래핑 (modal_compose.py 내부).
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Modal 배포 URL (환경변수로 관리)
MODAL_DEMUCS_URL = os.environ.get(
    "MODAL_DEMUCS_URL",
    "https://aljjang95--vocalmind-demucs-separate.modal.run",
)
MODAL_RVC_URL = os.environ.get(
    "MODAL_RVC_URL",
    "https://aljjang95--vocalmind-rvc-convert-studio.modal.run",
)
MODAL_COMPOSE_URL = os.environ.get(
    "MODAL_COMPOSE_URL",
    "https://aljjang95--vocalmind-compose-compose-final.modal.run",
)
MODAL_MIX_URL = os.environ.get(
    "MODAL_MIX_URL",
    "https://aljjang95--vocalmind-compose-mix-audio.modal.run",
)


class DispatchError(Exception):
    """Modal dispatch 실패."""
    def __init__(self, message: str, *, code: str = "DISPATCH_ERROR"):
        super().__init__(message)
        self.code = code


def _callback_url() -> str:
    """FastAPI orchestrator 콜백 URL (공개 호스트)."""
    base = os.environ.get("PUBLIC_BACKEND_URL")
    if not base:
        # 개발환경: 로컬 Modal 호출이 안 되므로 로깅만
        raise DispatchError("PUBLIC_BACKEND_URL 미설정 — Modal이 콜백할 공개 주소 필요")
    return f"{base.rstrip('/')}/orchestrator/callback/modal"


def _post(url: str, payload: dict, *, timeout: float = 30.0) -> dict:
    """Modal fastapi_endpoint POST (비동기 시작 전용)."""
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
    except httpx.HTTPError as e:
        raise DispatchError(f"Modal 네트워크 오류: {e}") from e

    if resp.status_code >= 400:
        raise DispatchError(
            f"Modal {resp.status_code}: {resp.text[:200]}",
            code="MODAL_HTTP_ERROR",
        )

    try:
        return resp.json()
    except ValueError:
        return {"raw": resp.text}


# ── 단계별 dispatch ────────────────────────────────────────────────

def dispatch_demucs(job_id: str, input_url: str, output_prefix: str) -> dict:
    """Demucs 분리 시작. Modal이 콜백으로 {vocals_path, instrumental_path} POST."""
    return _post(MODAL_DEMUCS_URL, {
        "job_id": job_id,
        "audio_url": input_url,
        "callback_url": _callback_url(),
        "step": "vocal_separating",
        "output_bucket": "studio-recording",
        "output_prefix": output_prefix,
    }, timeout=60.0)


def dispatch_rvc(
    job_id: str, vocals_url: str, voice_identity_id: str, output_prefix: str,
) -> dict:
    """RVC 음색 변환. Modal이 콜백으로 {converted_vocals_path} POST."""
    return _post(MODAL_RVC_URL, {
        "job_id": job_id,
        "vocals_url": vocals_url,
        "voice_identity_id": voice_identity_id,
        "callback_url": _callback_url(),
        "step": "vocal_rvc",
        "output_bucket": "studio-recording",
        "output_prefix": output_prefix,
    }, timeout=60.0)


def dispatch_mix(
    job_id: str, vocals_url: str, instrumental_url: str, output_prefix: str,
) -> dict:
    """보컬 + 반주 믹싱. Modal이 콜백으로 {final_vocal_mix_path} POST."""
    return _post(MODAL_MIX_URL, {
        "job_id": job_id,
        "vocals_url": vocals_url,
        "instrumental_url": instrumental_url,
        "output_bucket": "studio-recording",
        "output_prefix": output_prefix,
        "callback_url": _callback_url(),
        "step": "vocal_mixing",
    }, timeout=120.0)


def dispatch_compose(
    job_id: str,
    scene_video_urls: list[str],
    final_vocal_mix_url: str,
    output_prefix: str,
    lyrics_lines: list[dict] | None = None,
) -> dict:
    """최종 합성 + C2PA + Supabase 업로드."""
    return _post(MODAL_COMPOSE_URL, {
        "job_id": job_id,
        "scene_video_urls": scene_video_urls,
        "final_vocal_mix_url": final_vocal_mix_url,
        "lyrics_lines": lyrics_lines,
        "output_bucket": "mv-output",
        "output_prefix": output_prefix,
        "callback_url": _callback_url(),
        "step": "composing",
    }, timeout=300.0)
