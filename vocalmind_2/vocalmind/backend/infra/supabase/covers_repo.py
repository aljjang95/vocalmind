"""covers 테이블 리포지토리 — finalize 시 upsert."""
from __future__ import annotations

import httpx

from infra.supabase import gateway


def upsert_cover(cover: dict) -> None:
    """job_id unique index 기준 upsert. 실패 시 SupabaseError."""
    url = f"{gateway.rest_url()}/rest/v1/covers"
    headers = gateway.headers(prefer="resolution=merge-duplicates,return=representation")
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(url, json=cover, headers=headers)
    if resp.status_code >= 400:
        raise gateway.SupabaseError(
            f"covers upsert 실패 ({resp.status_code}): {resp.text[:200]}",
            status_code=resp.status_code,
        )
