"""Runware 씬 생성기 — 이미지/비디오 I/O 전담. 파이프라인 제어 없음.

예산 초과는 호출자(application)가 core.studio.budget로 계산해 전달.
"""
from __future__ import annotations

import logging

from infra import runware_client as rw
from infra import runware_catalog as cat

logger = logging.getLogger(__name__)


def process_scene_images(
    scenes: list[dict],
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
    budget_remaining_usd: float | None = None,
) -> tuple[list[dict], float]:
    """씬 프롬프트 → 이미지 URL. (갱신된 씬 리스트, 누적 USD)."""
    spec = cat.tier_spec(tier)
    model = spec.image_model
    width, height = spec.image_resolution
    steps = 4 if "runware:100" in model else 20

    out: list[dict] = []
    total_cost = 0.0
    for scene in scenes:
        if budget_remaining_usd is not None and total_cost >= budget_remaining_usd:
            logger.warning(
                "씬 이미지 예산 소진 spent=$%.3f budget=$%.3f",
                total_cost, budget_remaining_usd,
            )
            out.append({**scene, "image_url": None, "error": "budget_exceeded"})
            continue

        prompt = scene["prompt"]
        try:
            url, cost = rw.generate_image_with_cost(
                prompt,
                width=width,
                height=height,
                model=model,
                steps=steps,
            )
            total_cost += cost
            out.append({
                **scene,
                "image_url": url,
                "image_cost_usd": cost,
                "image_model": model,
            })
        except rw.RunwareError as e:
            logger.warning("씬 이미지 생성 실패 scene=%s: %s", scene.get("id"), e)
            out.append({**scene, "image_url": None, "error": str(e)})
    return out, total_cost


def process_scene_videos(
    scenes: list[dict],
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
    poll_timeout: int = 600,
    budget_remaining_usd: float | None = None,
) -> tuple[list[dict], float]:
    """각 씬 image_url → 비디오 URL."""
    spec = cat.tier_spec(tier)
    model = spec.video_model
    width, height = spec.video_resolution

    out: list[dict] = []
    total_cost = 0.0
    for scene in scenes:
        if not scene.get("image_url"):
            out.append({**scene, "video_url": None, "error": "no image"})
            continue

        if budget_remaining_usd is not None and total_cost >= budget_remaining_usd:
            logger.warning(
                "씬 비디오 예산 소진 spent=$%.3f budget=$%.3f",
                total_cost, budget_remaining_usd,
            )
            out.append({**scene, "video_url": None, "error": "budget_exceeded"})
            continue

        try:
            task = rw.generate_video(
                prompt=scene["prompt"],
                duration_sec=scene.get("duration_sec", 10.0),
                width=width,
                height=height,
                model=model,
                image_url=scene["image_url"],
            )
            final = rw.wait_for_task(task.task_id, timeout_sec=poll_timeout)
            total_cost += final.cost_usd
            if final.status == "success" and final.result_url:
                out.append({
                    **scene,
                    "video_url": final.result_url,
                    "video_cost_usd": final.cost_usd,
                    "video_model": model,
                })
            else:
                out.append({
                    **scene,
                    "video_url": None,
                    "error": final.error or "video task failed",
                })
        except rw.RunwareError as e:
            logger.warning("씬 영상 생성 실패 scene=%s: %s", scene.get("id"), e)
            out.append({**scene, "video_url": None, "error": str(e)})
    return out, total_cost
