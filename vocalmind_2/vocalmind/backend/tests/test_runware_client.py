"""Runware client 단위 테스트 — API mock."""
from __future__ import annotations

import os
from unittest.mock import patch, MagicMock

import httpx
import pytest

from infra import runware_client as rw


@pytest.fixture(autouse=True)
def _env():
    with patch.dict(os.environ, {"RUNWARE_API_KEY": "test-key"}):
        # 싱글톤 리셋 (테스트 격리)
        rw._client = None
        yield
        rw._client = None


def _mock_httpx_response(status_code: int, body: dict):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = body
    resp.text = str(body)
    return resp


class TestGenerateImage:
    def test_success_returns_url(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"imageURL": "https://cdn.runware.ai/image-1.png"}]
            })
            url = rw.generate_image("a beautiful sunset", width=512, height=512)
        assert url == "https://cdn.runware.ai/image-1.png"

    def test_missing_url_raises(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"imageURL": None}]
            })
            with pytest.raises(rw.RunwareError, match="이미지 URL"):
                rw.generate_image("prompt")

    def test_http_error_raises(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(500, {"error": "server"})
            with pytest.raises(rw.RunwareError) as exc:
                rw.generate_image("prompt")
            assert exc.value.status_code == 500


class TestGenerateVideo:
    def test_pending_task_returned(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{
                    "taskUUID": "abc-123",
                    "status": "processing",
                    "videoURL": None,
                }]
            })
            task = rw.generate_video("cinematic city", duration_sec=10.0)
        assert task.task_id == "abc-123"
        assert task.status == "processing"
        assert task.result_url is None

    def test_image_to_video(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"taskUUID": "v-1", "status": "pending"}]
            })
            rw.generate_video("animate this", image_url="https://x.com/a.png")
        sent = mock_post.call_args.kwargs["json"][0]
        assert sent["imageURL"] == "https://x.com/a.png"


class TestGenerateLipsync:
    def test_lipsync_task_created(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"taskUUID": "ls-1", "status": "pending"}]
            })
            task = rw.generate_lipsync(
                video_url="https://x.com/v.mp4",
                audio_url="https://x.com/a.mp3",
            )
        assert task.task_id == "ls-1"
        sent = mock_post.call_args.kwargs["json"][0]
        assert sent["taskType"] == "lipSync"
        assert sent["videoURL"] == "https://x.com/v.mp4"
        assert sent["audioURL"] == "https://x.com/a.mp3"


class TestClientSingleton:
    def test_missing_api_key_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            rw._client = None
            with pytest.raises(rw.RunwareError, match="RUNWARE_API_KEY"):
                rw._get_client()

    def test_singleton_reuses_client(self):
        c1 = rw._get_client()
        c2 = rw._get_client()
        assert c1 is c2


class TestDryRun:
    """RUNWARE_DRY_RUN=1 무과금 리허설 모드.

    마스터 각인(feedback_vocalmind_bond_quality_first.md): 낭비 방지 1원칙.
    실 API를 절대 호출하지 않고 결정론적 가짜 URL + cost=0 반환.
    """

    def test_image_dry_run_returns_fake_url_and_zero_cost(self):
        with patch.dict(os.environ, {"RUNWARE_DRY_RUN": "1", "RUNWARE_API_KEY": "test-key"}), \
             patch.object(rw.httpx.Client, "post") as mock_post:
            url, cost = rw.generate_image_with_cost("a calm ocean", model="bytedance:seedream@4.5")
        assert url.startswith("https://runware.dryrun/image/")
        assert cost == 0.0
        mock_post.assert_not_called()  # 실호출 절대 없음

    def test_image_dry_run_is_deterministic(self):
        with patch.dict(os.environ, {"RUNWARE_DRY_RUN": "1", "RUNWARE_API_KEY": "test-key"}):
            a, _ = rw.generate_image_with_cost("same prompt", model="bytedance:seedream@4.5")
            b, _ = rw.generate_image_with_cost("same prompt", model="bytedance:seedream@4.5")
        assert a == b  # hash 기반 결정론

    def test_video_dry_run_returns_success_task(self):
        with patch.dict(os.environ, {"RUNWARE_DRY_RUN": "1", "RUNWARE_API_KEY": "test-key"}), \
             patch.object(rw.httpx.Client, "post") as mock_post:
            task = rw.generate_video(
                "cinematic city",
                duration_sec=5.0,
                model="klingai:kling-video@3-pro",
            )
        assert task.status == "success"
        assert task.result_url.startswith("https://runware.dryrun/video/")
        assert task.cost_usd == 0.0
        mock_post.assert_not_called()

    def test_lipsync_dry_run(self):
        with patch.dict(os.environ, {"RUNWARE_DRY_RUN": "1", "RUNWARE_API_KEY": "test-key"}), \
             patch.object(rw.httpx.Client, "post") as mock_post:
            task = rw.generate_lipsync("https://v/x.mp4", "https://a/y.wav", model="sync:sync-3@1")
        assert task.status == "success"
        assert task.result_url.startswith("https://runware.dryrun/lipsync/")
        mock_post.assert_not_called()

    def test_dry_run_disabled_by_default(self):
        """환경변수 없으면 평소대로 실호출 경로."""
        with patch.dict(os.environ, {"RUNWARE_API_KEY": "test-key"}, clear=True), \
             patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"imageURL": "https://real.cdn/x.png"}]
            })
            url, _ = rw.generate_image_with_cost("x", model="runware:100@1")
        assert url == "https://real.cdn/x.png"
        mock_post.assert_called_once()

    def test_dry_run_off_when_flag_is_zero(self):
        with patch.dict(os.environ, {"RUNWARE_DRY_RUN": "0", "RUNWARE_API_KEY": "test-key"}), \
             patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"imageURL": "https://real.cdn/y.png"}]
            })
            url, _ = rw.generate_image_with_cost("y", model="runware:100@1")
        assert "real.cdn" in url


