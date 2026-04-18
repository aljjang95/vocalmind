"""Runware API 클라이언트 — FLUX / HunyuanVideo / LatentSync 공통 래퍼.

Phase 0: 이미지·비디오·립싱크·TTS를 Runware REST로 호출.
- 싱글톤 httpx.Client로 커넥션 재활용
- 폴링은 orchestrator 책임. 여기서는 task 생성 + 단건 조회만 제공.
- 실패 시 구체적 예외 → orchestrator가 재시도/환불 판단.
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

import httpx

logger = logging.getLogger(__name__)

RUNWARE_BASE_URL = "https://api.runware.ai/v1"
DEFAULT_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=30.0, pool=5.0)

_client: httpx.Client | None = None


def _dry_run_enabled() -> bool:
    """RUNWARE_DRY_RUN=1이면 실호출 차단 — 로컬·dev 검증용.

    마스터 각인(feedback_vocalmind_bond_quality_first.md): 낭비 방지.
    CI/테스트는 mock 사용이 원칙이지만, 로컬 파이프라인 검증 시 이 플래그로
    무과금 리허설 가능.
    """
    return os.environ.get("RUNWARE_DRY_RUN", "").strip() in ("1", "true", "yes")


def _dry_image_url(prompt: str, width: int, height: int, model: str) -> tuple[str, float]:
    """DRY_RUN용 가짜 이미지 URL + cost=0."""
    h = abs(hash((prompt, width, height, model))) % 10_000
    return (
        f"https://runware.dryrun/image/{model.replace(':', '_')}/{width}x{height}/{h}.png",
        0.0,
    )


def _dry_video_task(prompt: str, duration_sec: float, model: str, image_url: str | None) -> "RunwareTask":
    """DRY_RUN용 가짜 비디오 task (status=success, cost=0)."""
    h = abs(hash((prompt, duration_sec, model, image_url))) % 10_000
    fake_url = f"https://runware.dryrun/video/{model.replace(':', '_')}/{duration_sec:.1f}s/{h}.mp4"
    return RunwareTask(
        task_id=str(uuid.uuid4()),
        status="success",
        result_url=fake_url,
        error=None,
        raw={"cost": 0.0, "dry_run": True},
    )


class RunwareError(Exception):
    """Runware API 호출 실패."""
    def __init__(self, message: str, *, status_code: int | None = None, task_id: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.task_id = task_id


@dataclass(frozen=True)
class RunwareTask:
    """Runware task 응답."""
    task_id: str
    status: Literal["pending", "processing", "success", "failed"]
    result_url: str | None
    error: str | None
    raw: dict[str, Any]

    @property
    def cost_usd(self) -> float:
        """Runware cost 필드 (응답에 포함될 때만). Phase 0 원가 실측용."""
        cost = self.raw.get("cost")
        try:
            return float(cost) if cost is not None else 0.0
        except (TypeError, ValueError):
            return 0.0


def _get_client() -> httpx.Client:
    """Runware httpx.Client 싱글톤 반환."""
    global _client
    if _client is None:
        api_key = os.environ.get("RUNWARE_API_KEY")
        if not api_key:
            raise RunwareError("RUNWARE_API_KEY 환경변수가 설정되지 않았습니다")
        _client = httpx.Client(
            base_url=RUNWARE_BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=DEFAULT_TIMEOUT,
        )
    return _client


def _post(path: str, payload: list[dict]) -> list[dict]:
    """Runware POST 호출 — 공통 에러 핸들링."""
    client = _get_client()
    try:
        resp = client.post(path, json=payload)
    except httpx.HTTPError as e:
        raise RunwareError(f"Runware 네트워크 오류: {e}") from e

    if resp.status_code >= 400:
        raise RunwareError(
            f"Runware {resp.status_code}: {resp.text[:200]}",
            status_code=resp.status_code,
        )

    data = resp.json()
    if not isinstance(data, dict) or "data" not in data:
        raise RunwareError(f"Runware 응답 형식 오류: {str(data)[:200]}")
    return data["data"]


# ── 이미지 생성 (FLUX Schnell/Dev) ──────────────────────────────────

def _extract_cost(data: dict) -> float:
    """Runware 응답의 cost 필드 추출. 누락 시 0.0."""
    cost = data.get("cost")
    try:
        return float(cost) if cost is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def generate_image(
    prompt: str,
    *,
    width: int = 1024,
    height: int = 1024,
    model: str = "runware:100@1",  # FLUX.1 Schnell (FAILURES #3 검증됨, 2026-04-18)
    steps: int = 4,
    cfg_scale: float = 3.0,
    seed: int | None = None,
) -> str:
    """단일 이미지 생성 → URL 반환 (비용 추적 안 함, backcompat)."""
    url, _cost = generate_image_with_cost(
        prompt, width=width, height=height, model=model,
        steps=steps, cfg_scale=cfg_scale, seed=seed,
    )
    return url


def generate_image_with_cost(
    prompt: str,
    *,
    width: int = 1024,
    height: int = 1024,
    model: str = "runware:100@1",  # FLUX.1 Schnell (FAILURES #3 검증됨)
    steps: int = 4,
    cfg_scale: float = 3.0,
    seed: int | None = None,
    reference_images: list[str] | None = None,
) -> tuple[str, float]:
    """이미지 생성 → (URL, cost_usd). Phase 0 원가 추적용.

    reference_images: Seedream 4.5/5.0의 image-to-image 옵션 (최대 14장).
    RUNWARE_DRY_RUN=1이면 가짜 URL + cost=0 반환 (무과금 리허설).
    """
    if _dry_run_enabled():
        return _dry_image_url(prompt, width, height, model)

    # 모델 픽셀 제약 선검증 (FAILURES.md #1 재발 방지)
    try:
        from infra import runware_catalog as _cat
        _cat.validate_dimensions(model, width, height)
    except ValueError as e:
        raise RunwareError(f"dimensions 제약 위반: {e}") from e

    task_uuid = str(uuid.uuid4())
    payload_item: dict[str, Any] = {
        "taskType": "imageInference",
        "taskUUID": task_uuid,
        "positivePrompt": prompt,
        "width": width,
        "height": height,
        "model": model,
        "numberResults": 1,
    }
    # FLUX 계열은 steps/CFGScale 사용, Seedream은 해당 없음 — 조건부 삽입
    if not model.startswith("bytedance:"):
        payload_item["steps"] = steps
        payload_item["CFGScale"] = cfg_scale
    if seed is not None:
        payload_item["seed"] = seed
    if reference_images:
        payload_item["inputs"] = {"referenceImages": reference_images[:14]}
    payload = [payload_item]

    results = _post("", payload)
    if not results:
        raise RunwareError("Runware 이미지 결과 없음", task_id=task_uuid)

    first = results[0]
    url = first.get("imageURL")
    if not url:
        raise RunwareError(f"Runware 이미지 URL 누락: {str(first)[:200]}", task_id=task_uuid)
    return url, _extract_cost(first)


# ── 비디오 생성 (HunyuanVideo / Wan) ────────────────────────────────

def generate_video(
    prompt: str,
    *,
    duration_sec: float = 10.0,
    width: int = 1280,
    height: int = 720,
    model: str = "runware:hunyuan-video@1",
    image_url: str | None = None,  # image-to-video용
) -> RunwareTask:
    """비디오 생성 태스크 시작 — 오래 걸리므로 pending 상태로 반환.

    orchestrator가 polling 또는 webhook으로 완료 확인 책임.
    RUNWARE_DRY_RUN=1이면 즉시 success + 가짜 URL (무과금 리허설).
    """
    if _dry_run_enabled():
        return _dry_video_task(prompt, duration_sec, model, image_url)

    task_uuid = str(uuid.uuid4())
    payload = [{
        "taskType": "videoInference",
        "taskUUID": task_uuid,
        "positivePrompt": prompt,
        "width": width,
        "height": height,
        "duration": duration_sec,
        "model": model,
        **({"imageURL": image_url} if image_url else {}),
    }]

    results = _post("", payload)
    if not results:
        raise RunwareError("Runware 비디오 응답 없음", task_id=task_uuid)

    first = results[0]
    status = first.get("status", "pending")
    return RunwareTask(
        task_id=first.get("taskUUID", task_uuid),
        status=status,
        result_url=first.get("videoURL"),
        error=first.get("error"),
        raw=first,
    )


# ── 립싱크 (LatentSync) ─────────────────────────────────────────────

def generate_lipsync(
    video_url: str,
    audio_url: str,
    *,
    model: str = "runware:latentsync@1",
) -> RunwareTask:
    """기존 비디오에 새 오디오를 립싱크. pending 반환 → orchestrator polling.

    RUNWARE_DRY_RUN=1이면 즉시 success + 가짜 URL.
    """
    if _dry_run_enabled():
        return RunwareTask(
            task_id=str(uuid.uuid4()),
            status="success",
            result_url=f"https://runware.dryrun/lipsync/{model.replace(':', '_')}.mp4",
            error=None,
            raw={"cost": 0.0, "dry_run": True},
        )

    task_uuid = str(uuid.uuid4())
    payload = [{
        "taskType": "lipSync",
        "taskUUID": task_uuid,
        "videoURL": video_url,
        "audioURL": audio_url,
        "model": model,
    }]

    results = _post("", payload)
    if not results:
        raise RunwareError("Runware 립싱크 응답 없음", task_id=task_uuid)

    first = results[0]
    return RunwareTask(
        task_id=first.get("taskUUID", task_uuid),
        status=first.get("status", "pending"),
        result_url=first.get("videoURL"),
        error=first.get("error"),
        raw=first,
    )


# ── 태스크 상태 조회 (polling용) ─────────────────────────────────────

def get_task_status(task_id: str) -> RunwareTask:
    """태스크 완료 확인."""
    client = _get_client()
    try:
        resp = client.get(f"/tasks/{task_id}")
    except httpx.HTTPError as e:
        raise RunwareError(f"Runware 상태 조회 오류: {e}") from e

    if resp.status_code >= 400:
        raise RunwareError(
            f"Runware 상태 조회 {resp.status_code}",
            status_code=resp.status_code,
            task_id=task_id,
        )

    data = resp.json()
    return RunwareTask(
        task_id=task_id,
        status=data.get("status", "pending"),
        result_url=data.get("imageURL") or data.get("videoURL"),
        error=data.get("error"),
        raw=data,
    )


def wait_for_task(
    task_id: str,
    *,
    timeout_sec: int = 600,
    poll_interval_sec: float = 3.0,
) -> RunwareTask:
    """단순 동기 polling — 테스트·간단한 케이스용.

    프로덕션 orchestrator는 DB 상태로 비동기 처리. 이 함수는 fallback.
    """
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        task = get_task_status(task_id)
        if task.status in ("success", "failed"):
            return task
        time.sleep(poll_interval_sec)
    raise RunwareError(f"Runware 태스크 타임아웃: {task_id}", task_id=task_id)
