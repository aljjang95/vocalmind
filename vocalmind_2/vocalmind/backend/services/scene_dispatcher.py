"""Scene Dispatcher — Runware 기반 씬 이미지/비디오/립싱크 오케스트레이션.

Phase 0 간이 구현: 동기 polling 방식 (FastAPI BackgroundTasks에서 호출).
- 씬 이미지 N장 순차 생성 (병렬은 Phase 1에서 asyncio)
- 각 이미지 → 영상 클립 (image-to-video)
- 전체 씬 완료 후 studio_jobs.scene_plan 업데이트 + 다음 단계 전이

마스터 각인(feedback_vocalmind_bond_quality_first.md):
- 티어별 모델 선택 (draft/pro/studio)
- BudgetExceeded로 누적 원가가 예산 상한을 넘으면 즉시 중단 → 낭비 방지.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from infra import runware_client as rw
from infra import runware_catalog as cat
from services import studio_pipeline as pipeline

logger = logging.getLogger(__name__)


class SceneDispatchError(Exception):
    """씬 처리 실패."""


class BudgetExceeded(SceneDispatchError):
    """티어 예산 상한 초과 — 낭비 방지 가드."""
    def __init__(self, planned_usd: float, budget_usd: float, tier: str):
        super().__init__(
            f"예산 초과: tier={tier} spent=${planned_usd:.3f} budget=${budget_usd:.3f}"
        )
        self.planned_usd = planned_usd
        self.budget_usd = budget_usd
        self.tier = tier


def process_scene_images(
    job_id: str,
    scenes: list[dict],
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
    budget_remaining_usd: float | None = None,
) -> tuple[list[dict], float]:
    """각 씬 프롬프트 → 이미지 URL. (씬목록, 누적_원가_usd) 반환.

    티어에 따라 모델/해상도 자동 선택:
      draft  → FLUX Schnell 1024x576
      pro    → Seedream 4.5 1920x1080
      studio → Seedream 5.0 Lite 2048x1152

    budget_remaining_usd: 이 값이 주어지면 초과 직전 중단 (BudgetExceeded).
    이미 생성된 씬은 유지, 미완료 씬은 error="budget_exceeded".
    """
    spec = cat.tier_spec(tier)
    model = spec.image_model
    width, height = spec.image_resolution

    out: list[dict] = []
    total_cost = 0.0
    for scene in scenes:
        # 예산 가드 — 다음 호출 전에 확인
        if budget_remaining_usd is not None and total_cost >= budget_remaining_usd:
            logger.warning(
                "씬 이미지 예산 초과 중단 job=%s spent=$%.3f budget=$%.3f",
                job_id, total_cost, budget_remaining_usd,
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
                steps=4,
            )
            total_cost += cost
            out.append({**scene, "image_url": url, "image_cost_usd": cost, "image_model": model})
        except rw.RunwareError as e:
            logger.warning("씬 이미지 생성 실패 scene=%s: %s", scene.get("id"), e)
            out.append({**scene, "image_url": None, "error": str(e)})
    return out, total_cost


def process_scene_videos(
    job_id: str,
    scenes: list[dict],
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
    poll_timeout: int = 600,
    budget_remaining_usd: float | None = None,
) -> tuple[list[dict], float]:
    """각 씬 image_url → 비디오 URL. (씬목록, 누적_원가_usd) 반환.

    티어에 따라 비디오 모델·해상도 자동 선택:
      draft  → Wan 2.2 1024x576
      pro    → Kling 2.6 Pro 1280x720
      studio → Kling 3.0 Pro 1920x1080

    budget_remaining_usd: 예산 초과 직전 중단 (미생성 씬은 error=budget_exceeded).
    """
    spec = cat.tier_spec(tier)
    model = spec.video_model
    width, height = spec.video_resolution

    out: list[dict] = []
    total_cost = 0.0
    for scene in scenes:
        if not scene.get("image_url"):
            out.append({**scene, "video_url": None, "error": "no image"})
            continue

        # 예산 가드
        if budget_remaining_usd is not None and total_cost >= budget_remaining_usd:
            logger.warning(
                "씬 비디오 예산 초과 중단 job=%s spent=$%.3f budget=$%.3f",
                job_id, total_cost, budget_remaining_usd,
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
                    **scene, "video_url": final.result_url,
                    "video_cost_usd": final.cost_usd,
                    "video_model": model,
                })
            else:
                out.append({
                    **scene, "video_url": None,
                    "error": final.error or "video task failed",
                })
        except rw.RunwareError as e:
            logger.warning("씬 영상 생성 실패 scene=%s: %s", scene.get("id"), e)
            out.append({**scene, "video_url": None, "error": str(e)})
    return out, total_cost


def increment_cost_usd(job_id: str, delta_usd: float) -> None:
    """studio_jobs.cost_usd_actual에 delta 원자적 누적.

    Supabase REST는 SQL 계산식을 지원하지 않아 SELECT → UPDATE 2단계.
    동시 쓰기는 scene_dispatcher가 단일 스레드로 실행되므로 경합 없음.
    """
    import os
    if delta_usd <= 0:
        return
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("SUPABASE 환경변수 누락 — cost 기록 생략")
        return

    with httpx.Client(timeout=10.0) as client:
        r = client.get(
            f"{url}/rest/v1/studio_jobs",
            params={"id": f"eq.{job_id}", "select": "cost_usd_actual"},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        if r.status_code != 200:
            logger.warning("cost 조회 실패 job_id=%s: %s", job_id, r.text[:200])
            return
        rows = r.json()
        if not rows:
            return
        current = float(rows[0].get("cost_usd_actual") or 0.0)
        new_total = round(current + delta_usd, 6)

        r = client.patch(
            f"{url}/rest/v1/studio_jobs",
            params={"id": f"eq.{job_id}"},
            json={"cost_usd_actual": new_total},
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )
        if r.status_code >= 400:
            logger.warning("cost 기록 실패 job_id=%s: %s", job_id, r.text[:200])


def update_scene_plan(job_id: str, scenes: list[dict]) -> None:
    """studio_jobs.scene_plan JSONB 업데이트."""
    import os

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SceneDispatchError("SUPABASE 환경변수 누락")

    with httpx.Client(timeout=15.0) as client:
        r = client.patch(
            f"{url}/rest/v1/studio_jobs",
            params={"id": f"eq.{job_id}"},
            json={"scene_plan": {"scenes": scenes}},
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()


def run_scene_pipeline(
    job_id: str,
    style_preset: str,
    duration_sec: float,
    *,
    tier: cat.QualityTier = cat.DEFAULT_TIER,
) -> None:
    """scene_planning → scene_image_gen → scene_video_gen 체인 실행.

    FastAPI BackgroundTasks에서 호출. 각 단계 완료 시 studio_jobs UPDATE.

    tier: draft/pro/studio — 모델 선택 + 예산 상한 자동 적용.
    누적 원가가 예산을 초과하면 이미지 단계에서 중단, 영상 단계 진입 차단.
    """
    from services import scene_planner

    spec = cat.tier_spec(tier)
    budget = spec.budget_usd

    # 1) 플랜 생성
    try:
        scenes = scene_planner.plan_scenes(
            style_preset=style_preset,  # type: ignore[arg-type]
            total_duration_sec=duration_sec,
        )
        # 스타일 앵커 보강 (카탈로그 통합 버전)
        for s in scenes:
            if isinstance(s.get("prompt"), str):
                s["prompt"] = cat.apply_style(s["prompt"], style_preset)  # type: ignore[arg-type]
        update_scene_plan(job_id, scenes)
    except Exception as e:
        logger.exception("scene_planning 실패: %s", e)
        pipeline.mark_failed(job_id, "scene_planning", str(e))
        return

    # 2) 이미지 → scene_image_gen (티어별 예산 절반 할당)
    pipeline.transition(job_id, "scene_planning", "scene_image_gen")
    image_budget = budget * 0.2  # 이미지 20%, 비디오 80% 경험값
    scenes, img_cost = process_scene_images(
        job_id, scenes, tier=tier, budget_remaining_usd=image_budget,
    )
    increment_cost_usd(job_id, img_cost)
    if all(s.get("image_url") is None for s in scenes):
        pipeline.mark_failed(job_id, "scene_image_gen", "모든 씬 이미지 생성 실패")
        return
    update_scene_plan(job_id, scenes)

    # 3) 영상 → scene_video_gen (남은 예산으로)
    pipeline.transition(job_id, "scene_image_gen", "scene_video_gen")
    remaining = max(0.0, budget - img_cost)
    scenes, vid_cost = process_scene_videos(
        job_id, scenes, tier=tier, budget_remaining_usd=remaining,
    )
    increment_cost_usd(job_id, vid_cost)
    if all(s.get("video_url") is None for s in scenes):
        pipeline.mark_failed(job_id, "scene_video_gen", "모든 씬 영상 생성 실패")
        return
    update_scene_plan(job_id, scenes)

    # 예산 초과 확정 시 mark_failed + 환불 — 부분 성공도 중단
    total_cost = img_cost + vid_cost
    if total_cost > budget:
        logger.warning(
            "scene_dispatcher: 예산 초과 종료 job=%s tier=%s total=$%.3f budget=$%.3f",
            job_id, tier, total_cost, budget,
        )
        pipeline.mark_failed(
            job_id, "scene_video_gen",
            f"budget_exceeded: tier={tier} total=${total_cost:.3f} budget=${budget:.3f}",
        )
        return

    # 4) lipsync 단계로 전이 (실제 립싱크 호출은 W3 후반부에서 연결)
    pipeline.transition(job_id, "scene_video_gen", "lipsync")
