"""Anthropic 클라이언트 싱글톤 — 매호출 생성 대신 모듈 레벨에서 1회 초기화."""
from __future__ import annotations

import json
import logging
import re

import anthropic

logger = logging.getLogger(__name__)

# 모듈 레벨 싱글톤: HTTP 커넥션 풀 재활용
_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """Anthropic 클라이언트 반환 (lazy 싱글톤)."""
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def complete(
    system: str,
    messages: list[dict],
    *,
    model: str = "claude-haiku-4-5-20251001",
    max_tokens: int = 500,
) -> str:
    """시스템 프롬프트 + 메시지로 Anthropic API 호출. cache_control 자동 적용."""
    client = get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    )
    return getattr(response.content[0], "text", "")


def complete_json(
    system: str,
    messages: list[dict],
    required_keys: list[str] | None = None,
    *,
    model: str = "claude-haiku-4-5-20251001",
    max_tokens: int = 500,
) -> dict | None:
    """Anthropic API 호출 후 JSON 파싱. 실패 시 None 반환."""
    text = complete(system, messages, model=model, max_tokens=max_tokens)
    json_match = re.search(r'\{[\s\S]*\}', text)
    if not json_match:
        return None
    try:
        result = json.loads(json_match.group())
    except json.JSONDecodeError:
        return None
    if required_keys and not all(k in result for k in required_keys):
        return None
    return result
