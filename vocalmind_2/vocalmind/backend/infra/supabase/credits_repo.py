"""크레딧 RPC 리포지토리 — consume_credits / grant_credits 래퍼."""
from __future__ import annotations

import re

import httpx

from core.credits.rules import validate_amount
from domain_types.credits import (
    CreditsError,
    InsufficientCreditsError,
    LedgerEntry,
)
from infra.supabase import gateway


def _invoke(fn_name: str, args: dict) -> dict:
    try:
        resp = gateway.rpc(fn_name, args=args)
    except gateway.SupabaseConfigError as e:
        raise CreditsError(str(e), code="CONFIG_ERROR") from e
    except httpx.HTTPError as e:
        raise CreditsError(f"Supabase 네트워크 오류: {e}", code="NETWORK_ERROR") from e

    if resp.status_code >= 400:
        error_text = resp.text
        if "INSUFFICIENT_CREDITS" in error_text:
            m = re.search(r"balance=(-?\d+)\s+need=(\d+)", error_text)
            if m:
                raise InsufficientCreditsError(int(m.group(1)), int(m.group(2)))
            raise InsufficientCreditsError(0, 0)
        raise CreditsError(
            f"Supabase RPC {fn_name} 실패 ({resp.status_code}): {error_text[:200]}",
            code="RPC_ERROR",
        )
    return {"result": resp.json()}


def consume(
    user_id: str,
    amount: int,
    reason: str,
    *,
    job_id: str | None = None,
) -> LedgerEntry:
    validate_amount(amount)
    result = _invoke("consume_credits", {
        "p_user_id": user_id,
        "p_amount": amount,
        "p_reason": reason,
        "p_job_id": job_id,
    })
    return LedgerEntry(ledger_id=int(result["result"]))


def grant(
    user_id: str,
    amount: int,
    reason: str,
    *,
    job_id: str | None = None,
    payment_id: str | None = None,
    metadata: dict | None = None,
) -> LedgerEntry:
    validate_amount(amount)
    result = _invoke("grant_credits", {
        "p_user_id": user_id,
        "p_amount": amount,
        "p_reason": reason,
        "p_job_id": job_id,
        "p_payment_id": payment_id,
        "p_metadata": metadata or {},
    })
    return LedgerEntry(ledger_id=int(result["result"]))


def refund_job(user_id: str, job_id: str, amount: int) -> LedgerEntry:
    """실패 job 자동 환불 — grant로 위임."""
    return grant(
        user_id=user_id,
        amount=amount,
        reason="job_refund",
        job_id=job_id,
        metadata={"auto_refund": True},
    )


def balance(user_id: str) -> int:
    """studio_credit_balances view에서 현재 잔액 조회. 없으면 0."""
    try:
        rows = gateway.get(
            "studio_credit_balances",
            params={"user_id": f"eq.{user_id}", "select": "balance"},
        )
    except gateway.SupabaseConfigError as e:
        raise CreditsError(str(e), code="CONFIG_ERROR") from e
    if not rows:
        return 0
    try:
        return int(rows[0].get("balance") or 0)
    except (TypeError, ValueError):
        return 0
