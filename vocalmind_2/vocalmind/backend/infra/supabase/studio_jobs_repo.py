"""studio_jobs 테이블 리포지토리 — 게이트웨이 래퍼."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from domain_types.studio import ACTIVE_STATUSES, JobStatus, StudioJob
from infra.supabase import gateway

logger = logging.getLogger(__name__)


class JobNotFound(Exception):
    """해당 id의 job 없음."""
    def __init__(self, job_id: str):
        super().__init__(f"job 없음: {job_id}")
        self.job_id = job_id


@dataclass(frozen=True)
class TransitionResult:
    job_id: str
    from_status: JobStatus
    to_status: JobStatus
    applied: bool


def get(job_id: str) -> StudioJob:
    rows = gateway.get(
        "studio_jobs",
        params={"id": f"eq.{job_id}", "select": "*"},
    )
    if not rows:
        raise JobNotFound(job_id)
    return StudioJob.from_row(rows[0])


def transition_guarded(
    job_id: str,
    *,
    expect: JobStatus,
    to: JobStatus,
    patch_fields: dict | None = None,
) -> TransitionResult:
    """낙관적 잠금 전이 — WHERE id=? AND status=expect."""
    payload = {"status": to}
    if patch_fields:
        payload.update(patch_fields)

    rows = gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}", "status": f"eq.{expect}"},
        json=payload,
    )
    return TransitionResult(
        job_id=job_id,
        from_status=expect,
        to_status=to,
        applied=len(rows) > 0,
    )


def patch_raw(job_id: str, fields: dict) -> list[dict]:
    """단순 컬럼 업데이트 (status 가드 없음)."""
    return gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}"},
        json=fields,
    )


def patch_if_not_terminal(job_id: str, fields: dict) -> list[dict]:
    """failed/refunded가 아닐 때만 patch. 반환 empty면 이미 터미널."""
    return gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}", "status": "not.in.(failed,refunded)"},
        json=fields,
    )


def increment_attempt(job_id: str) -> int:
    """attempt_count += 1 → 현재 값 반환."""
    rows = gateway.get(
        "studio_jobs",
        params={"id": f"eq.{job_id}", "select": "attempt_count,max_attempts"},
    )
    if not rows:
        raise JobNotFound(job_id)
    new_count = int(rows[0]["attempt_count"]) + 1
    gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}"},
        json={"attempt_count": new_count},
    )
    return new_count


def list_stuck(older_than_minutes: int = 30, limit: int = 100) -> list[dict]:
    """N분 이상 updated_at 변동 없는 active job."""
    threshold = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    statuses_csv = ",".join(sorted(ACTIVE_STATUSES))
    return gateway.get(
        "studio_jobs",
        params={
            "status": f"in.({statuses_csv})",
            "updated_at": f"lt.{threshold.isoformat()}",
            "select": (
                "id,user_id,status,cost_credits,attempt_count,"
                "last_error,created_at,updated_at"
            ),
            "order": "updated_at.asc",
            "limit": str(limit),
        },
    )
