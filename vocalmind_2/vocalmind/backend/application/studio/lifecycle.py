"""Job lifecycle — mark_failed / cancel / force_fail 복합 유스케이스.

core.studio.lifecycle(순수 검증) + infra.supabase(DB) + credits(환불)을 조합.
"""
from __future__ import annotations

import logging

from core.studio import lifecycle as core_lifecycle
from domain_types.studio import JobStatus
from infra.supabase import credits_repo, studio_jobs_repo

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    def __init__(self, message: str, *, code: str = "PIPELINE_ERROR"):
        super().__init__(message)
        self.code = code


def mark_failed(job_id: str, failed_step: str, error: str) -> None:
    """최종 실패 처리 + 크레딧 자동 환불.

    이미 failed/refunded면 스킵(이중 환불 방지).
    환불 성공 시 refunded로 재전이. 환불 실패 시 failed 상태 유지(로그만).
    """
    updated = studio_jobs_repo.patch_if_not_terminal(job_id, {
        "status": "failed",
        "failed_step": failed_step,
        "last_error": (error or "")[:1000],
    })
    if not updated:
        logger.info("mark_failed 스킵 — 이미 failed/refunded job_id=%s", job_id)
        return

    job_row = updated[0]
    try:
        credits_repo.refund_job(
            user_id=job_row["user_id"],
            job_id=job_id,
            amount=int(job_row["cost_credits"]),
        )
        studio_jobs_repo.transition_guarded(
            job_id, expect="failed", to="refunded",
        )
    except Exception as e:
        logger.exception("환불 실패 job_id=%s: %s", job_id, e)


def cancel_by_user(job_id: str, user_id: str) -> dict:
    """유저 취소 — cancellable 단계에서만. mark_failed + 환불."""
    try:
        job = studio_jobs_repo.get(job_id)
    except studio_jobs_repo.JobNotFound as e:
        raise PipelineError(str(e), code="NOT_FOUND") from e

    current: JobStatus = job.status
    try:
        core_lifecycle.check_cancel(user_id, job.user_id, current)
    except core_lifecycle.OwnershipViolation as e:
        raise PipelineError(str(e), code="FORBIDDEN") from e
    except core_lifecycle.NotCancellable as e:
        raise PipelineError(str(e), code="NOT_CANCELLABLE") from e

    mark_failed(job_id, failed_step="cancelled_by_user", error="유저 취소")
    return {"job_id": job_id, "previous_status": current, "status": "refunded"}


def force_fail_by_admin(job_id: str, reason: str) -> dict:
    """관리자 강제 실패 — 이미 터미널이면 거부."""
    try:
        job = studio_jobs_repo.get(job_id)
    except studio_jobs_repo.JobNotFound as e:
        raise PipelineError(str(e), code="NOT_FOUND") from e

    current: JobStatus = job.status
    try:
        core_lifecycle.check_force_fail(current)
    except core_lifecycle.AlreadyTerminal as e:
        raise PipelineError(str(e), code="ALREADY_TERMINAL") from e

    mark_failed(
        job_id,
        failed_step=f"force_failed_by_admin:{current}",
        error=f"관리자 강제 종료 — {(reason or '')[:500]}",
    )
    return {"job_id": job_id, "previous_status": current, "status": "refunded"}
