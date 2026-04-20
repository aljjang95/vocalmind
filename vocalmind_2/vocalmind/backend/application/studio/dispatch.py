"""단계별 dispatch — Modal 또는 Runware로 라우팅.

routers/orchestrator가 직접 부르지 않고 modal_callback/runware_callback/start가 호출.
"""
from __future__ import annotations

import logging

from infra.modal import dispatcher as modal
from infra.media import probe
from infra.supabase import storage, studio_jobs_repo
from infra import runware_catalog as cat

from application.studio import lifecycle, scene_pipeline, transitions

logger = logging.getLogger(__name__)


def dispatch_step(job_id: str, step: str) -> None:
    """현재 step에 맞는 외부 호출 실행. transitions는 호출자 책임 or 내부 자동 체인."""
    try:
        job = studio_jobs_repo.get(job_id)
    except studio_jobs_repo.JobNotFound:
        logger.exception("job 조회 실패 job_id=%s", job_id)
        return

    try:
        if step == "vocal_separating":
            _vocal_separating(job_id, job.raw)
        elif step == "vocal_rvc":
            _vocal_rvc(job_id, job.raw)
        elif step == "vocal_mixing":
            _vocal_mixing(job_id, job.raw)
        elif step == "scene_planning":
            _scene_planning(job_id, job.raw)
        elif step == "lipsync":
            # Phase 0: lipsync 스킵 → composing 직결
            result = transitions.advance(job_id, "lipsync", "composing")
            if result.applied:
                dispatch_step(job_id, "composing")
        elif step == "composing":
            _composing(job_id, job.raw)
        elif step == "formatting":
            result = transitions.advance(job_id, "formatting", "watermarking")
            if result.applied:
                dispatch_step(job_id, "watermarking")
        elif step == "watermarking":
            from application.studio import cover_gate
            if cover_gate.check_and_block(job_id, {}):
                return
            result = transitions.advance(job_id, "watermarking", "finalizing")
            if result.applied:
                dispatch_step(job_id, "finalizing")
        elif step == "finalizing":
            from application.studio import finalize
            finalize.finalize_job(job_id)
        else:
            logger.info("[todo] dispatch step=%s for job_id=%s", step, job_id)
    except modal.DispatchError as e:
        logger.exception("dispatch 실패 step=%s: %s", step, e)
        studio_jobs_repo.increment_attempt(job_id)


def redispatch_step(job_id: str, step: str) -> None:
    """재시도 dispatch."""
    dispatch_step(job_id, step)


# ── 단계별 내부 헬퍼 ──────────────────────────────────────────────────

def _vocal_separating(job_id: str, job: dict) -> None:
    input_url = storage.sign_url(job.get("raw_recording_path", ""))
    if not input_url:
        lifecycle.mark_failed(job_id, "vocal_separating", "signed URL 발급 실패")
        return
    output_prefix = f"{job['user_id']}/{job_id}"
    modal.dispatch_demucs(job_id, input_url, output_prefix)


def _vocal_rvc(job_id: str, job: dict) -> None:
    vocals_url = storage.sign_url(job.get("vocals_path", ""))
    if not vocals_url or not job.get("voice_identity_id"):
        lifecycle.mark_failed(job_id, "vocal_rvc", "RVC 입력 누락")
        return
    output_prefix = f"{job['user_id']}/{job_id}"
    modal.dispatch_rvc(job_id, vocals_url, job["voice_identity_id"], output_prefix)


def _vocal_mixing(job_id: str, job: dict) -> None:
    vocals_url = storage.sign_url(job.get("converted_vocals_path", ""))
    instrumental_url = storage.sign_url(job.get("instrumental_path", ""))
    if not vocals_url or not instrumental_url:
        lifecycle.mark_failed(job_id, "vocal_mixing", "vocal_mixing 입력 누락")
        return
    output_prefix = f"{job['user_id']}/{job_id}"
    modal.dispatch_mix(job_id, vocals_url, instrumental_url, output_prefix)


def _scene_planning(job_id: str, job: dict) -> None:
    mix_url = storage.sign_url(job.get("final_vocal_mix_path", ""))
    duration = probe.probe_duration_sec(mix_url) if mix_url else 60.0
    try:
        tier = cat.validate_tier(job.get("quality_tier") or cat.DEFAULT_TIER)
    except ValueError:
        logger.warning("잘못된 quality_tier=%r → DEFAULT_TIER", job.get("quality_tier"))
        tier = cat.DEFAULT_TIER

    scene_pipeline.run(
        job_id=job_id,
        style_preset=job["style_preset"],
        duration_sec=duration,
        tier=tier,
    )

    post = studio_jobs_repo.get(job_id)
    if post.status == "lipsync":
        dispatch_step(job_id, "lipsync")


def _composing(job_id: str, job: dict) -> None:
    scene_plan = job.get("scene_plan") or {}
    scenes = scene_plan.get("scenes", [])
    scene_urls = [s.get("videoUrl") or s.get("video_url") for s in scenes]
    scene_urls = [u for u in scene_urls if u]
    mix_url = storage.sign_url(job.get("final_vocal_mix_path", ""))
    if not scene_urls or not mix_url:
        lifecycle.mark_failed(job_id, "composing", "composing 입력 누락")
        return
    output_prefix = f"{job['user_id']}/{job_id}"
    modal.dispatch_compose(
        job_id=job_id,
        scene_video_urls=scene_urls,
        final_vocal_mix_url=mix_url,
        output_prefix=output_prefix,
    )
