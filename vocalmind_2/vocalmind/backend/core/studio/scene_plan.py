"""Scene plan 순수 조작 — JSON 갱신/검색. 부작용 없음."""
from __future__ import annotations

import uuid
from typing import Literal

SceneStep = Literal["scene_image_gen", "scene_video_gen", "lipsync"]


def upsert_scene_url(
    scenes: list[dict],
    scene_id: str,
    step: SceneStep,
    result_url: str,
) -> tuple[list[dict], bool]:
    """scene_id의 해당 단계 URL을 갱신한 씬 목록을 반환.

    scene_id 불일치 시 첫 빈 URL 슬롯으로 폴백. 매칭 실패 시 (원본 복사본, False).
    """
    url_field = "imageUrl" if step == "scene_image_gen" else "videoUrl"
    out = [dict(s) if isinstance(s, dict) else s for s in scenes]

    for scene in out:
        if isinstance(scene, dict) and scene.get("id") == scene_id:
            scene[url_field] = result_url
            return out, True

    for scene in out:
        if isinstance(scene, dict) and not scene.get(url_field):
            scene[url_field] = result_url
            return out, True

    return out, False


def all_assets_ready(scenes: list[dict], step: SceneStep) -> bool:
    """모든 씬이 해당 단계 URL을 보유했는지. 빈 목록은 True(진행 가능)."""
    if not scenes:
        return True
    url_field = "imageUrl" if step == "scene_image_gen" else "videoUrl"
    return all(
        isinstance(s, dict) and s.get(url_field)
        for s in scenes
    )


def collect_video_urls(scenes: list[dict]) -> list[str]:
    """composing 입력용 — 비디오 URL만 추출(None 제거)."""
    urls = [s.get("videoUrl") or s.get("video_url") for s in scenes if isinstance(s, dict)]
    return [u for u in urls if u]


def collect_scene_prompts(scenes: list[dict]) -> list[str]:
    """모더레이션 검사용 — 프롬프트만 추출."""
    return [s.get("prompt", "") for s in scenes if isinstance(s, dict)]


def total_duration_sec(scenes: list[dict]) -> float:
    """씬 duration 합산. 파싱 실패 시 0."""
    total = 0.0
    for s in scenes:
        if not isinstance(s, dict):
            continue
        try:
            total += float(s.get("duration_sec", 0) or 0)
        except (TypeError, ValueError):
            continue
    return total


def pick_scene_count(duration_sec: float) -> int:
    """곡 길이에 따른 적정 씬 수. Phase 0 규칙."""
    if duration_sec < 60:
        return 3
    if duration_sec < 120:
        return 4
    if duration_sec < 200:
        return 5
    return 6


def normalize_scenes(raw: list) -> list[dict]:
    """LLM 출력을 id(8hex) + duration(6.0~20.0초) 정규화.

    prompt가 비어있거나 dict 아닌 항목은 제외.
    """
    out: list[dict] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        prompt = s.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            continue
        duration = s.get("duration_sec", 12.0)
        try:
            duration = float(duration)
        except (TypeError, ValueError):
            duration = 12.0
        duration = max(6.0, min(20.0, duration))
        out.append({
            "id": uuid.uuid4().hex[:8],
            "prompt": prompt.strip(),
            "duration_sec": duration,
        })
    return out
