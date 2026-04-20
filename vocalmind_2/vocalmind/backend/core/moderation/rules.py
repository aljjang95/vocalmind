"""모더레이션 규칙 상수 — 업로드 제약·금지 키워드·Voice Identity 기준."""
from __future__ import annotations

from domain_types.moderation import UploadKind

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
    "mr":        (30.0, 600.0),
    "recording": (10.0, 600.0),
}

# Voice Identity (10문장) — ownership proxy
VI_CLIPS_EXPECTED = 10
VI_CLIP_DURATION_MIN = 3.0
VI_CLIP_DURATION_MAX = 20.0
VI_TOTAL_DURATION_MIN = 60.0

# 금지 키워드 (Phase 0 최소셋)
BANNED_KEYWORDS: tuple[str, ...] = (
    # 성적·폭력 (ethical)
    "섹스", "야동", "포르노", "강간",
    "테러", "폭파", "살인",
    # 아동 보호 (ethical)
    "미성년", "초등학생", "중학생", "어린이",
    # 저작권 민감 (copyright)
    "BTS", "방탄소년단", "아이유", "뉴진스",
)

# Cover output duration 허용 범위
COVER_DURATION_MIN = 10.0
COVER_DURATION_MAX = 900.0


def banned_hits(text: str) -> list[str]:
    lower = text.lower()
    return [kw for kw in BANNED_KEYWORDS if kw.lower() in lower]
