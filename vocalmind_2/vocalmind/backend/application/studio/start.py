"""start_job — BFF가 studio_jobs insert + 크레딧 차감 완료 후 호출."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from infra.supabase import studio_jobs_repo

from application.studio import dispatch, transitions

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StartOutcome:
    job_id: str
    status: str


def start_job(job_id: str) -> StartOutcome:
    """pending → vocal_separating 전이 + demucs dispatch 예약(호출자 BackgroundTasks에 위임)."""
    job = studio_jobs_repo.get(job_id)
    if job.status != "pending":
        logger.info("job_id=%s 이미 진행 중 (status=%s)", job_id, job.status)
        return StartOutcome(job_id=job_id, status=job.status)

    result = transitions.advance(
        job_id, "pending", "vocal_separating", extra_fields={"started_at": "now()"},
    )
    if not result.applied:
        current = studio_jobs_repo.get(job_id)
        return StartOutcome(job_id=job_id, status=current.status)

    return StartOutcome(job_id=job_id, status="vocal_separating")


def dispatch_first(job_id: str) -> None:
    """라우터 BackgroundTasks에서 호출되는 첫 dispatch (demucs)."""
    dispatch.dispatch_step(job_id, "vocal_separating")
