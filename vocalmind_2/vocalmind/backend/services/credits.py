"""크레딧 서비스 — Supabase RPC(consume_credits/grant_credits) 래퍼.

Phase 0: append-only 원장 기반. 직접 insert 금지, RPC 경유만.
- consume: 차감 (음수 잔액 차단, advisory lock 직렬화)
- grant: 충전/환불 (양수 delta)
- balance: 잔액 조회 (view 기반)
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

ConsumeReason = Literal["cover_consume", "scene_regen"]
GrantReason = Literal[
    "signup_bonus", "topup_purchase", "job_refund", "referral", "admin_adjust"
]


class CreditsError(Exception):
    """크레딧 처리 실패."""
    def __init__(self, message: str, *, code: str = "CREDITS_ERROR"):
        super().__init__(message)
        self.code = code


class InsufficientCreditsError(CreditsError):
    """잔액 부족."""
    def __init__(self, balance: int, needed: int):
        super().__init__(
            f"크레딧 부족: balance={balance} need={needed}",
            code="INSUFFICIENT_CREDITS",
        )
        self.balance = balance
        self.needed = needed


@dataclass(frozen=True)
class LedgerEntry:
    """원장 한 줄 (반환값)."""
    ledger_id: int


def _supabase_rpc(fn_name: str, args: dict) -> dict:
    """Supabase RPC 호출 — service role 키 사용."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise CreditsError("SUPABASE 환경변수 누락", code="CONFIG_ERROR")

    endpoint = f"{url}/rest/v1/rpc/{fn_name}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    try:
        resp = httpx.post(endpoint, json=args, headers=headers, timeout=10.0)
    except httpx.HTTPError as e:
        raise CreditsError(f"Supabase 네트워크 오류: {e}", code="NETWORK_ERROR") from e

    if resp.status_code >= 400:
        # Postgres 예외 메시지 추출
        error_text = resp.text
        if "INSUFFICIENT_CREDITS" in error_text:
            # "INSUFFICIENT_CREDITS: balance=3 need=5" 파싱
            import re
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
    reason: ConsumeReason,
    *,
    job_id: str | None = None,
) -> LedgerEntry:
    """크레딧 차감. 잔액 부족 시 InsufficientCreditsError."""
    if amount <= 0:
        raise CreditsError("amount는 양수여야 합니다", code="INVALID_AMOUNT")

    result = _supabase_rpc("consume_credits", {
        "p_user_id": user_id,
        "p_amount": amount,
        "p_reason": reason,
        "p_job_id": job_id,
    })
    return LedgerEntry(ledger_id=int(result["result"]))


def grant(
    user_id: str,
    amount: int,
    reason: GrantReason,
    *,
    job_id: str | None = None,
    payment_id: str | None = None,
    metadata: dict | None = None,
) -> LedgerEntry:
    """크레딧 충전/환불."""
    if amount <= 0:
        raise CreditsError("amount는 양수여야 합니다", code="INVALID_AMOUNT")

    result = _supabase_rpc("grant_credits", {
        "p_user_id": user_id,
        "p_amount": amount,
        "p_reason": reason,
        "p_job_id": job_id,
        "p_payment_id": payment_id,
        "p_metadata": metadata or {},
    })
    return LedgerEntry(ledger_id=int(result["result"]))


def refund_job(user_id: str, job_id: str, amount: int) -> LedgerEntry:
    """실패 job에 대한 자동 환불."""
    return grant(
        user_id=user_id,
        amount=amount,
        reason="job_refund",
        job_id=job_id,
        metadata={"auto_refund": True},
    )
