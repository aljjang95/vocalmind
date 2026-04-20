"""Studio 상태 전이 규칙 — 순수 함수. DB 호출 없음."""
from __future__ import annotations

from dataclasses import dataclass

from domain_types.studio import CANCELLABLE_STATUSES, TERMINAL_STATUSES, JobStatus
from core.studio.status import next_status


@dataclass(frozen=True)
class TransitionPlan:
    """전이 계획 — infra가 이걸 받아 DB patch 실행."""
    from_status: JobStatus
    to_status: JobStatus


def plan_advance(current: JobStatus) -> TransitionPlan | None:
    """happy path 다음 단계로의 전이 계획. 터미널이면 None."""
    if current in TERMINAL_STATUSES:
        return None
    nxt = next_status(current)
    if nxt is None:
        return None
    return TransitionPlan(from_status=current, to_status=nxt)


def can_cancel(current: JobStatus) -> bool:
    """유저 취소 가능 여부."""
    return current in CANCELLABLE_STATUSES


def is_terminal(status: JobStatus) -> bool:
    return status in TERMINAL_STATUSES


def is_retry_exhausted(attempt_count: int, max_attempts: int) -> bool:
    """attempt_count가 max_attempts에 도달했는지."""
    return attempt_count >= max_attempts


def plan_fail(current: JobStatus, failed_step: str, error: str) -> dict:
    """실패 시 DB에 찍을 패치 payload. application 레이어가 사용."""
    return {
        "status": "failed",
        "failed_step": failed_step,
        "last_error": (error or "")[:1000],
    }


def plan_refunded() -> dict:
    """환불 성공 후 status만 refunded로 전이."""
    return {"status": "refunded"}
