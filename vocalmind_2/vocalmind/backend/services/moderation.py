"""Phase 0 모더레이션 서비스 — 3단계 규칙 기반 검사.

레퍼런스:
- 2026 AI music moderation 3축(Copyright/Ethical/Ownership) +
  async user-upload 검사 패턴(fingerprint/metadata/ethical/regulatory).
- Phase 0는 fingerprint/vision API 없이도 동작 가능한 **규칙 기반 베이스라인**.
- Phase 1 이후에는 여기에 외부 NSFW/얼굴/audio fingerprint API를 레이어로 얹는다.

단계:
  1. upload        : MR/녹음/아바타 업로드 시 형식·용량·길이 검증
  2. voice_identity: 10문장 Voice Identity 등록 검증 (ownership proxy)
  3. cover_output  : 커버 결과물(composing 완료) 메타·금지 키워드 검증

모든 위반은 moderation_events 테이블에 append-only 로깅.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Literal

import httpx

logger = logging.getLogger(__name__)


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


# 업로드 제약 (Phase 0 베이스라인)
MAX_SIZE_BYTES: dict[UploadKind, int] = {
    "mr":        40 * 1024 * 1024,   # 40 MB
    "recording": 20 * 1024 * 1024,   # 20 MB
    "avatar":    10 * 1024 * 1024,   # 10 MB
}

ALLOWED_EXT: dict[UploadKind, tuple[str, ...]] = {
    "mr":        ("mp3", "wav", "m4a", "flac"),
    "recording": ("webm", "wav", "mp3", "m4a"),
    "avatar":    ("png", "jpg", "jpeg", "webp"),
}

AUDIO_DURATION_BOUNDS: dict[UploadKind, tuple[float, float]] = {
    "mr":        (30.0, 600.0),   # 30초 ~ 10분
    "recording": (10.0, 600.0),
}

# Voice Identity (10문장) 제약 — ownership proxy
VI_CLIPS_EXPECTED = 10
VI_CLIP_DURATION_MIN = 3.0
VI_CLIP_DURATION_MAX = 20.0
VI_TOTAL_DURATION_MIN = 60.0

# 금지 키워드 (한국어 중심, Phase 0 최소셋 — 가사/씬 플랜 모두 적용)
BANNED_KEYWORDS: tuple[str, ...] = (
    # 성적·폭력 (ethical)
    "섹스", "야동", "포르노", "강간",
    "테러", "폭파", "살인",
    # 아동 보호 (ethical)
    "미성년", "초등학생", "중학생", "어린이",
    # 저작권 민감 (copyright) — 유명 아티스트 직접 언급 차단
    "BTS", "방탄소년단", "아이유", "뉴진스",
)


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


# ---------------------------------------------------------------------------
# Stage 1: 업로드 검증
# ---------------------------------------------------------------------------

def check_upload(
    *,
    kind: UploadKind,
    file_name: str,
    size_bytes: int,
    duration_sec: float | None = None,
) -> ModerationResult:
    """업로드 파일 형식·용량·길이 검증.

    duration_sec은 MR/recording 필수(없으면 block), avatar는 None 허용.
    여러 위반이 있으면 모두 events에 기록하되 block 판정.
    """
    events: list[ModerationEvent] = []

    # 1) 파일명/확장자
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in ALLOWED_EXT[kind]:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={
                "stage": "upload",
                "rule": "file_ext",
                "kind": kind,
                "ext": ext,
                "allowed": list(ALLOWED_EXT[kind]),
            },
        ))

    # 2) 용량
    max_size = MAX_SIZE_BYTES[kind]
    if size_bytes <= 0:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={"stage": "upload", "rule": "empty_file", "kind": kind},
        ))
    elif size_bytes > max_size:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={
                "stage": "upload",
                "rule": "file_too_large",
                "kind": kind,
                "size": size_bytes,
                "max": max_size,
            },
        ))

    # 3) 길이 (오디오 전용)
    if kind in AUDIO_DURATION_BOUNDS:
        lo, hi = AUDIO_DURATION_BOUNDS[kind]
        if duration_sec is None:
            events.append(ModerationEvent(
                category="other",
                severity="block",
                detail={"stage": "upload", "rule": "duration_missing", "kind": kind},
            ))
        elif duration_sec < lo or duration_sec > hi:
            events.append(ModerationEvent(
                category="other",
                severity="block",
                detail={
                    "stage": "upload",
                    "rule": "duration_out_of_range",
                    "kind": kind,
                    "duration": duration_sec,
                    "min": lo,
                    "max": hi,
                },
            ))

    decision: Decision = "block" if any(e.severity == "block" for e in events) else "pass"
    return ModerationResult(decision=decision, events=events)


# ---------------------------------------------------------------------------
# Stage 2: Voice Identity (10문장) 검증 — ownership proxy
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class VoiceClip:
    storage_path: str
    duration_sec: float


def check_voice_identity(clips: list[VoiceClip]) -> ModerationResult:
    """10문장 Voice Identity 등록 시 품질 게이트.

    - 정확히 10개
    - 각 클립 3~20초
    - 총합 60초 이상 (RVC 학습 최저량)
    - storage_path 중복 금지
    """
    events: list[ModerationEvent] = []

    if len(clips) != VI_CLIPS_EXPECTED:
        events.append(ModerationEvent(
            category="voice_not_owner",
            severity="block",
            detail={
                "stage": "voice_identity",
                "rule": "clip_count",
                "expected": VI_CLIPS_EXPECTED,
                "got": len(clips),
            },
        ))

    seen: set[str] = set()
    for i, c in enumerate(clips):
        if c.storage_path in seen:
            events.append(ModerationEvent(
                category="voice_not_owner",
                severity="block",
                detail={
                    "stage": "voice_identity",
                    "rule": "clip_duplicate",
                    "index": i,
                    "path": c.storage_path,
                },
            ))
        seen.add(c.storage_path)

    for i, c in enumerate(clips):
        if c.duration_sec < VI_CLIP_DURATION_MIN or c.duration_sec > VI_CLIP_DURATION_MAX:
            events.append(ModerationEvent(
                category="voice_not_owner",
                severity="block",
                detail={
                    "stage": "voice_identity",
                    "rule": "clip_duration",
                    "index": i,
                    "duration": c.duration_sec,
                    "min": VI_CLIP_DURATION_MIN,
                    "max": VI_CLIP_DURATION_MAX,
                },
            ))

    total = sum(c.duration_sec for c in clips)
    if total < VI_TOTAL_DURATION_MIN:
        events.append(ModerationEvent(
            category="voice_not_owner",
            severity="block",
            detail={
                "stage": "voice_identity",
                "rule": "total_duration",
                "total": total,
                "min": VI_TOTAL_DURATION_MIN,
            },
        ))

    decision: Decision = "block" if any(e.severity == "block" for e in events) else "pass"
    return ModerationResult(decision=decision, events=events)


# ---------------------------------------------------------------------------
# Stage 3: 커버 결과물 검증 (composing 후)
# ---------------------------------------------------------------------------

def check_cover_output(
    *,
    output_url: str | None,
    duration_sec: float | None,
    lyrics_text: str | None = None,
    scene_prompts: list[str] | None = None,
) -> ModerationResult:
    """컴포지트 완료된 MV 출력 검증.

    Phase 0 규칙:
    - output_url + duration 필수
    - duration 10초 ~ 15분 (비현실적 값 차단)
    - 가사/씬 프롬프트에 금지 키워드 포함 시 block (lyrics_policy/nsfw)

    실제 비전 API(NSFW/얼굴/유명인)는 Phase 1 이후.
    """
    events: list[ModerationEvent] = []

    if not output_url:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={"stage": "cover_output", "rule": "output_missing"},
        ))

    if duration_sec is None:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={"stage": "cover_output", "rule": "duration_missing"},
        ))
    elif duration_sec < 10.0 or duration_sec > 900.0:
        events.append(ModerationEvent(
            category="other",
            severity="block",
            detail={
                "stage": "cover_output",
                "rule": "duration_out_of_range",
                "duration": duration_sec,
                "min": 10.0,
                "max": 900.0,
            },
        ))

    if lyrics_text:
        hit = _banned_hits(lyrics_text)
        if hit:
            events.append(ModerationEvent(
                category="lyrics_policy",
                severity="block",
                detail={
                    "stage": "cover_output",
                    "rule": "banned_keyword_lyrics",
                    "keywords": hit,
                },
            ))

    if scene_prompts:
        all_text = " ".join(scene_prompts)
        hit = _banned_hits(all_text)
        if hit:
            events.append(ModerationEvent(
                category="nsfw",
                severity="block",
                detail={
                    "stage": "cover_output",
                    "rule": "banned_keyword_scene",
                    "keywords": hit,
                },
            ))

    decision: Decision = "block" if any(e.severity == "block" for e in events) else "pass"
    return ModerationResult(decision=decision, events=events)


def _banned_hits(text: str) -> list[str]:
    lower = text.lower()
    return [kw for kw in BANNED_KEYWORDS if kw.lower() in lower]


# ---------------------------------------------------------------------------
# Supabase moderation_events 로깅
# ---------------------------------------------------------------------------

def log_events(
    user_id: str,
    result: ModerationResult,
    *,
    job_id: str | None = None,
    decided_by: str = "auto",
) -> int:
    """moderation_events 테이블에 결과 이벤트를 append.

    로깅은 best effort — 실패해도 ModerationError는 발생시키지 않음.
    반환: 실제 insert된 row 수 (0 이상).
    """
    if not result.events:
        return 0

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning("moderation: SUPABASE env missing — skipping log")
        return 0

    rows = [{
        "user_id": user_id,
        "job_id": job_id,
        "category": e.category,
        "severity": e.severity,
        "detail": e.detail,
        "decided_by": decided_by,
    } for e in result.events]

    endpoint = f"{url}/rest/v1/moderation_events"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        resp = httpx.post(endpoint, json=rows, headers=headers, timeout=5.0)
        if resp.status_code >= 400:
            logger.warning("moderation log failed %s: %s", resp.status_code, resp.text[:200])
            return 0
    except httpx.HTTPError as e:
        logger.warning("moderation log network error: %s", e)
        return 0
    return len(rows)


def enforce(
    user_id: str,
    result: ModerationResult,
    *,
    job_id: str | None = None,
) -> ModerationResult:
    """편의 함수: 로깅 + BLOCK이면 ModerationError. 라우터/오케스트레이터에서 사용."""
    log_events(user_id, result, job_id=job_id)
    if result.decision == "block":
        raise ModerationError(result)
    return result
