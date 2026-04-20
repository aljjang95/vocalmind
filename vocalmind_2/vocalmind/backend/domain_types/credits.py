"""크레딧 도메인 타입 — LedgerEntry, Reason 리터럴, 예외."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

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
