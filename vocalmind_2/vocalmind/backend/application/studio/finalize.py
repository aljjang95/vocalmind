"""finalize — covers 레코드 upsert + completed 전이."""
from __future__ import annotations

import logging

from infra.supabase import covers_repo, studio_jobs_repo

from application.studio import lifecycle, transitions

logger = logging.getLogger(__name__)


def finalize_job(job_id: str) -> None:
    try:
        job = studio_jobs_repo.get(job_id)
    except studio_jobs_repo.JobNotFound:
        logger.exception("finalize: job 조회 실패 %s", job_id)
        return

    landscape = job.get("landscape_url")
    portrait = job.get("portrait_url")
    thumbnail = job.get("thumbnail_url")
    if not landscape or not portrait or not thumbnail:
        lifecycle.mark_failed(job_id, "finalizing", "최종 URL 누락")
        return

    cover = {
        "user_id": job.user_id,
        "job_id": job_id,
        "title": job.get("title") or "AI Cover",
        "landscape_url": landscape,
        "portrait_url": portrait,
        "thumbnail_url": thumbnail,
        "duration_sec": job.get("duration_sec") or 30.0,
        "sns_uploadable": False,
    }
    try:
        covers_repo.upsert_cover(cover)
    except Exception as e:
        logger.exception("covers upsert 실패: %s", e)
        lifecycle.mark_failed(job_id, "finalizing", f"covers upsert 실패: {str(e)[:200]}")
        return

    result = transitions.advance(
        job_id, "finalizing", "completed", extra_fields={"completed_at": "now()"},
    )
    if result.applied:
        logger.info("job 완료 job_id=%s", job_id)
