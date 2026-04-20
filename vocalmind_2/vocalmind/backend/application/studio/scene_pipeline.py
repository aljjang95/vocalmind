"""Scene pipeline — planning → image → video → lipsync 체인.

core(budget·scene_plan) + infra.runware(생성) + infra.supabase(저장) 조합.
"""
from __future__ import annotations

import logging

from core.studio import budget as core_budget
from infra import runware_catalog as cat
from infra.runware import scene_dispatcher as rw_scene
from infra.supabase import storage, studio_jobs_repo

from application.studio import lifecycle, scene_planner, transitions

logger = logging.getLogger(__name__)


def run(
    job_id: str,
    style_preset: str,
    duration_sec: float,
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
) -> None:
    """scene_planning → scene_image_gen → scene_video_gen → lipsync까지 동기 실행.

    실패 시 lifecycle.mark_failed(환불 포함). 성공 시 lipsync 전이까지 수행.
    """
    spec = cat.tier_spec(tier)
    budget_total = spec.budget_usd

    # 1) plan 생성
    try:
        scenes = scene_planner.plan_scenes(
            style_preset=style_preset,  # type: ignore[arg-type]
            total_duration_sec=duration_sec,
        )
        for s in scenes:
            if isinstance(s.get("prompt"), str):
                s["prompt"] = cat.apply_style(s["prompt"], style_preset)  # type: ignore[arg-type]
        storage.patch_scene_plan(job_id, {"scenes": scenes})
    except Exception as e:
        logger.exception("scene_planning 실패: %s", e)
        lifecycle.mark_failed(job_id, "scene_planning", str(e))
        return

    # 2) images
    transitions.advance(job_id, "scene_planning", "scene_image_gen")
    image_cap = core_budget.image_budget(budget_total)
    scenes, img_cost = rw_scene.process_scene_images(
        scenes, tier=tier, budget_remaining_usd=image_cap,
    )
    storage.increment_cost_usd(job_id, img_cost)
    if all(s.get("image_url") is None for s in scenes):
        lifecycle.mark_failed(job_id, "scene_image_gen", "모든 씬 이미지 생성 실패")
        return
    storage.patch_scene_plan(job_id, {"scenes": scenes})

    # 3) videos
    transitions.advance(job_id, "scene_image_gen", "scene_video_gen")
    video_cap = core_budget.video_budget(budget_total, spent_on_images=img_cost)
    scenes, vid_cost = rw_scene.process_scene_videos(
        scenes, tier=tier, budget_remaining_usd=video_cap,
    )
    storage.increment_cost_usd(job_id, vid_cost)
    if all(s.get("video_url") is None for s in scenes):
        lifecycle.mark_failed(job_id, "scene_video_gen", "모든 씬 영상 생성 실패")
        return
    storage.patch_scene_plan(job_id, {"scenes": scenes})

    total_cost = img_cost + vid_cost
    if core_budget.is_exceeded(total_cost, budget_total):
        logger.warning(
            "scene pipeline 예산 초과 job=%s tier=%s total=$%.3f budget=$%.3f",
            job_id, tier, total_cost, budget_total,
        )
        lifecycle.mark_failed(
            job_id, "scene_video_gen",
            f"budget_exceeded: tier={tier} total=${total_cost:.3f} budget=${budget_total:.3f}",
        )
        return

    # 4) lipsync (Phase 0은 스킵 — 그대로 video 사용)
    transitions.advance(job_id, "scene_video_gen", "lipsync")
