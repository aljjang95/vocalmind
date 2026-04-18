"""Runware 카탈로그 + 품질 티어 매트릭스 단위 테스트."""
from __future__ import annotations

import pytest

from infra import runware_catalog as cat


class TestTierSpecs:
    def test_all_three_tiers_present(self):
        assert set(cat.TIERS) == {"draft", "pro", "studio"}

    def test_draft_under_two_dollars(self):
        assert cat.TIERS["draft"].budget_usd <= 2.0

    def test_pro_budget_between_draft_and_studio(self):
        assert cat.TIERS["draft"].budget_usd < cat.TIERS["pro"].budget_usd < cat.TIERS["studio"].budget_usd

    def test_duration_increases_by_tier(self):
        assert cat.TIERS["draft"].duration_sec < cat.TIERS["pro"].duration_sec < cat.TIERS["studio"].duration_sec

    def test_price_increases_by_tier(self):
        assert cat.TIERS["draft"].price_krw < cat.TIERS["pro"].price_krw < cat.TIERS["studio"].price_krw

    def test_credits_match_price_1krw_per_krw(self):
        # 1 크레딧 = 1,000원
        for tier, spec in cat.TIERS.items():
            assert spec.price_krw == spec.credits * 1_000, f"{tier} 가격 불일치"

    def test_per_scene_duration_reasonable(self):
        for tier, spec in cat.TIERS.items():
            pcd = spec.per_scene_duration()
            assert 3.0 <= pcd <= 10.0, f"{tier} 씬당 길이 {pcd} 비현실적"


class TestModelAirIdentifiers:
    def test_draft_uses_cheap_models(self):
        assert cat.TIERS["draft"].image_model == cat.MODEL_IMAGE_FLUX_SCHNELL
        assert cat.TIERS["draft"].video_model == cat.MODEL_VIDEO_WAN_2_2

    def test_flux_schnell_dev_air_values_not_swapped(self):
        """FAILURES.md #3 재발 방지 — runware:100@1=Schnell, 101@1=Dev.

        Runware 공식 docs 2026-04-18 검증. 상수 이름과 AIR 값이 역전되면
        Draft 티어가 실수로 Dev를 호출해 단가 ~6배 폭주.
        """
        assert cat.MODEL_IMAGE_FLUX_SCHNELL == "runware:100@1"
        assert cat.MODEL_IMAGE_FLUX_DEV == "runware:101@1"

    def test_pro_uses_seedream_4_5(self):
        assert cat.TIERS["pro"].image_model == cat.MODEL_IMAGE_SEEDREAM_4_5
        assert cat.TIERS["pro"].video_model == cat.MODEL_VIDEO_KLING_2_6_PRO

    def test_studio_uses_premium_models(self):
        assert cat.TIERS["studio"].image_model == cat.MODEL_IMAGE_SEEDREAM_5_LITE
        assert cat.TIERS["studio"].video_model == cat.MODEL_VIDEO_KLING_3_0_PRO

    def test_all_air_identifiers_are_non_empty_strings(self):
        for tier, spec in cat.TIERS.items():
            assert isinstance(spec.image_model, str) and ":" in spec.image_model
            assert isinstance(spec.video_model, str) and ":" in spec.video_model
            assert isinstance(spec.lipsync_model, str) and ":" in spec.lipsync_model


class TestSelectModel:
    def test_image_models_per_tier(self):
        assert cat.select_model("image", "draft") == cat.MODEL_IMAGE_FLUX_SCHNELL
        assert cat.select_model("image", "pro") == cat.MODEL_IMAGE_SEEDREAM_4_5
        assert cat.select_model("image", "studio") == cat.MODEL_IMAGE_SEEDREAM_5_LITE

    def test_video_models_per_tier(self):
        assert cat.select_model("video", "draft") == cat.MODEL_VIDEO_WAN_2_2
        assert cat.select_model("video", "pro") == cat.MODEL_VIDEO_KLING_2_6_PRO
        assert cat.select_model("video", "studio") == cat.MODEL_VIDEO_KLING_3_0_PRO

    def test_lipsync_studio_uses_sync3(self):
        assert cat.select_model("lipsync", "studio") == cat.MODEL_LIPSYNC_SYNC3

    def test_unknown_kind_raises(self):
        with pytest.raises(ValueError):
            cat.select_model("unknown", "pro")  # type: ignore[arg-type]


