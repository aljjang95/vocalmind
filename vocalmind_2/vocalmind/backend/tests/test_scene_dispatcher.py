"""scene_dispatcher 단위 테스트 — cost 누적 + 이미지/비디오 집계."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services import scene_dispatcher


class TestProcessSceneImages:
    def test_accumulates_cost_per_scene(self):
        scenes = [
            {"id": "s1", "prompt": "a"},
            {"id": "s2", "prompt": "b"},
        ]

        def fake_gen(prompt, **kwargs):
            return (f"https://img/{prompt}", 0.0025)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            out, total = scene_dispatcher.process_scene_images("job1", scenes)

        assert len(out) == 2
        assert all(s["image_url"] for s in out)
        assert out[0]["image_cost_usd"] == 0.0025
        assert total == pytest.approx(0.005)

    def test_failed_scene_does_not_increment_cost(self):
        from infra.runware_client import RunwareError
        scenes = [
            {"id": "s1", "prompt": "ok"},
            {"id": "s2", "prompt": "fail"},
        ]

        def fake_gen(prompt, **kwargs):
            if prompt == "fail":
                raise RunwareError("boom")
            return (f"https://img/{prompt}", 0.003)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            out, total = scene_dispatcher.process_scene_images("job1", scenes)

        assert out[0]["image_url"] == "https://img/ok"
        assert out[1]["image_url"] is None
        assert "error" in out[1]
        assert total == pytest.approx(0.003)


class TestProcessSceneVideos:
    def test_accumulates_cost_from_task_raw(self):
        scenes = [
            {"id": "s1", "prompt": "a", "image_url": "https://img/a", "duration_sec": 10.0},
            {"id": "s2", "prompt": "b", "image_url": "https://img/b", "duration_sec": 10.0},
        ]

        from infra.runware_client import RunwareTask

        def fake_gen(**kwargs):
            return RunwareTask(
                task_id="t-" + kwargs["prompt"], status="pending",
                result_url=None, error=None,
                raw={"taskUUID": "t"},
            )

        def fake_wait(task_id, timeout_sec=600):
            return RunwareTask(
                task_id=task_id, status="success",
                result_url=f"https://vid/{task_id}", error=None,
                raw={"cost": 0.25},
            )

        with patch("services.scene_dispatcher.rw.generate_video", side_effect=fake_gen), \
             patch("services.scene_dispatcher.rw.wait_for_task", side_effect=fake_wait):
            out, total = scene_dispatcher.process_scene_videos("job1", scenes)

        assert len(out) == 2
        assert all(s["video_url"] for s in out)
        assert out[0]["video_cost_usd"] == 0.25
        assert total == pytest.approx(0.5)

    def test_scene_without_image_is_skipped(self):
        scenes = [{"id": "s1", "prompt": "a", "image_url": None}]
        out, total = scene_dispatcher.process_scene_videos("job1", scenes)
        assert out[0]["video_url"] is None
        assert out[0]["error"] == "no image"
        assert total == 0.0


class TestIncrementCostUsd:
    def test_zero_or_negative_delta_is_noop(self):
        # 환경변수 설정 무시하고 바로 리턴
        scene_dispatcher.increment_cost_usd("j1", 0)
        scene_dispatcher.increment_cost_usd("j1", -1.5)
        # 예외 없이 통과

    def test_missing_env_logs_and_returns(self, monkeypatch):
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        # 예외 없이 반환해야 함
        scene_dispatcher.increment_cost_usd("j1", 0.5)

    def test_adds_to_existing_cost(self, monkeypatch):
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")

        get_resp = MagicMock()
        get_resp.status_code = 200
        get_resp.json.return_value = [{"cost_usd_actual": 1.2}]

        patch_resp = MagicMock()
        patch_resp.status_code = 204

        client_mock = MagicMock()
        client_mock.get.return_value = get_resp
        client_mock.patch.return_value = patch_resp
        ctx = MagicMock()
        ctx.__enter__.return_value = client_mock
        ctx.__exit__.return_value = False

        with patch("services.scene_dispatcher.httpx.Client", return_value=ctx):
            scene_dispatcher.increment_cost_usd("j1", 0.3)

        # PATCH body가 1.2 + 0.3 = 1.5 (부동소수점 round)
        patch_call = client_mock.patch.call_args
        payload = patch_call.kwargs["json"]
        assert payload["cost_usd_actual"] == pytest.approx(1.5)


# ============================================================
# 티어별 모델 라우팅 + 예산 가드 (2026-04-18 추가)
# ============================================================

from infra import runware_catalog as cat  # noqa: E402


class TestTierModelRouting:
    """process_scene_images/videos가 티어에 맞는 모델·해상도를 선택하는지."""

    def test_draft_tier_uses_flux_schnell_and_576p(self):
        captured: dict = {"calls": []}

        def fake_gen(prompt, **kwargs):
            captured["calls"].append(kwargs)
            return (f"https://img/{prompt}", 0.001)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            out, _ = scene_dispatcher.process_scene_images(
                "j1", [{"id": "s1", "prompt": "p"}], tier="draft",
            )
        assert captured["calls"][0]["model"] == cat.MODEL_IMAGE_FLUX_SCHNELL
        assert captured["calls"][0]["width"] == 1024
        assert captured["calls"][0]["height"] == 576
        assert out[0]["image_model"] == cat.MODEL_IMAGE_FLUX_SCHNELL

    def test_pro_tier_uses_seedream_4_5_qhd(self):
        """Pro는 Seedream 4.5 하한(3.68M 픽셀) 만족하는 QHD 사용."""
        captured: dict = {"calls": []}

        def fake_gen(prompt, **kwargs):
            captured["calls"].append(kwargs)
            return ("x", 0.02)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            scene_dispatcher.process_scene_images(
                "j1", [{"id": "s1", "prompt": "p"}], tier="pro",
            )
        assert captured["calls"][0]["model"] == cat.MODEL_IMAGE_SEEDREAM_4_5
        assert captured["calls"][0]["width"] == 2560
        assert captured["calls"][0]["height"] == 1440

    def test_studio_tier_uses_seedream_5_3k(self):
        """Studio는 Seedream 5.0 Lite에서 3K 해상도(4.67M 픽셀)."""
        captured: dict = {"calls": []}

        def fake_gen(prompt, **kwargs):
            captured["calls"].append(kwargs)
            return ("x", 0.05)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            scene_dispatcher.process_scene_images(
                "j1", [{"id": "s1", "prompt": "p"}], tier="studio",
            )
        assert captured["calls"][0]["model"] == cat.MODEL_IMAGE_SEEDREAM_5_LITE
        assert captured["calls"][0]["width"] == 2880
        assert captured["calls"][0]["height"] == 1620

    def test_video_draft_uses_wan_2_2(self):
        fake_task = MagicMock()
        fake_task.task_id = "t1"
        captured: dict = {"calls": []}

        def fake_gen_video(prompt, **kwargs):
            captured["calls"].append(kwargs)
            return fake_task

        fake_final = MagicMock()
        fake_final.status = "success"
        fake_final.result_url = "https://v/1.mp4"
        fake_final.cost_usd = 0.5
        fake_final.error = None

        with patch("services.scene_dispatcher.rw.generate_video", side_effect=fake_gen_video), \
             patch("services.scene_dispatcher.rw.wait_for_task", return_value=fake_final):
            scene_dispatcher.process_scene_videos(
                "j1", [{"id": "s1", "prompt": "p", "image_url": "i"}], tier="draft",
            )
        assert captured["calls"][0]["model"] == cat.MODEL_VIDEO_WAN_2_2

    def test_video_studio_uses_kling_3_0_pro(self):
        fake_task = MagicMock()
        fake_task.task_id = "t1"
        captured: dict = {"calls": []}

        def fake_gen_video(prompt, **kwargs):
            captured["calls"].append(kwargs)
            return fake_task

        fake_final = MagicMock()
        fake_final.status = "success"
        fake_final.result_url = "https://v/1.mp4"
        fake_final.cost_usd = 4.5
        fake_final.error = None

        with patch("services.scene_dispatcher.rw.generate_video", side_effect=fake_gen_video), \
             patch("services.scene_dispatcher.rw.wait_for_task", return_value=fake_final):
            scene_dispatcher.process_scene_videos(
                "j1", [{"id": "s1", "prompt": "p", "image_url": "i"}], tier="studio",
            )
        assert captured["calls"][0]["model"] == cat.MODEL_VIDEO_KLING_3_0_PRO
        assert captured["calls"][0]["width"] == 1920
        assert captured["calls"][0]["height"] == 1080


class TestBudgetGuard:
    """예산 초과 직전 호출 중단 — 낭비 방지 핵심 기능."""

    def test_image_budget_stops_further_calls(self):
        scenes = [{"id": f"s{i}", "prompt": f"p{i}"} for i in range(5)]
        call_count = {"n": 0}

        def fake_gen(prompt, **kwargs):
            call_count["n"] += 1
            return (f"https://img/{prompt}", 0.03)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            out, _total = scene_dispatcher.process_scene_images(
                "j1", scenes, tier="pro", budget_remaining_usd=0.10,
            )

        # 누적 $0.03 × 3 = $0.09 < $0.10, $0.12 >= $0.10 → 4번째 전에 중단
        assert call_count["n"] <= 4, f"예산 초과인데 {call_count['n']}회 호출됨"
        blocked = [s for s in out if s.get("error") == "budget_exceeded"]
        assert len(blocked) >= 1

    def test_video_budget_stops_further_calls(self):
        scenes = [
            {"id": "s1", "prompt": "p1", "image_url": "i1"},
            {"id": "s2", "prompt": "p2", "image_url": "i2"},
            {"id": "s3", "prompt": "p3", "image_url": "i3"},
        ]
        call_count = {"n": 0}

        fake_task = MagicMock(); fake_task.task_id = "t"
        fake_final = MagicMock()
        fake_final.status = "success"
        fake_final.result_url = "https://v.mp4"
        fake_final.cost_usd = 4.0
        fake_final.error = None

        def fake_gen_video(prompt, **kwargs):
            call_count["n"] += 1
            return fake_task

        with patch("services.scene_dispatcher.rw.generate_video", side_effect=fake_gen_video), \
             patch("services.scene_dispatcher.rw.wait_for_task", return_value=fake_final):
            out, _total = scene_dispatcher.process_scene_videos(
                "j1", scenes, tier="pro", budget_remaining_usd=5.0,
            )
        # $4 1회 후 누적 $4 < $5 → 2회 호출 후 $8 >= $5 → 3회 차단
        assert call_count["n"] <= 2
        blocked = [s for s in out if s.get("error") == "budget_exceeded"]
        assert len(blocked) >= 1

    def test_no_budget_means_no_limit(self):
        scenes = [{"id": f"s{i}", "prompt": f"p{i}"} for i in range(5)]

        def fake_gen(prompt, **kwargs):
            return ("x", 5.0)

        with patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_gen):
            out, total = scene_dispatcher.process_scene_images(
                "j1", scenes, tier="studio",
            )
        assert len(out) == 5
        assert all(s.get("image_url") for s in out)
        assert total == pytest.approx(25.0)


class TestBudgetExceededError:
    def test_exception_carries_context(self):
        e = scene_dispatcher.BudgetExceeded(planned_usd=20.0, budget_usd=7.0, tier="pro")
        assert e.tier == "pro"
        assert e.planned_usd == 20.0
        assert e.budget_usd == 7.0
        assert "pro" in str(e)


class TestRunScenePipelineTiers:
    """run_scene_pipeline end-to-end: 티어 전달 + 예산 초과 시 mark_failed."""

    def test_studio_tier_invokes_kling_3_0_pro(self):
        from services import scene_dispatcher as sd

        fake_scenes = [
            {"id": "s1", "prompt": "a singer on stage", "duration_sec": 7.5},
            {"id": "s2", "prompt": "crowd cheering", "duration_sec": 7.5},
        ]
        image_captured, video_captured = [], []

        def fake_img(prompt, **kwargs):
            image_captured.append(kwargs.get("model"))
            return ("https://img", 0.05)

        fake_task = MagicMock(); fake_task.task_id = "t"
        fake_final = MagicMock()
        fake_final.status = "success"
        fake_final.result_url = "https://v.mp4"
        fake_final.cost_usd = 4.0
        fake_final.error = None

        def fake_vid(prompt, **kwargs):
            video_captured.append(kwargs.get("model"))
            return fake_task

        with patch("services.scene_planner.plan_scenes", return_value=fake_scenes), \
             patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_img), \
             patch("services.scene_dispatcher.rw.generate_video", side_effect=fake_vid), \
             patch("services.scene_dispatcher.rw.wait_for_task", return_value=fake_final), \
             patch("services.scene_dispatcher.update_scene_plan"), \
             patch("services.scene_dispatcher.increment_cost_usd"), \
             patch("services.scene_dispatcher.pipeline.transition"), \
             patch("services.scene_dispatcher.pipeline.mark_failed") as mock_fail:
            sd.run_scene_pipeline("j1", "cinematic", 60.0, tier="studio")

        assert cat.MODEL_IMAGE_SEEDREAM_5_LITE in image_captured
        assert cat.MODEL_VIDEO_KLING_3_0_PRO in video_captured
        mock_fail.assert_not_called()

    def test_draft_tier_default_when_missing(self):
        """tier 없으면 DEFAULT_TIER(pro) 적용 — backward compat."""
        from services import scene_dispatcher as sd

        fake_scenes = [{"id": "s1", "prompt": "p", "duration_sec": 10.0}]
        image_captured = []

        def fake_img(prompt, **kwargs):
            image_captured.append(kwargs.get("model"))
            return ("x", 0.01)

        fake_task = MagicMock(); fake_task.task_id = "t"
        fake_final = MagicMock()
        fake_final.status = "success"
        fake_final.result_url = "v"
        fake_final.cost_usd = 0.5
        fake_final.error = None

        with patch("services.scene_planner.plan_scenes", return_value=fake_scenes), \
             patch("services.scene_dispatcher.rw.generate_image_with_cost",
                   side_effect=fake_img), \
             patch("services.scene_dispatcher.rw.generate_video", return_value=fake_task), \
             patch("services.scene_dispatcher.rw.wait_for_task", return_value=fake_final), \
             patch("services.scene_dispatcher.update_scene_plan"), \
             patch("services.scene_dispatcher.increment_cost_usd"), \
             patch("services.scene_dispatcher.pipeline.transition"), \
             patch("services.scene_dispatcher.pipeline.mark_failed"):
            sd.run_scene_pipeline("j1", "cinematic", 30.0)  # tier 생략

        # 기본이 pro
        assert cat.MODEL_IMAGE_SEEDREAM_4_5 in image_captured


class TestDryRunPipeline:
    """RUNWARE_DRY_RUN=1 무과금 리허설 — 실 API 한 번도 안 부르고 파이프라인 완주."""

    def test_dry_run_completes_without_http_calls(self, monkeypatch):
        monkeypatch.setenv("RUNWARE_DRY_RUN", "1")
        monkeypatch.setenv("RUNWARE_API_KEY", "ignored")

        scenes = [
            {"id": "s1", "prompt": "p1"},
            {"id": "s2", "prompt": "p2"},
        ]
        out, total = scene_dispatcher.process_scene_images("j1", scenes, tier="studio")
        assert len(out) == 2
        assert all(s["image_url"].startswith("https://runware.dryrun/") for s in out)
        assert total == 0.0
