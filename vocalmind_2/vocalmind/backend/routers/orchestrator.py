"""Studio 오케스트레이터 라우터 (Phase 0) — 얇은 HTTP 어댑터.

모든 도메인 로직은 application/studio/* 로 위임.
여기에는 요청 파싱 · 인증 · 응답 직렬화만 둔다.

인증: X-Orchestrator-Secret 헤더 (내부 호출 전용).
"""
from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel

from application.studio import (
    lifecycle as studio_lifecycle,
    modal_callback,
    runware_callback,
    start as studio_start,
)
from infra.supabase import studio_jobs_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


def _verify_secret(header_value: str | None) -> None:
    expected = os.environ.get("ORCHESTRATOR_SECRET")
    if not expected:
        raise HTTPException(status_code=500, detail="ORCHESTRATOR_SECRET 미설정")
    if header_value != expected:
        raise HTTPException(status_code=401, detail="인증 실패")


# ── 요청/응답 스키마 ────────────────────────────────────────────────

class StartJobRequest(BaseModel):
    job_id: str


class StartJobResponse(BaseModel):
    accepted: bool
    job_id: str
    status: str


ModalStep = Literal[
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "composing", "formatting", "watermarking",
]
RunwareStep = Literal["scene_image_gen", "scene_video_gen", "lipsync"]


class ModalCallbackRequest(BaseModel):
    job_id: str
    step: ModalStep
    status: Literal["success", "failed"]
    result: dict = {}
    error: str | None = None


class RunwareCallbackRequest(BaseModel):
    job_id: str
    task_id: str
    step: RunwareStep
    status: Literal["success", "failed"]
    scene_id: str | None = None
    result_url: str | None = None
    error: str | None = None


class CallbackResponse(BaseModel):
    accepted: bool
    next_step: str | None = None


class CancelJobRequest(BaseModel):
    job_id: str
    user_id: str


class CancelJobResponse(BaseModel):
    ok: bool
    job_id: str
    previous_status: str
    status: str


class StuckJobRow(BaseModel):
    id: str
    user_id: str
    status: str
    cost_credits: int
    attempt_count: int
    last_error: str | None = None
    created_at: str
    updated_at: str


class StuckJobsResponse(BaseModel):
    older_than_minutes: int
    count: int
    items: list[StuckJobRow]


class ForceFailRequest(BaseModel):
    job_id: str
    reason: str


class ForceFailResponse(BaseModel):
    ok: bool
    job_id: str
    previous_status: str
    status: str


# ── 엔드포인트 ─────────────────────────────────────────────────────

@router.post("/start", response_model=StartJobResponse)
async def start_job(
    req: StartJobRequest,
    background: BackgroundTasks,
    x_orchestrator_secret: str | None = Header(default=None),
) -> StartJobResponse:
    _verify_secret(x_orchestrator_secret)

    try:
        outcome = studio_start.start_job(req.job_id)
    except studio_jobs_repo.JobNotFound as e:
        raise HTTPException(status_code=404, detail={"error": str(e), "code": "NOT_FOUND"})

    if outcome.status == "vocal_separating":
        background.add_task(studio_start.dispatch_first, req.job_id)

    return StartJobResponse(accepted=True, job_id=req.job_id, status=outcome.status)


@router.post("/callback/modal", response_model=CallbackResponse)
async def on_modal_callback(
    req: ModalCallbackRequest,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CallbackResponse:
    _verify_secret(x_orchestrator_secret)
    outcome = modal_callback.handle(
        job_id=req.job_id,
        step=req.step,
        status=req.status,
        result=req.result,
        error=req.error,
    )
    return CallbackResponse(accepted=outcome.accepted, next_step=outcome.next_step)


@router.post("/callback/runware", response_model=CallbackResponse)
async def on_runware_callback(
    req: RunwareCallbackRequest,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CallbackResponse:
    _verify_secret(x_orchestrator_secret)
    outcome = runware_callback.handle(
        job_id=req.job_id,
        task_id=req.task_id,
        step=req.step,
        status=req.status,
        scene_id=req.scene_id,
        result_url=req.result_url,
        error=req.error,
    )
    return CallbackResponse(accepted=outcome.accepted, next_step=outcome.next_step)


@router.post("/cancel", response_model=CancelJobResponse)
async def cancel_job(
    req: CancelJobRequest,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CancelJobResponse:
    _verify_secret(x_orchestrator_secret)
    try:
        result = studio_lifecycle.cancel_by_user(req.job_id, req.user_id)
    except studio_lifecycle.PipelineError as e:
        status = (
            404 if e.code == "NOT_FOUND"
            else 403 if e.code == "FORBIDDEN"
            else 409 if e.code == "NOT_CANCELLABLE"
            else 500
        )
        raise HTTPException(status_code=status, detail={"error": str(e), "code": e.code})
    return CancelJobResponse(
        ok=True,
        job_id=result["job_id"],
        previous_status=result["previous_status"],
        status=result["status"],
    )


@router.get("/admin/stuck-jobs", response_model=StuckJobsResponse)
async def admin_stuck_jobs(
    older_than_minutes: int = 30,
    x_orchestrator_secret: str | None = Header(default=None),
) -> StuckJobsResponse:
    _verify_secret(x_orchestrator_secret)
    minutes = max(1, min(older_than_minutes, 24 * 60))
    rows = studio_jobs_repo.list_stuck(minutes)
    return StuckJobsResponse(
        older_than_minutes=minutes,
        count=len(rows),
        items=[StuckJobRow(**r) for r in rows],
    )


@router.post("/admin/force-fail", response_model=ForceFailResponse)
async def admin_force_fail(
    req: ForceFailRequest,
    x_orchestrator_secret: str | None = Header(default=None),
) -> ForceFailResponse:
    _verify_secret(x_orchestrator_secret)
    reason = (req.reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=400,
            detail={"error": "reason 필수", "code": "MISSING_REASON"},
        )
    try:
        result = studio_lifecycle.force_fail_by_admin(req.job_id, reason)
    except studio_lifecycle.PipelineError as e:
        status = (
            404 if e.code == "NOT_FOUND"
            else 409 if e.code == "ALREADY_TERMINAL"
            else 500
        )
        raise HTTPException(status_code=status, detail={"error": str(e), "code": e.code})
    return ForceFailResponse(
        ok=True,
        job_id=result["job_id"],
        previous_status=result["previous_status"],
        status=result["status"],
    )
