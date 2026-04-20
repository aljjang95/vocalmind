"""상태 전이 유스케이스 — core(계획) + infra(실행) + 진행률/레이블 주입."""
from __future__ import annotations

from dataclasses import dataclass

from core.studio.status import STEP_LABEL, STEP_PROGRESS
from domain_types.studio import JobStatus
from infra.supabase import studio_jobs_repo


@dataclass(frozen=True)
class TransitionOutcome:
    job_id: str
    from_status: JobStatus
    to_status: JobStatus
    applied: bool


def advance(
    job_id: str,
    expect: JobStatus,
    to: JobStatus,
    *,
    extra_fields: dict | None = None,
) -> TransitionOutcome:
    """낙관적 잠금으로 expect→to 전이. progress/label 자동 주입."""
    payload: dict = dict(extra_fields or {})
    progress = STEP_PROGRESS.get(to)
    label = STEP_LABEL.get(to)
    if progress is not None:
        payload["progress_pct"] = progress
    if label is not None:
        payload["current_step_label"] = label

    result = studio_jobs_repo.transition_guarded(
        job_id, expect=expect, to=to, patch_fields=payload,
    )
    return TransitionOutcome(
        job_id=job_id,
        from_status=expect,
        to_status=to,
        applied=result.applied,
    )
