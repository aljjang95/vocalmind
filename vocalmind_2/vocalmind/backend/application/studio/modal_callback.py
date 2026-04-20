"""Modal 완료 콜백 처리 — 다음 단계 전이 + dispatch."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from core.studio import state_machine
from core.studio.status import next_status
from infra.supabase import studio_jobs_repo

from application.studio import cover_gate, dispatch, lifecycle, transitions

logger = logging.getLogger(__name__)

ModalStep = Literal[
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "composing", "formatting", "watermarking",
]


@dataclass(frozen=True)
class CallbackOutcome:
    accepted: bool
    next_step: str | None


def handle(
    job_id: str,
    step: ModalStep,
    status: Literal["success", "failed"],
    result: dict,
    error: str | None,
) -> CallbackOutcome:
    if status == "failed":
        return _handle_failure(job_id, step, error)

    # Stage 3 gate — watermarking 성공 콜백에만 적용
    if step == "watermarking":
        if cover_gate.check_and_block(job_id, result):
            return CallbackOutcome(accepted=True, next_step="failed")

    nxt = next_status(step)
    if nxt is None:
        return CallbackOutcome(accepted=True, next_step=None)

    outcome = transitions.advance(
        job_id,
        step,  # type: ignore[arg-type]
        nxt,
        extra_fields=_result_to_fields(step, result),
    )
    if outcome.applied:
        dispatch.dispatch_step(job_id, nxt)
    return CallbackOutcome(accepted=True, next_step=nxt)


def _handle_failure(job_id: str, step: ModalStep, error: str | None) -> CallbackOutcome:
    attempts = studio_jobs_repo.increment_attempt(job_id)
    job = studio_jobs_repo.get(job_id)
    if state_machine.is_retry_exhausted(attempts, job.max_attempts):
        lifecycle.mark_failed(job_id, failed_step=step, error=error or "unknown")
        return CallbackOutcome(accepted=True, next_step="failed")
    dispatch.redispatch_step(job_id, step)
    return CallbackOutcome(accepted=True, next_step=step)


def _result_to_fields(step: ModalStep, result: dict) -> dict:
    mapping: dict[str, dict] = {
        "vocal_separating": {
            "vocals_path": result.get("vocals_path"),
            "instrumental_path": result.get("instrumental_path"),
        },
        "vocal_rvc": {"converted_vocals_path": result.get("converted_vocals_path")},
        "vocal_mixing": {"final_vocal_mix_path": result.get("final_vocal_mix_path")},
        "composing": {
            "landscape_url": result.get("landscape_path"),
            "portrait_url": result.get("portrait_path"),
            "thumbnail_url": result.get("thumbnail_path"),
            "c2pa_signed": result.get("c2pa_signed", False),
        },
    }
    fields = mapping.get(step, {})
    return {k: v for k, v in fields.items() if v is not None}
