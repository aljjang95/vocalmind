"""모더레이션 3단계 테스트 — core(verdict) + infra(moderation_repo) + application(enforce)."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import httpx
import pytest

from application.moderation import enforce
from core.moderation import rules
from core.moderation.verdict import (
    judge_cover_output,
    judge_upload,
    judge_voice_identity,
)
from domain_types.moderation import ModerationError, VoiceClip
from infra.supabase.moderation_repo import log_events


# ============================================================
# Stage 1: upload
# ============================================================

class TestUploadMR:
    def test_valid_mr_passes(self):
        r = judge_upload(kind="mr", file_name="song.mp3", size_bytes=5_000_000, duration_sec=180.0)
        assert r.ok
        assert r.events == []

    def test_invalid_extension_blocks(self):
        r = judge_upload(kind="mr", file_name="hack.exe", size_bytes=1000, duration_sec=180.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "file_ext" for e in r.events)

    def test_no_extension_blocks(self):
        r = judge_upload(kind="mr", file_name="noext", size_bytes=1000, duration_sec=180.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "file_ext" for e in r.events)

    def test_oversize_blocks(self):
        r = judge_upload(
            kind="mr", file_name="song.mp3",
            size_bytes=rules.MAX_SIZE_BYTES["mr"] + 1,
            duration_sec=180.0,
        )
        assert r.decision == "block"
        assert any(e.detail["rule"] == "file_too_large" for e in r.events)

    def test_empty_file_blocks(self):
        r = judge_upload(kind="mr", file_name="song.mp3", size_bytes=0, duration_sec=180.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "empty_file" for e in r.events)

    def test_duration_missing_blocks(self):
        r = judge_upload(kind="mr", file_name="song.mp3", size_bytes=1000, duration_sec=None)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_missing" for e in r.events)

    def test_duration_too_short_blocks(self):
        r = judge_upload(kind="mr", file_name="song.mp3", size_bytes=1000, duration_sec=5.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_out_of_range" for e in r.events)

    def test_duration_too_long_blocks(self):
        r = judge_upload(kind="mr", file_name="song.mp3", size_bytes=1000, duration_sec=700.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_out_of_range" for e in r.events)

    def test_multiple_violations_all_captured(self):
        r = judge_upload(kind="mr", file_name="hack.exe", size_bytes=0, duration_sec=None)
        assert r.decision == "block"
        rules_hit = {e.detail["rule"] for e in r.events}
        assert "file_ext" in rules_hit
        assert "empty_file" in rules_hit
        assert "duration_missing" in rules_hit


class TestUploadRecording:
    def test_valid_webm_recording_passes(self):
        r = judge_upload(
            kind="recording", file_name="rec.webm",
            size_bytes=1_000_000, duration_sec=60.0,
        )
        assert r.ok

    def test_recording_min_duration_boundary(self):
        r = judge_upload(kind="recording", file_name="rec.webm", size_bytes=1000, duration_sec=10.0)
        assert r.ok


class TestUploadAvatar:
    def test_valid_png_avatar_passes(self):
        r = judge_upload(kind="avatar", file_name="face.png", size_bytes=500_000)
        assert r.ok

    def test_avatar_does_not_require_duration(self):
        r = judge_upload(kind="avatar", file_name="face.jpg", size_bytes=1000, duration_sec=None)
        assert r.ok

    def test_avatar_mp3_blocked(self):
        r = judge_upload(kind="avatar", file_name="face.mp3", size_bytes=1000)
        assert r.decision == "block"


# ============================================================
# Stage 2: voice_identity
# ============================================================

def _valid_clips(n: int = 10, duration: float = 10.0) -> list[VoiceClip]:
    return [VoiceClip(storage_path=f"user/clip_{i}.webm", duration_sec=duration) for i in range(n)]


class TestVoiceIdentity:
    def test_valid_10_clips_passes(self):
        r = judge_voice_identity(_valid_clips())
        assert r.ok

    def test_nine_clips_blocks(self):
        r = judge_voice_identity(_valid_clips(n=9))
        assert r.decision == "block"
        assert any(e.detail["rule"] == "clip_count" for e in r.events)
        assert all(e.category == "voice_not_owner" for e in r.events)

    def test_eleven_clips_blocks(self):
        r = judge_voice_identity(_valid_clips(n=11))
        assert r.decision == "block"
        assert any(e.detail["rule"] == "clip_count" for e in r.events)

    def test_duplicate_path_blocks(self):
        clips = _valid_clips()
        clips[3] = VoiceClip(storage_path=clips[0].storage_path, duration_sec=10.0)
        r = judge_voice_identity(clips)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "clip_duplicate" for e in r.events)

    def test_too_short_clip_blocks(self):
        clips = _valid_clips()
        clips[2] = VoiceClip(storage_path="user/short.webm", duration_sec=1.0)
        r = judge_voice_identity(clips)
        assert r.decision == "block"
        assert any(
            e.detail["rule"] == "clip_duration" and e.detail["index"] == 2
            for e in r.events
        )

    def test_too_long_clip_blocks(self):
        clips = _valid_clips()
        clips[5] = VoiceClip(storage_path="user/long.webm", duration_sec=25.0)
        r = judge_voice_identity(clips)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "clip_duration" for e in r.events)

    def test_total_duration_below_min_blocks(self):
        clips = _valid_clips(duration=5.0)
        r = judge_voice_identity(clips)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "total_duration" for e in r.events)

    def test_boundary_min_clip_duration_passes(self):
        clips = _valid_clips(duration=rules.VI_CLIP_DURATION_MIN)
        r = judge_voice_identity(clips)
        assert r.decision == "block"
        rules_hit = {e.detail["rule"] for e in r.events}
        assert rules_hit == {"total_duration"}


# ============================================================
# Stage 3: cover_output
# ============================================================

class TestCoverOutput:
    def test_valid_output_passes(self):
        r = judge_cover_output(
            output_url="https://storage/x.mp4",
            duration_sec=180.0,
            lyrics_text="사랑해 우리 함께 걷자",
            scene_prompts=["cinematic sunset", "cozy room"],
        )
        assert r.ok

    def test_missing_url_blocks(self):
        r = judge_cover_output(output_url=None, duration_sec=180.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "output_missing" for e in r.events)

    def test_missing_duration_blocks(self):
        r = judge_cover_output(output_url="https://x/y.mp4", duration_sec=None)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_missing" for e in r.events)

    def test_duration_too_short_blocks(self):
        r = judge_cover_output(output_url="https://x/y.mp4", duration_sec=5.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_out_of_range" for e in r.events)

    def test_duration_too_long_blocks(self):
        r = judge_cover_output(output_url="https://x/y.mp4", duration_sec=1200.0)
        assert r.decision == "block"
        assert any(e.detail["rule"] == "duration_out_of_range" for e in r.events)

    def test_banned_lyrics_blocks(self):
        r = judge_cover_output(
            output_url="https://x/y.mp4",
            duration_sec=180.0,
            lyrics_text="폭파 테러를 일으키자",
        )
        assert r.decision == "block"
        ev = next(e for e in r.events if e.detail["rule"] == "banned_keyword_lyrics")
        assert ev.category == "lyrics_policy"
        assert "테러" in ev.detail["keywords"]
        assert "폭파" in ev.detail["keywords"]

    def test_banned_scene_prompts_blocks(self):
        r = judge_cover_output(
            output_url="https://x/y.mp4",
            duration_sec=180.0,
            scene_prompts=["미성년 어린이 학원", "cozy morning"],
        )
        assert r.decision == "block"
        ev = next(e for e in r.events if e.detail["rule"] == "banned_keyword_scene")
        assert ev.category == "nsfw"

    def test_copyright_artist_keyword_blocks(self):
        r = judge_cover_output(
            output_url="https://x/y.mp4",
            duration_sec=180.0,
            lyrics_text="아이유 스타일 커버",
        )
        assert r.decision == "block"
        assert any("아이유" in e.detail.get("keywords", []) for e in r.events)

    def test_no_lyrics_or_scene_still_passes(self):
        r = judge_cover_output(output_url="https://x/y.mp4", duration_sec=180.0)
        assert r.ok


# ============================================================
# log_events + enforce 통합
# ============================================================

@pytest.fixture
def _supabase_env():
    with patch.dict(os.environ, {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    }):
        yield


def _mock_resp(status: int, body: object = None) -> httpx.Response:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status
    resp.text = str(body or "")
    return resp


class TestLogEvents:
    def test_pass_result_no_log(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.mp3", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            count = log_events("user-1", r)
        assert count == 0
        assert m.call_count == 0

    def test_block_result_posts_to_supabase(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.exe", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            m.return_value = _mock_resp(201)
            count = log_events("user-1", r, job_id="job-1")
        assert count == 1
        call = m.call_args
        assert "moderation_events" in call.args[0]
        body = call.kwargs["json"]
        assert len(body) == 1
        assert body[0]["user_id"] == "user-1"
        assert body[0]["job_id"] == "job-1"
        assert body[0]["category"] == "other"
        assert body[0]["severity"] == "block"

    def test_missing_env_does_not_raise(self):
        r = judge_upload(kind="mr", file_name="x.exe", size_bytes=1000, duration_sec=180.0)
        with patch.dict(os.environ, {}, clear=True):
            count = log_events("user-1", r)
        assert count == 0

    def test_supabase_error_does_not_raise(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.exe", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            m.return_value = _mock_resp(500, "internal")
            count = log_events("user-1", r)
        assert count == 0

    def test_network_error_does_not_raise(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.exe", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            m.side_effect = httpx.ConnectError("boom")
            count = log_events("user-1", r)
        assert count == 0


class TestEnforce:
    def test_pass_result_no_raise(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.mp3", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post"):
            out = enforce("user-1", r)
        assert out is r

    def test_block_raises_moderation_error(self, _supabase_env):
        r = judge_upload(kind="mr", file_name="x.exe", size_bytes=1000, duration_sec=180.0)
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            m.return_value = _mock_resp(201)
            with pytest.raises(ModerationError) as exc:
                enforce("user-1", r, job_id="job-1")
        assert exc.value.result.decision == "block"
        assert m.call_count == 1

    def test_block_error_contains_categories(self, _supabase_env):
        r = judge_cover_output(
            output_url="https://x/y.mp4",
            duration_sec=180.0,
            lyrics_text="테러 계획",
        )
        with patch("infra.supabase.moderation_repo.httpx.post") as m:
            m.return_value = _mock_resp(201)
            with pytest.raises(ModerationError) as exc:
                enforce("user-1", r)
        assert "lyrics_policy" in str(exc.value)


# ============================================================
# End-to-end 3단계 시나리오
# ============================================================

class TestThreeStagePipeline:
    def test_happy_path_all_three_stages_pass(self, _supabase_env):
        r1 = judge_upload(kind="mr", file_name="song.mp3", size_bytes=5_000_000, duration_sec=180.0)
        assert r1.ok
        r2 = judge_voice_identity(_valid_clips())
        assert r2.ok
        r3 = judge_cover_output(
            output_url="https://storage/cover.mp4",
            duration_sec=180.0,
            lyrics_text="봄날의 햇살이 비추네",
            scene_prompts=["cinematic sunset", "cozy room", "soft light"],
        )
        assert r3.ok

    def test_stage1_fails_stops_pipeline(self, _supabase_env):
        r1 = judge_upload(kind="mr", file_name="song.exe", size_bytes=1000, duration_sec=180.0)
        assert r1.decision == "block"

    def test_stage3_catches_late_violation(self, _supabase_env):
        r1 = judge_upload(kind="mr", file_name="song.mp3", size_bytes=5_000_000, duration_sec=180.0)
        r2 = judge_voice_identity(_valid_clips())
        r3 = judge_cover_output(
            output_url="https://storage/cover.mp4",
            duration_sec=180.0,
            scene_prompts=["어린이 타겟 콘텐츠"],
        )
        assert r1.ok and r2.ok
        assert r3.decision == "block"
        assert any(e.category == "nsfw" for e in r3.events)
