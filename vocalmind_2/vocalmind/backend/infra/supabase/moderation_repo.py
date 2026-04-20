"""moderation_events append-only 로깅."""
from __future__ import annotations

import logging

import httpx

from domain_types.moderation import ModerationResult
from infra.supabase import gateway

logger = logging.getLogger(__name__)


def log_events(
    user_id: str,
    result: ModerationResult,
    *,
    job_id: str | None = None,
    decided_by: str = "auto",
) -> int:
    """moderation_events에 append. best effort — 실패해도 예외 던지지 않음."""
    if not result.events:
        return 0

    try:
        url = f"{gateway.rest_url()}/rest/v1/moderation_events"
        headers = gateway.headers(prefer="return=minimal")
    except gateway.SupabaseConfigError:
        logger.warning("moderation: SUPABASE env missing — skipping log")
        return 0

    rows = [{
        "user_id": user_id,
        "job_id": job_id,
        "category": e.category,
        "severity": e.severity,
        "detail": e.detail,
        "decided_by": decided_by,
    } for e in result.events]

    try:
        resp = httpx.post(url, json=rows, headers=headers, timeout=5.0)
        if resp.status_code >= 400:
            logger.warning("moderation log failed %s: %s", resp.status_code, resp.text[:200])
            return 0
    except httpx.HTTPError as e:
        logger.warning("moderation log network error: %s", e)
        return 0
    return len(rows)
