"""edge-tts 음성 합성 테스트."""
from __future__ import annotations
import pytest
from services.voice_feedback import synthesize_feedback


class TestVoiceFeedback:
    @pytest.mark.asyncio
    async def test_synthesize_returns_bytes(self):
        audio = await synthesize_feedback("안녕하세요")
        assert isinstance(audio, bytes)
        assert len(audio) > 0

    @pytest.mark.asyncio
    async def test_synthesize_empty_text(self):
        audio = await synthesize_feedback("")
        assert audio is None

    @pytest.mark.asyncio
    async def test_synthesize_whitespace_only(self):
        audio = await synthesize_feedback("   ")
        assert audio is None
