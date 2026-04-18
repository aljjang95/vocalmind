"""modal_compose 순수 헬퍼 단위 테스트 (Modal 런타임 불필요)."""
from __future__ import annotations

import pytest

from modal_compose import (
    build_concat_filter,
    compute_pad_filter,
    parse_storage_path,
    _seconds_to_srt,
    _do_mix,
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


class TestDoMix:
    """_do_mix 단위 테스트 (ffmpeg + supabase 전부 mock)."""

    def test_calls_ffmpeg_with_correct_amix_filter(self, tmp_path):
        """FFmpeg amix filter 문자열이 올바른지 확인."""
        import os
        from unittest.mock import patch, MagicMock, call

        # 다운로드 mock: 빈 파일 생성
        def fake_stream(method, url, *args, **kwargs):
            ctx = MagicMock()
            ctx.__enter__ = MagicMock(return_value=ctx)
            ctx.__exit__ = MagicMock(return_value=False)
            ctx.raise_for_status = MagicMock()
            ctx.iter_bytes = MagicMock(return_value=[b"AUDIO"])
            return ctx

        fake_client = MagicMock()
        fake_client.__enter__ = MagicMock(return_value=fake_client)
        fake_client.__exit__ = MagicMock(return_value=False)
        fake_client.stream = fake_stream

        # ffmpeg 실행 mock (실제 실행 안 함)
        fake_completed = MagicMock()
        fake_completed.returncode = 0

        # supabase mock
        fake_sb = MagicMock()
        fake_sb.storage.from_.return_value.upload.return_value = {}

        subprocess_calls = []

        def fake_run(cmd, *args, **kwargs):
            subprocess_calls.append(cmd)
            # output_path를 실제로 생성 (이후 read_bytes 사용)
            for arg in cmd:
                if str(arg).endswith(".m4a"):
                    from pathlib import Path
                    Path(arg).write_bytes(b"MIXED")
                    break
            return fake_completed

        with patch("httpx.Client", return_value=fake_client), \
             patch("subprocess.run", side_effect=fake_run), \
             patch("modal_compose.create_client", return_value=fake_sb, create=True), \
             patch.dict(os.environ, {
                 "SUPABASE_URL": "https://test.supabase.co",
                 "SUPABASE_SERVICE_ROLE_KEY": "test-key",
             }):
            # supabase import 내부 mock
            import sys
            mock_supabase = MagicMock()
            mock_supabase.create_client.return_value = fake_sb
            sys.modules.setdefault("supabase", mock_supabase)

            result = _do_mix(
                "job1",
                "https://example.com/vocals.wav",
                "https://example.com/instrumental.wav",
                "studio-recording",
                "u1/job1",
                tmp_path,
            )

        # FFmpeg 호출 확인
        assert len(subprocess_calls) == 1
        ffmpeg_cmd = subprocess_calls[0]
        cmd_str = " ".join(str(c) for c in ffmpeg_cmd)
        assert "amix=inputs=2" in cmd_str
        assert "volume=1.0" in cmd_str
        assert "volume=0.85" in cmd_str
        assert "aac" in cmd_str

    def test_result_contains_final_vocal_mix_path(self, tmp_path):
        """반환 dict에 final_vocal_mix_path 키가 있는지 확인."""
        import os
        from unittest.mock import patch, MagicMock

        def fake_stream(method, url, *args, **kwargs):
            ctx = MagicMock()
            ctx.__enter__ = MagicMock(return_value=ctx)
            ctx.__exit__ = MagicMock(return_value=False)
            ctx.raise_for_status = MagicMock()
            ctx.iter_bytes = MagicMock(return_value=[b"AUDIO"])
            return ctx

        fake_client = MagicMock()
        fake_client.__enter__ = MagicMock(return_value=fake_client)
        fake_client.__exit__ = MagicMock(return_value=False)
        fake_client.stream = fake_stream

        def fake_run(cmd, *args, **kwargs):
            for arg in cmd:
                if str(arg).endswith(".m4a"):
                    from pathlib import Path
                    Path(arg).write_bytes(b"MIXED")
                    break
            return MagicMock(returncode=0)

        fake_sb = MagicMock()
        fake_sb.storage.from_.return_value.upload.return_value = {}

        import sys
        mock_supabase = MagicMock()
        mock_supabase.create_client.return_value = fake_sb
        sys.modules.setdefault("supabase", mock_supabase)

        with patch("httpx.Client", return_value=fake_client), \
             patch("subprocess.run", side_effect=fake_run), \
             patch.dict(os.environ, {
                 "SUPABASE_URL": "https://test.supabase.co",
                 "SUPABASE_SERVICE_ROLE_KEY": "test-key",
             }):
            result = _do_mix(
                "job1",
                "https://example.com/vocals.wav",
                "https://example.com/instrumental.wav",
                "studio-recording",
                "u1/job1",
                tmp_path,
            )

        assert "final_vocal_mix_path" in result
        assert "studio-recording" in result["final_vocal_mix_path"]
        assert "final_mix.m4a" in result["final_vocal_mix_path"]
