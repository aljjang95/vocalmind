"""오디오 변환 유틸리티."""
from __future__ import annotations
import subprocess
from pathlib import Path


def convert_to_wav(src: Path, dst: Path) -> None:
    """FFmpeg로 오디오를 16kHz mono WAV로 변환."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(dst)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=True,
    )
