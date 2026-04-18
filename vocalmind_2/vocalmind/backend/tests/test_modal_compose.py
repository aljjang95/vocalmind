"""modal_compose 순수 헬퍼 단위 테스트 (Modal 런타임 불필요)."""
from __future__ import annotations

import pytest

from modal_compose import (
    build_concat_filter,
    compute_pad_filter,
    parse_storage_path,
    _seconds_to_srt,
)


class TestBuildConcatFilter:
    def test_four_scenes(self):
        assert build_concat_filter(4) == "concat=n=4:v=1:a=0"

    def test_single_scene(self):
        assert build_concat_filter(1) == "concat=n=1:v=1:a=0"


class TestComputePadFilter:
    def test_same_aspect_is_noop(self):
        assert compute_pad_filter("16:9", "16:9") == "null"

    def test_landscape_to_portrait_uses_blur_bg(self):
        f = compute_pad_filter("16:9", "9:16")
        assert "gblur" in f
        assert "1080:1920" in f

    def test_portrait_to_landscape_uses_blur_bg(self):
        f = compute_pad_filter("9:16", "16:9")
        assert "gblur" in f
        assert "1920:1080" in f


class TestParseStoragePath:
    def test_simple(self):
        assert parse_storage_path("mv-output/uid/job/file.mp4") == (
            "mv-output", "uid/job/file.mp4",
        )

    def test_single_slash(self):
        assert parse_storage_path("bucket/file.mp4") == ("bucket", "file.mp4")

    def test_no_slash_raises(self):
        with pytest.raises(ValueError, match="storage_path"):
            parse_storage_path("no-slash-here")


class TestSecondsToSrt:
    def test_zero(self):
        assert _seconds_to_srt(0.0) == "00:00:00,000"

    def test_5_25(self):
        assert _seconds_to_srt(5.25) == "00:00:05,250"

    def test_over_hour(self):
        assert _seconds_to_srt(3665.123) == "01:01:05,123"

    def test_millis_edge(self):
        # 0.999초 → 000:000:00,999 (반올림 없이 절사)
        assert _seconds_to_srt(0.999) == "00:00:00,999"
