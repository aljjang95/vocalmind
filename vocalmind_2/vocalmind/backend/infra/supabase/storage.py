"""Supabase Storage signed URL 발급."""
from __future__ import annotations

import logging

import httpx

from infra.supabase import gateway

logger = logging.getLogger(__name__)


def sign_url(storage_path: str, *, ttl_sec: int = 3600) -> str | None:
    """bucket/path 형식의 storage_path → full signed URL. 실패 시 None."""
    if not storage_path:
        return None
    bucket, _, path = storage_path.partition("/")
    if not path:
        return None
    try:
        base = gateway.rest_url()
        headers = gateway.headers(prefer=None)
    except gateway.SupabaseConfigError:
        return None

    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(
                f"{base}/storage/v1/object/sign/{bucket}/{path}",
                headers=headers,
                json={"expiresIn": ttl_sec},
            )
            r.raise_for_status()
            data = r.json()
            return f"{base}/storage/v1{data['signedURL']}"
    except Exception as e:
        logger.warning("signed URL 발급 실패 (%s): %s", storage_path, e)
        return None


def patch_scene_plan(job_id: str, scene_plan: dict) -> None:
    """studio_jobs.scene_plan JSONB 업데이트."""
    gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}"},
        json={"scene_plan": scene_plan},
    )


def increment_cost_usd(job_id: str, delta_usd: float) -> None:
    """studio_jobs.cost_usd_actual에 delta 누적. 음수/0은 무시."""
    if delta_usd <= 0:
        return
    rows = gateway.get(
        "studio_jobs",
        params={"id": f"eq.{job_id}", "select": "cost_usd_actual"},
    )
    if not rows:
        return
    current = float(rows[0].get("cost_usd_actual") or 0.0)
    gateway.patch(
        "studio_jobs",
        params={"id": f"eq.{job_id}"},
        json={"cost_usd_actual": round(current + delta_usd, 6)},
    )
