"""scene_planner 단위 테스트 — core(scene_plan) + application(scene_planner)."""
from __future__ import annotations

from unittest.mock import patch

from application.studio import scene_planner
from core.studio import scene_plan as core_scene


class TestPickSceneCount:
    def test_short_song(self):
        assert core_scene.pick_scene_count(50) == 3

    def test_medium_song(self):
        assert core_scene.pick_scene_count(90) == 4
        assert core_scene.pick_scene_count(150) == 5

    def test_long_song(self):
        assert core_scene.pick_scene_count(240) == 6


class TestNormalizeScenes:
    def test_adds_ids_and_clamps_duration(self):
        raw = [
            {"prompt": "a warm sunset", "duration_sec": 3.0},
            {"prompt": "neon city", "duration_sec": 50.0},
            {"prompt": "valid", "duration_sec": 12.5},
        ]
        out = core_scene.normalize_scenes(raw)
        assert len(out) == 3
        assert all("id" in s and len(s["id"]) == 8 for s in out)
        assert out[0]["duration_sec"] == 6.0
        assert out[1]["duration_sec"] == 20.0
        assert out[2]["duration_sec"] == 12.5

    def test_rejects_empty_prompts(self):
        raw = [{"prompt": ""}, {"prompt": "valid"}, {"not_dict": True}]
        out = core_scene.normalize_scenes(raw)
        assert len(out) == 1
        assert out[0]["prompt"] == "valid"

    def test_handles_non_numeric_duration(self):
        raw = [{"prompt": "test", "duration_sec": "abc"}]
        out = core_scene.normalize_scenes(raw)
        assert out[0]["duration_sec"] == 12.0


class TestPlanScenesWithMock:
    def test_uses_llm_response_when_valid(self):
        fake = {"scenes": [
            {"prompt": "test scene 1", "duration_sec": 10},
            {"prompt": "test scene 2", "duration_sec": 12},
        ]}
        with patch("application.studio.scene_planner.ai.complete_json", return_value=fake):
            scenes = scene_planner.plan_scenes("cinematic", 120)
        assert len(scenes) == 2
        assert scenes[0]["prompt"].startswith("test scene 1")
        # 스타일 앵커 부착 (cinematic 기본 마커)
        assert "ARRI Alexa" in scenes[0]["prompt"] or "anamorphic" in scenes[0]["prompt"] \
            or "cinematic" in scenes[0]["prompt"].lower()

    def test_fallback_when_llm_returns_none(self):
        with patch("application.studio.scene_planner.ai.complete_json", return_value=None):
            scenes = scene_planner.plan_scenes("cozy", 90)
        assert len(scenes) == 4
        cozy_bases = scene_planner._FALLBACK_PROMPTS["cozy"]
        for s in scenes:
            assert any(s["prompt"].startswith(base) for base in cozy_bases)
        assert all(
            "Kinfolk" in s["prompt"] or "golden hour" in s["prompt"] or "warm" in s["prompt"].lower()
            for s in scenes
        )

    def test_fallback_unknown_style_uses_cinematic(self):
        scenes = scene_planner._fallback_scenes("unknown_style", 4, 12.0)
        assert len(scenes) == 4
        joined = " ".join(s["prompt"] for s in scenes).lower()
        assert "cinematic" in joined or "anamorphic" in joined or "arri" in joined

    def test_fallback_when_scenes_empty_list(self):
        with patch("application.studio.scene_planner.ai.complete_json", return_value={"scenes": []}):
            scenes = scene_planner.plan_scenes("fantasy", 120)
        assert len(scenes) > 0

    def test_style_anchor_attached_to_every_style(self):
        """스타일별 fallback prompt에 스타일 고유 토큰이 포함돼야 함."""
        markers = {
            "cinematic": ["ARRI Alexa", "anamorphic", "cinematic"],
            "cozy": ["Kinfolk", "golden hour", "warm"],
            "neon_city": ["Blade Runner", "neon", "cyberpunk"],
            "fantasy": ["Ghibli", "ethereal", "dream"],
        }
        for style, candidates in markers.items():
            scenes = scene_planner._fallback_scenes(style, 2, 12.0)
            for s in scenes:
                prompt_lower = s["prompt"].lower()
                assert any(c.lower() in prompt_lower for c in candidates), (
                    f"{style} prompt missing any of {candidates}: {s['prompt']}"
                )
