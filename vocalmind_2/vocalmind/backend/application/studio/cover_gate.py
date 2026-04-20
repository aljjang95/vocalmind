"""Stage 3 모더레이션 게이트 — watermarking 직후 커버 결과물 검증."""
from __future__ import annotations

import logging

from core.moderation import verdict
from core.studio import scene_plan as core_scene
from infra.supabase import moderation_repo, studio_jobs_repo

from application.studio import lifecycle

logger = logging.getLogger(__name__)


def check_and_block(job_id: str, result: dict) -> bool:
    """모더레이션 차단 시 True 반환(mark_failed 이미 호출). 통과 시 False.

    result: Modal/Runware 최신 콜백 페이로드.
    """
    try:
        job = studio_jobs_repo.get(job_id)
    except studio_jobs_repo.JobNotFound:
        logger.exception("[moderation stage3] job 조회 실패 %s", job_id)
        return False

    scene_plan = job.get("scene_plan") or {}
    scenes = scene_plan.get("scenes") or []
    scene_prompts = core_scene.collect_scene_prompts(scenes)
    output_url = job.get("landscape_url") or result.get("landscape_path")
    duration_sec = scene_plan.get("total_duration_sec")
    if duration_sec is None:
        duration_sec = core_scene.total_duration_sec(scenes) or None

    mod = verdict.judge_cover_output(
        output_url=output_url,
        duration_sec=duration_sec,
        scene_prompts=scene_prompts,
    )
    moderation_repo.log_events(job.user_id, mod, job_id=job_id)

    if mod.decision == "block":
        categories = ",".join(sorted({e.category for e in mod.events})) or "unknown"
        lifecycle.mark_failed(
            job_id,
            failed_step="watermarking",
            error=f"moderation block: {categories}",
        )
        return True
    return False
