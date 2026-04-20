"""Supabase REST 단일 게이트웨이.

service role 키를 읽는 유일한 장소. 모든 Supabase 호출은 이 모듈을 경유한다.
"""
from __future__ import annotations

import os

import httpx

DEFAULT_TIMEOUT = 10.0


class SupabaseConfigError(RuntimeError):
    """SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락."""


def _config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SupabaseConfigError("SUPABASE 환경변수 누락")
    return url, key


def rest_url() -> str:
    """Supabase REST base URL."""
    url, _ = _config()
    return url


def headers(*, prefer: str | None = "return=representation") -> dict[str, str]:
    """공통 헤더 (apikey + Authorization + Content-Type)."""
    _, key = _config()
    h = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def get(
    table: str,
    *,
    params: dict[str, str],
    timeout: float = DEFAULT_TIMEOUT,
) -> list[dict]:
    """SELECT. 200 아니면 raise_for_status."""
    url = f"{rest_url()}/rest/v1/{table}"
    with httpx.Client(timeout=timeout) as client:
        r = client.get(url, params=params, headers=headers(prefer=None))
        r.raise_for_status()
        data = r.json()
    return data if isinstance(data, list) else []


def patch(
    table: str,
    *,
    params: dict[str, str],
    json: dict,
    prefer: str | None = "return=representation",
    timeout: float = DEFAULT_TIMEOUT,
) -> list[dict]:
    """PATCH. 반환: representation 모드 시 영향받은 rows."""
    url = f"{rest_url()}/rest/v1/{table}"
    with httpx.Client(timeout=timeout) as client:
        r = client.patch(url, params=params, json=json, headers=headers(prefer=prefer))
    if r.status_code >= 400:
        raise SupabaseError(
            f"PATCH {table} 실패 ({r.status_code}): {r.text[:200]}",
            status_code=r.status_code,
        )
    try:
        data = r.json()
    except ValueError:
        return []
    return data if isinstance(data, list) else []


def post(
    table: str,
    *,
    json: dict | list,
    prefer: str | None = "return=representation",
    timeout: float = DEFAULT_TIMEOUT,
) -> list[dict]:
    """INSERT."""
    url = f"{rest_url()}/rest/v1/{table}"
    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, json=json, headers=headers(prefer=prefer))
    if r.status_code >= 400:
        raise SupabaseError(
            f"POST {table} 실패 ({r.status_code}): {r.text[:200]}",
            status_code=r.status_code,
        )
    try:
        data = r.json()
    except ValueError:
        return []
    return data if isinstance(data, list) else []


def rpc(
    fn_name: str,
    *,
    args: dict,
    timeout: float = DEFAULT_TIMEOUT,
) -> httpx.Response:
    """RPC 호출 — 응답 파싱은 호출자 책임(Postgres 예외 메시지 추출 필요)."""
    url = f"{rest_url()}/rest/v1/rpc/{fn_name}"
    return httpx.post(url, json=args, headers=headers(prefer=None), timeout=timeout)


class SupabaseError(Exception):
    """Supabase 호출 실패."""
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code
