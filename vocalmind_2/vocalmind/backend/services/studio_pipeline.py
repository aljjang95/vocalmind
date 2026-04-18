"""Studio 파이프라인 상태머신 (Phase 0).

BFF가 studio_jobs(pending) insert + consume_credits 완료한 상태로 진입.
orchestrator 라우터가 이 모듈의 함수들을 호출해 다음 단계로 전이.

핵심 원칙:
- 상태 전이는 낙관적 잠금: UPDATE ... WHERE id=? AND status=?
- 실패 시 attempt_count 증가, max_attempts 초과 시 failed → refund 트리거
- 모든 경로 idempotent (같은 콜백 재수신 허용)
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Literal

import httpx

from services import credits

logger = logging.getLogger(__name__)

JobStatus = Literal[
    "pending",
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "scene_planning", "scene_image_gen", "scene_video_gen",
    "lipsync", "composing", "formatting", "watermarking",
    "finalizing", "completed", "failed", "refunded",
]

# 전이 순서 (happy path)
STEP_ORDER: list[JobStatus] = [
    "pending",
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "scene_planning", "scene_image_gen", "scene_video_gen",
    "lipsync", "composing", "formatting", "watermarking",
    "finalizing", "completed",
]

STEP_PROGRESS: dict[JobStatus, int] = {
    "pending": 0,
    "vocal_separating": 10,
    "vocal_rvc": 20,
    "vocal_mixing": 30,
    "scene_planning": 40,
    "scene_image_gen": 50,
    "scene_video_gen": 70,
    "lipsync": 85,
    "composing": 90,
    "formatting": 93,
    "watermarking": 96,
    "finalizing": 98,
    "completed": 100,
}

STEP_LABEL: dict[JobStatus, str] = {
    "pending": "대기 중",
    "vocal_separating": "보컬과 반주를 분리하고 있어요",
    "vocal_rvc": "본인 음색으로 보컬을 변환하고 있어요",
    "vocal_mixing": "보컬과 반주를 섞고 있어요",
    "scene_planning": "뮤직비디오 장면을 설계하고 있어요",
    "scene_image_gen": "장면 이미지를 그리고 있어요",
    "scene_video_gen": "이미지를 영상으로 움직이게 하고 있어요",
    "lipsync": "립싱크를 맞추고 있어요",
    "composing": "영상을 합성하고 있어요",
    "formatting": "가로·세로 두 포맷으로 렌더링하고 있어요",
    "watermarking": "AI 생성물 서명을 추가하고 있어요",
    "finalizing": "마무리하고 있어요",
    "completed": "완성했어요",
    "failed": "작업이 실패했어요",
    "refunded": "크레딧을 환불했어요",
}


class PipelineError(Exception):
    """상태머신 오류 (잘못된 전이, DB 실패 등)."""
    def __init__(self, message: str, *, code: str = "PIPELINE_ERROR"):
        super().__init__(message)
        self.code = code


# ── Supabase Rest 헬퍼 ─────────────────────────────────────────────

def _sb_headers() -> dict:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise PipelineError("SUPABASE_SERVICE_ROLE_KEY 누락", code="CONFIG_ERROR")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _sb_url() -> str:
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise PipelineError("SUPABASE_URL 누락", code="CONFIG_ERROR")
    return url


# ── 상태 전이 (낙관적 잠금) ─────────────────────────────────────────

@dataclass
class TransitionResult:
    job_id: str
    from_status: JobStatus
    to_status: JobStatus
    applied: bool  # False면 다른 워커/콜백이 이미 전이시킴 (idempotent)


def transition(
    job_id: str,
    expected_status: JobStatus,
    next_status: JobStatus,
    *,
    fields: dict | None = None,
) -> TransitionResult:
    """낙관적 잠금으로 상태 전이.

    WHERE id=? AND status=<expected>. 맞으면 UPDATE, 아니면 applied=False.
    """
    progress = STEP_PROGRESS.get(next_status)
    label = STEP_LABEL.get(next_status)

    payload = {"status": next_status, **(fields or {})}
    if progress is not None:
        payload["progress_pct"] = progress
    if label is not None:
        payload["current_step_label"] = label

    url = f"{_sb_url()}/rest/v1/studio_jobs"
    params = {
        "id": f"eq.{job_id}",
        "status": f"eq.{expected_status}",
    }

    with httpx.Client(timeout=10.0) as client:
        resp = client.patch(url, params=params, json=payload, headers=_sb_headers())

    if resp.status_code >= 400:
        raise PipelineError(
            f"상태 전이 실패 ({resp.status_code}): {resp.text[:200]}",
            code="DB_ERROR",
        )

    rows = resp.json()
    applied = isinstance(rows, list) and len(rows) > 0
    return TransitionResult(
        job_id=job_id,
        from_status=expected_status,
        to_status=next_status,
        applied=applied,
    )


def mark_failed(job_id: str, failed_step: str, error: str) -> None:
    """최종 실패 처리 + 크레딧 자동 환불.

    이중 환불 방지: 이미 failed/refunded 상태면 PATCH가 빈 배열 반환 → 조기 종료.
    """
    url = f"{_sb_url()}/rest/v1/studio_jobs"
    # 이미 failed/refunded면 재환불 방지
    params = {
        "id": f"eq.{job_id}",
        "status": "not.in.(failed,refunded)",
    }
    payload = {
        "status": "failed",
        "failed_step": failed_step,
        "last_error": error[:1000],
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.patch(url, params=params, json=payload, headers=_sb_headers())
        resp.raise_for_status()
        job_rows = resp.json()
        if not job_rows:
            logger.info("mark_failed 스킵 — 이미 failed/refunded job_id=%s", job_id)
            return
        job = job_rows[0]

    # 환불 처리
    try:
        credits.refund_job(
            user_id=job["user_id"],
            job_id=job_id,
            amount=int(job["cost_credits"]),
        )
        # status를 refunded로 전이
        with httpx.Client(timeout=10.0) as client:
            client.patch(
                url,
                params={"id": f"eq.{job_id}", "status": "eq.failed"},
                json={"status": "refunded"},
                headers=_sb_headers(),
            )
    except Exception as e:
        logger.exception("환불 실패 job_id=%s: %s", job_id, e)


def increment_attempt(job_id: str) -> int:
    """attempt_count += 1 후 현재 값 반환. max_attempts 초과 판단용."""
    # Supabase RPC 없이 간단히 select → update
    url = f"{_sb_url()}/rest/v1/studio_jobs"
    with httpx.Client(timeout=10.0) as client:
        r = client.get(
            url,
            params={"id": f"eq.{job_id}", "select": "attempt_count,max_attempts"},
            headers=_sb_headers(),
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            raise PipelineError(f"job 없음: {job_id}", code="NOT_FOUND")
        row = rows[0]
        new_count = int(row["attempt_count"]) + 1
        client.patch(
            url,
            params={"id": f"eq.{job_id}"},
            json={"attempt_count": new_count},
            headers=_sb_headers(),
        )
    return new_count


def get_job(job_id: str) -> dict:
    """단일 job 조회."""
    url = f"{_sb_url()}/rest/v1/studio_jobs"
    with httpx.Client(timeout=10.0) as client:
        r = client.get(
            url,
            params={"id": f"eq.{job_id}", "select": "*"},
            headers=_sb_headers(),
        )
        r.raise_for_status()
        rows = r.json()
    if not rows:
        raise PipelineError(f"job 없음: {job_id}", code="NOT_FOUND")
    return rows[0]


def update_scene_result(
    job_id: str,
    scene_id: str,
    step: str,
    result_url: str,
) -> None:
    """Runware 씬 결과 URL을 scene_plan.scenes 배열에 업데이트.

    step == "scene_image_gen" → scenes[i].imageUrl 갱신
    step == "scene_video_gen" → scenes[i].videoUrl 갱신

    Supabase REST는 JSON 배열 원소 패치를 지원하지 않으므로
    scene_plan 전체를 read → 수정 → write 패턴으로 처리.
    """
    job = get_job(job_id)
    scene_plan: dict = job.get("scene_plan") or {}
    scenes: list = scene_plan.get("scenes") or []

    url_field = "imageUrl" if step == "scene_image_gen" else "videoUrl"
    matched = False
    for scene in scenes:
        if isinstance(scene, dict) and scene.get("id") == scene_id:
            scene[url_field] = result_url
            matched = True
            break

    if not matched:
        # scene_id 불일치 시 순서 기반 폴백 — 아직 URL 없는 첫 씬에 할당
        logger.warning(
            "scene_id=%s 불일치 → 순서 기반 폴백 적용 job_id=%s step=%s",
            scene_id, job_id, step,
        )
        for scene in scenes:
            if isinstance(scene, dict) and not scene.get(url_field):
                scene[url_field] = result_url
                matched = True
                break

    if not matched:
        logger.error(
            "update_scene_result: 매핑 불가 scene_id=%s job_id=%s step=%s",
            scene_id, job_id, step,
        )
        return

    scene_plan["scenes"] = scenes
    rest_url = f"{_sb_url()}/rest/v1/studio_jobs"
    with httpx.Client(timeout=10.0) as client:
        resp = client.patch(
            rest_url,
            params={"id": f"eq.{job_id}"},
            json={"scene_plan": scene_plan},
            headers=_sb_headers(),
        )
    if resp.status_code >= 400:
        raise PipelineError(
            f"scene_plan 업데이트 실패 ({resp.status_code}): {resp.text[:200]}",
            code="DB_ERROR",
        )
    logger.info(
        "scene_result 업데이트 완료 job_id=%s scene_id=%s step=%s url=%s",
        job_id, scene_id, step, result_url,
    )


def all_scenes_done(job_id: str, step: str) -> bool:
    """모든 씬의 해당 step URL이 채워졌는지 확인.

    step == "scene_image_gen" → 모든 scenes[i].imageUrl 존재 여부
    step == "scene_video_gen" → 모든 scenes[i].videoUrl 존재 여부
    step == "lipsync"         → 모든 scenes[i].videoUrl 존재 여부 (lipsync=lip-synced video)
    """
    job = get_job(job_id)
    scene_plan: dict = job.get("scene_plan") or {}
    scenes: list = scene_plan.get("scenes") or []

    if not scenes:
        # 씬이 없으면 완료 처리 (빈 plan → 다음 단계 진행)
        logger.warning("all_scenes_done: scenes 비어있음 job_id=%s step=%s", job_id, step)
        return True

    url_field = "imageUrl" if step == "scene_image_gen" else "videoUrl"
    done_count = sum(
        1 for s in scenes
        if isinstance(s, dict) and s.get(url_field)
    )
    logger.info(
        "all_scenes_done check: %d/%d 완료 job_id=%s step=%s",
        done_count, len(scenes), job_id, step,
    )
    return done_count >= len(scenes)
