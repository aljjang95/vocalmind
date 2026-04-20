"""Runware 완료 콜백 처리 — 씬 URL 축적 + 모든 씬 완료 시 다음 단계 전이."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from core.studio import scene_plan as core_scene
from core.studio import state_machine
from core.studio.status import next_status
from infra.supabase import storage, studio_jobs_repo

from application.studio import dispatch, lifecycle, transitions

logger = logging.getLogger(__name__)

RunwareStep = Literal["scene_image_gen", "scene_video_gen", "lipsync"]


@dataclass(frozen=True)
class CallbackOutcome:
    accepted: bool
    next_step: str | None


def handle(
    job_id: str,
    task_id: str,
    step: RunwareStep,
    status: Literal["success", "failed"],
    scene_id: str | None,
    result_url: str | None,
    error: str | None,
) -> CallbackOutcome:
    if status == "failed":
        attempts = studio_jobs_repo.increment_attempt(job_id)
        job = studio_jobs_repo.get(job_id)
        if state_machine.is_retry_exhausted(attempts, job.max_attempts):
            lifecycle.mark_failed(job_id, failed_step=step, error=error or "unknown")
            return CallbackOutcome(accepted=True, next_step="failed")
        logger.warning(
            "Runware 실패 (%d/%d) job=%s step=%s task=%s: %s",
            attempts, job.max_attempts, job_id, step, task_id, error,
        )
        return CallbackOutcome(accepted=True, next_step=step)

    if scene_id and result_url:
        _accumulate_scene_url(job_id, scene_id, step, result_url)
    else:
        logger.warning("Runware 콜백 scene_id/url 누락 job=%s step=%s", job_id, step)

    job = studio_jobs_repo.get(job_id)
    scene_plan = job.get("scene_plan") or {}
    scenes = scene_plan.get("scenes") or []
    if core_scene.all_assets_ready(scenes, step):
        nxt = next_status(step)
        if nxt is None:
            return CallbackOutcome(accepted=True, next_step=None)
        outcome = transitions.advance(job_id, step, nxt)  # type: ignore[arg-type]
        if outcome.applied:
            logger.info("모든 씬 완료 → %s 전이 job=%s", nxt, job_id)
            dispatch.dispatch_step(job_id, nxt)
        return CallbackOutcome(accepted=True, next_step=nxt)

    return CallbackOutcome(accepted=True, next_step=step)


def _accumulate_scene_url(job_id: str, scene_id: str, step: RunwareStep, result_url: str) -> None:
    job = studio_jobs_repo.get(job_id)
    scene_plan = job.get("scene_plan") or {}
    scenes = scene_plan.get("scenes") or []

    updated, matched = core_scene.upsert_scene_url(scenes, scene_id, step, result_url)
    if not matched:
        logger.error(
            "scene_id 매핑 불가 job=%s scene=%s step=%s — URL 유실", job_id, scene_id, step,
        )
        return

    scene_plan["scenes"] = updated
    storage.patch_scene_plan(job_id, scene_plan)
