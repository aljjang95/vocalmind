"""모더레이션 도메인 타입 — Category, Severity, Event, Result, Error."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Category = Literal[
    "nsfw",
    "minor_face",
    "celebrity_lookalike",
    "lyrics_policy",
    "voice_not_owner",
    "dmca",
    "other",
]

Severity = Literal["warn", "block", "review"]
Decision = Literal["pass", "review", "block"]
UploadKind = Literal["mr", "recording", "avatar"]


@dataclass(frozen=True)
class ModerationEvent:
    """단일 위반/경고 이벤트 — DB insert 입력."""
    category: Category
    severity: Severity
    detail: dict


@dataclass
class ModerationResult:
    """스테이지 판정 결과."""
    decision: Decision
    events: list[ModerationEvent] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.decision == "pass"


class ModerationError(Exception):
    """모더레이션 BLOCK 처리 (BFF/오케스트레이터가 catch)."""
    def __init__(self, result: ModerationResult, *, message: str = ""):
        if not message:
            cats = ",".join(e.category for e in result.events) or "unknown"
            message = f"moderation blocked: {cats}"
        super().__init__(message)
        self.result = result


@dataclass(frozen=True)
class VoiceClip:
    """Voice Identity 검증 입력."""
    storage_path: str
    duration_sec: float