class TestStyleAnchors:
    def test_all_styles_have_anchors(self):
        assert set(cat.STYLE_ANCHORS) == {"cinematic", "cozy", "retro", "ghibli", "neon_city", "fantasy"}

    def test_anchors_are_non_trivial(self):
        for style, anchor in cat.STYLE_ANCHORS.items():
            assert len(anchor) >= 40, f"{style} 앵커가 너무 짧음"

    def test_apply_style_appends_anchor(self):
        out = cat.apply_style("a lonely singer on stage", "cinematic")
        assert "ARRI" in out
        assert "singer" in out

    def test_apply_style_is_idempotent(self):
        out1 = cat.apply_style("Studio Ghibli forest scene", "ghibli")
        out2 = cat.apply_style(out1, "ghibli")
        # 같은 앵커 키워드가 이미 포함돼 있으면 중복 추가 안 됨
        assert out1 == out2


class TestValidateTier:
    def test_valid_tiers(self):
        for t in ("draft", "pro", "studio"):
            assert cat.validate_tier(t) == t

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            cat.validate_tier("premium")
        with pytest.raises(ValueError):
            cat.validate_tier("")


class TestDefaults:
    def test_default_tier_is_pro(self):
        """표준 티어는 pro (유료 체험 첫 전환 지점)."""
        assert cat.DEFAULT_TIER == "pro"


class TestModelDimensionConstraints:
    """FAILURES.md #1 재발 방지.

    Seedream 계열은 최소 3,686,400 픽셀 요구. 카탈로그 해상도가 이를 만족해야 함.
    이 테스트가 통과해야 실호출에서 invalidPixels 400 안 받음.
    """

    def test_all_tier_image_resolutions_satisfy_model_min_pixels(self):
        for tier, spec in cat.TIERS.items():
            w, h = spec.image_resolution
            # validate_dimensions는 위반 시 ValueError. 통과해야 함.
            try:
                cat.validate_dimensions(spec.image_model, w, h)
            except ValueError as e:
                pytest.fail(
                    f"티어 {tier} 해상도 {w}x{h}가 모델 {spec.image_model}와 호환되지 않음: {e}"
                )

    def test_seedream_4_5_min_pixels_hit_boundary(self):
        """카탈로그 Pro 해상도가 Seedream 4.5 하한(3.68M)을 정확히 만족하는지."""
        pro = cat.TIERS["pro"]
        pixels = pro.image_resolution[0] * pro.image_resolution[1]
        assert pixels >= 3_686_400, f"Pro 해상도 {pixels} < Seedream 4.5 하한"

    def test_seedream_5_lite_min_pixels_and_max(self):
        studio = cat.TIERS["studio"]
        pixels = studio.image_resolution[0] * studio.image_resolution[1]
        assert 3_686_400 <= pixels <= 10_404_496

    def test_validate_dimensions_blocks_too_small(self):
        with pytest.raises(ValueError) as exc:
            cat.validate_dimensions(cat.MODEL_IMAGE_SEEDREAM_4_5, 1920, 1080)
        assert "최소 픽셀" in str(exc.value)
        assert "2,073,600" in str(exc.value) or "2073600" in str(exc.value)

    def test_validate_dimensions_blocks_too_large(self):
        with pytest.raises(ValueError) as exc:
            cat.validate_dimensions(cat.MODEL_IMAGE_SEEDREAM_5_LITE, 4096, 4096)
        assert "최대 픽셀" in str(exc.value)

    def test_validate_dimensions_passes_flux(self):
        """FLUX는 제약 없음 — 작은 해상도도 통과해야."""
        cat.validate_dimensions(cat.MODEL_IMAGE_FLUX_SCHNELL, 512, 512)
        cat.validate_dimensions(cat.MODEL_IMAGE_FLUX_SCHNELL, 1024, 576)

    def test_validate_dimensions_rejects_zero_or_negative(self):
        with pytest.raises(ValueError):
            cat.validate_dimensions(cat.MODEL_IMAGE_SEEDREAM_4_5, 0, 1440)
        with pytest.raises(ValueError):
            cat.validate_dimensions(cat.MODEL_IMAGE_SEEDREAM_4_5, -100, 1440)
