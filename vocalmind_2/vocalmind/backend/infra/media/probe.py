"""ffprobe 래퍼 — signed URL에서 duration 조회."""
from __future__ import annotations

import logging
import subprocess

logger = logging.getLogger(__name__)


def probe_duration_sec(signed_url: str, *, default: float = 60.0, timeout: int = 20) -> float:
    """URL의 미디어 duration(sec) 조회. 실패 시 default 반환.

    최소 10초 보장 (그 미만이면 default).
    """
    if not signed_url:
        return default
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                signed_url,
            ],
            capture_output=True, text=True, timeout=timeout,
        )
        val = (out.stdout or "").strip()
        if val:
            return max(10.0, float(val))
    except Exception as e:
        logger.warning("ffprobe 실패 — 기본 %ss 사용: %s", default, e)
    return default
