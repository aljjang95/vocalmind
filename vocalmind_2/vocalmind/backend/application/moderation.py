"""모더레이션 enforce — 로깅 + BLOCK 시 ModerationError 발생.

core(판정) + infra.supabase(로깅)을 묶는 최소 use-case.
"""
from __future__ import annotations

from domain_types.moderation import ModerationError, ModerationResult
from infra.supabase import moderation_repo


def enforce(
    user_id: str,
    result: ModerationResult,
    *,
    job_id: str | None = None,
) -> ModerationResult:
    """best-effort 로깅 → BLOCK이면 ModerationError. 통과면 result 그대로 반환."""
    moderation_repo.log_events(user_id, result, job_id=job_id)
    if result.decision == "block":
        raise ModerationError(result)
    return result
