"""오디오 업로드 공유 유틸 — 3곳 중복 제거."""
from __future__ import annotations

import subprocess
import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from services.audio_utils import convert_to_wav

MAX_AUDIO_SIZE = 20 * 1024 * 1024  # 20MB


async def save_and_convert(audio: UploadFile, tmp_dir: Path | None = None) -> tuple[Path, Path]:
    """업로드 오디오를 저장 + WAV 변환. (wav_path, tmp_dir) 반환.

    tmp_dir가 None이면 자동 생성. 호출자가 cleanup 책임.
    """
    if tmp_dir is None:
        tmp_dir = Path(tempfile.mkdtemp())

    ext = Path(audio.filename or "audio.webm").suffix or ".webm"
    src_path = tmp_dir / f"{uuid.uuid4().hex}{ext}"
    content = await audio.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(413, "파일이 너무 큽니다 (최대 20MB)")
    src_path.write_bytes(content)

    if ext.lower() == ".wav":
        return src_path, tmp_dir

    wav_path = tmp_dir / f"{uuid.uuid4().hex}.wav"
    try:
        convert_to_wav(src_path, wav_path)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        raise HTTPException(500, f"오디오 변환 실패: {e}")
    return wav_path, tmp_dir
