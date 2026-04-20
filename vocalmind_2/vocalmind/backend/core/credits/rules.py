"""크레딧 금액 검증 — DB 호출 없는 순수 함수."""
from __future__ import annotations

from domain_types.credits import CreditsError


def validate_amount(amount: int) -> None:
    """차감/충전 금액이 양수인지."""
    if amount <= 0:
        raise CreditsError("amount는 양수여야 합니다", code="INVALID_AMOUNT")