class TestSeedreamImageToImage:
    """Seedream 4.5/5.0의 referenceImages 지원 — image-to-image.

    FLUX Schnell과 달리 steps/CFGScale은 보내지 않아야 한다 (모델이 지원 안 함).
    """

    def test_seedream_payload_has_reference_images_and_no_steps(self):
        captured = {}

        def _capture(self, *args, **kwargs):  # noqa: ARG001
            captured["payload"] = kwargs.get("json")
            return _mock_httpx_response(200, {
                "data": [{"imageURL": "https://cdn/x.png", "cost": 0.03}]
            })

        with patch.object(rw.httpx.Client, "post", _capture):
            # Seedream 하한 충족 해상도 (3.68M+)
            url, cost = rw.generate_image_with_cost(
                "a dancer in neon rain",
                model="bytedance:seedream@4.5",
                width=2560, height=1440,
                reference_images=["https://ref1.png", "https://ref2.png"],
            )
        assert url == "https://cdn/x.png"
        assert cost == 0.03
        payload_item = captured["payload"][0]
        assert payload_item["model"] == "bytedance:seedream@4.5"
        assert payload_item["inputs"]["referenceImages"] == ["https://ref1.png", "https://ref2.png"]
        # Seedream에는 steps/CFGScale 불포함
        assert "steps" not in payload_item
        assert "CFGScale" not in payload_item

    def test_flux_payload_still_has_steps(self):
        captured = {}

        def _capture(self, *args, **kwargs):  # noqa: ARG001
            captured["payload"] = kwargs.get("json")
            return _mock_httpx_response(200, {"data": [{"imageURL": "x", "cost": 0.001}]})

        with patch.object(rw.httpx.Client, "post", _capture):
            rw.generate_image_with_cost("prompt", model="runware:100@1", steps=4)
        payload_item = captured["payload"][0]
        assert payload_item["steps"] == 4
        assert payload_item["CFGScale"] == 3.0
        assert "inputs" not in payload_item  # reference_images 없으면 inputs 미포함

    def test_seedream_truncates_reference_images_to_14(self):
        captured = {}

        def _capture(self, *args, **kwargs):  # noqa: ARG001
            captured["payload"] = kwargs.get("json")
            return _mock_httpx_response(200, {"data": [{"imageURL": "x"}]})

        with patch.object(rw.httpx.Client, "post", _capture):
            refs = [f"https://r/{i}.png" for i in range(20)]  # 20장 → 14장으로 잘림
            # Seedream 하한 충족 해상도 (3.68M+) 사용
            rw.generate_image_with_cost(
                "p", model="bytedance:seedream@4.5",
                width=2560, height=1440, reference_images=refs,
            )
        payload_item = captured["payload"][0]
        assert len(payload_item["inputs"]["referenceImages"]) == 14


class TestDimensionPrecheck:
    """FAILURES.md #1 재발 방지 — API 400 맞기 전에 ValueError로 차단."""

    def test_seedream_too_small_raises_before_http(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            with pytest.raises(rw.RunwareError) as exc:
                rw.generate_image_with_cost(
                    "p", model="bytedance:seedream@4.5",
                    width=1920, height=1080,  # 2M < 3.68M → 차단
                )
        assert "dimensions" in str(exc.value).lower() or "픽셀" in str(exc.value)
        mock_post.assert_not_called()  # API 호출 0 — 비용 0

    def test_seedream_5_lite_too_large_raises_before_http(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            with pytest.raises(rw.RunwareError):
                rw.generate_image_with_cost(
                    "p", model="bytedance:seedream@5.0-lite",
                    width=4096, height=4096,  # 16.7M > 10.4M → 차단
                )
        mock_post.assert_not_called()

    def test_flux_no_dim_constraint(self):
        with patch.object(rw.httpx.Client, "post") as mock_post:
            mock_post.return_value = _mock_httpx_response(200, {
                "data": [{"imageURL": "https://x.png", "cost": 0.0006}]
            })
            url, _ = rw.generate_image_with_cost(
                "p", model="runware:100@1", width=1024, height=576,
            )
        assert url == "https://x.png"
        mock_post.assert_called_once()

    def test_catalog_valid_tier_resolutions_pass_precheck(self):
        """카탈로그에 정의된 모든 티어 해상도는 선검증을 통과해야 한다 — 회귀 방지."""
        from infra import runware_catalog as cat
        for tier_name, spec in cat.TIERS.items():
            w, h = spec.image_resolution
            with patch.object(rw.httpx.Client, "post") as mock_post:
                mock_post.return_value = _mock_httpx_response(200, {
                    "data": [{"imageURL": f"https://ok/{tier_name}.png", "cost": 0.01}]
                })
                url, _ = rw.generate_image_with_cost(
                    "p", model=spec.image_model, width=w, height=h,
                )
                # 선검증 통과 → 실제 HTTP 호출 1회 발생
                assert url.startswith("https://ok/")
                assert mock_post.call_count == 1
