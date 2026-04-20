"""Job 라이프사이클 가드 — 소유권/상태 검증 순수 함수."""
from __future__ import annotations

from domain_types.studio import CANCELLABLE_STATUSES, TERMINAL_STATUSES, JobStatus


class OwnershipViolation(Exception):
    """본인 job 아님."""


class NotCancellable(Exception):
    """현재 단계는 취소 불가."""
    def __init__(self, current_status: JobStatus):
        super().__init__(f"현재 단계({current_status})에서는 취소할 수 없어요")
        self.current_status = current_status


class AlreadyTerminal(Exception):
    """이미 종료 — force-fail도 불가."""
    def __init__(self, current_status: JobStatus):
        super().__init__(f"이미 종료된 작업입니다 ({current_status})")
        self.current_status = current_status


def check_cancel(user_id: str, job_user_id: str, current: JobStatus) -> None:
    """유저 취소 가능 여부 검증. 실패 시 예외."""
    if user_id != job_user_id:
        raise OwnershipViolation("본인 작업이 아닙니다")
    if current not in CANCELLABLE_STATUSES:
        raise NotCancellable(current)


def check_force_fail(current: JobStatus) -> None:
    """관리자 강제 실패 — 이미 터미널이면 거부."""
    if current in TERMINAL_STATUSES:
        raise AlreadyTerminal(current)
