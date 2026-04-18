"""edge-tts 기반 AI 음성 합성."""
from __future__ import annotations
import io
import edge_tts

VOICE = "ko-KR-SunHiNeural"
RATE = "+10%"
MAX_CHARS = 200


async def synthesize_feedback(text: str) -> bytes | None:
    """텍스트를 MP3 음성 바이트로 변환. 빈 텍스트면 None."""
    if not text or not text.strip():
        return None
    truncated = text[:MAX_CHARS]
    communicate = edge_tts.Communicate(truncated, VOICE, rate=RATE)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    audio = buf.getvalue()
    return audio if audio else None
