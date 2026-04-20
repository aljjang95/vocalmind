"""모더레이션 판정 — 순수 함수. Supabase 로깅 없음.

3단계:
  1. judge_upload — MR/녹음/아바타
  2. judge_voice_identity — 10문장
  3. judge_cover_output — 최종 MV
"""
from __future__ import annotations

from domain_types.moderation import (
    Decision,
    ModerationEvent,
    ModerationResult,
    UploadKind,
    VoiceClip,
)
from core.moderation.rules import (
    ALLOWED_EXT,
    AUDIO_DURATION_BOUNDS,
    BANNED_KEYWORDS,  # noqa: F401 — 상수 공개 목적
    COVER_DURATION_MAX,
    COVER_DURATION_MIN,
    MAX_SIZE_BYTES,
    VI_CLIP_DURATION_MAX,
    VI_CLIP_DURATION_MIN,
    VI_CLIPS_EXPECTED,
    VI_TOTAL_DURATION_MIN,
    banned_hits,
)


def _decide(events: list[ModerationEvent]) -> Decision:
    return "block" if any(e.severity == "block" for e in events) else "pass"


# ── Stage 1: 업로드 ────────────────────────────────────────────────

def judge_upload(
    *,
    kind: UploadKind,
    file_name: str,
    size_bytes: int,
    duration_sec: float | None = None,
) -> ModerationResult:
    events: list[ModerationEvent] = []

    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in ALLOWED_EXT[kind]:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={
                "stage": "upload", "rule": "file_ext",
                "kind": kind, "ext": ext,
                "allowed": list(ALLOWED_EXT[kind]),
            },
        ))

    max_size = MAX_SIZE_BYTES[kind]
    if size_bytes <= 0:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={"stage": "upload", "rule": "empty_file", "kind": kind},
        ))
    elif size_bytes > max_size:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={
                "stage": "upload", "rule": "file_too_large",
                "kind": kind, "size": size_bytes, "max": max_size,
            },
        ))

    if kind in AUDIO_DURATION_BOUNDS:
        lo, hi = AUDIO_DURATION_BOUNDS[kind]
        if duration_sec is None:
            events.append(ModerationEvent(
                category="other", severity="block",
                detail={"stage": "upload", "rule": "duration_missing", "kind": kind},
            ))
        elif duration_sec < lo or duration_sec > hi:
            events.append(ModerationEvent(
                category="other", severity="block",
                detail={
                    "stage": "upload", "rule": "duration_out_of_range",
                    "kind": kind, "duration": duration_sec, "min": lo, "max": hi,
                },
            ))

    return ModerationResult(decision=_decide(events), events=events)


# ── Stage 2: Voice Identity ─────────────────────────────────────────

def judge_voice_identity(clips: list[VoiceClip]) -> ModerationResult:
    events: list[ModerationEvent] = []

    if len(clips) != VI_CLIPS_EXPECTED:
        events.append(ModerationEvent(
            category="voice_not_owner", severity="block",
            detail={
                "stage": "voice_identity", "rule": "clip_count",
                "expected": VI_CLIPS_EXPECTED, "got": len(clips),
            },
        ))

    seen: set[str] = set()
    for i, c in enumerate(clips):
        if c.storage_path in seen:
            events.append(ModerationEvent(
                category="voice_not_owner", severity="block",
                detail={
                    "stage": "voice_identity", "rule": "clip_duplicate",
                    "index": i, "path": c.storage_path,
                },
            ))
        seen.add(c.storage_path)

    for i, c in enumerate(clips):
        if c.duration_sec < VI_CLIP_DURATION_MIN or c.duration_sec > VI_CLIP_DURATION_MAX:
            events.append(ModerationEvent(
                category="voice_not_owner", severity="block",
                detail={
                    "stage": "voice_identity", "rule": "clip_duration",
                    "index": i, "duration": c.duration_sec,
                    "min": VI_CLIP_DURATION_MIN, "max": VI_CLIP_DURATION_MAX,
                },
            ))

    total = sum(c.duration_sec for c in clips)
    if total < VI_TOTAL_DURATION_MIN:
        events.append(ModerationEvent(
            category="voice_not_owner", severity="block",
            detail={
                "stage": "voice_identity", "rule": "total_duration",
                "total": total, "min": VI_TOTAL_DURATION_MIN,
            },
        ))

    return ModerationResult(decision=_decide(events), events=events)


# ── Stage 3: Cover Output ───────────────────────────────────────────

def judge_cover_output(
    *,
    output_url: str | None,
    duration_sec: float | None,
    lyrics_text: str | None = None,
    scene_prompts: list[str] | None = None,
) -> ModerationResult:
    events: list[ModerationEvent] = []

    if not output_url:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={"stage": "cover_output", "rule": "output_missing"},
        ))

    if duration_sec is None:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={"stage": "cover_output", "rule": "duration_missing"},
        ))
    elif duration_sec < COVER_DURATION_MIN or duration_sec > COVER_DURATION_MAX:
        events.append(ModerationEvent(
            category="other", severity="block",
            detail={
                "stage": "cover_output", "rule": "duration_out_of_range",
                "duration": duration_sec,
                "min": COVER_DURATION_MIN, "max": COVER_DURATION_MAX,
            },
        ))

    if lyrics_text:
        hit = banned_hits(lyrics_text)
        if hit:
            events.append(ModerationEvent(
                category="lyrics_policy", severity="block",
                detail={
                    "stage": "cover_output",
                    "rule": "banned_keyword_lyrics",
                    "keywords": hit,
                },
            ))

    if scene_prompts:
        hit = banned_hits(" ".join(scene_prompts))
        if hit:
            events.append(ModerationEvent(
                category="nsfw", severity="block",
                detail={
                    "stage": "cover_output",
                    "rule": "banned_keyword_scene",
                    "keywords": hit,
                },
            ))

    return ModerationResult(decision=_decide(events), events=events)
