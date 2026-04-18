"""Orchestrator 라우터 + studio_pipeline 단위 테스트."""
from __future__ import annotations

import os
from unittest.mock import patch, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app
from services import studio_pipeline as pipeline


@pytest.fixture(autouse=True)
def _env():
    with patch.dict(os.environ, {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        "ORCHESTRATOR_SECRET": "shhh",
    }):
        yield


def _mock_resp(status: int, body):
    r = MagicMock(spec=httpx.Response)
    r.status_code = status
    r.json.return_value = body
    r.text = str(body)
    r.raise_for_status = MagicMock(return_value=None)
    if status >= 400:
        r.raise_for_status.side_effect = httpx.HTTPStatusError("x", request=None, response=r)
    return r


class TestStepOrder:
    def test_first_step_is_pending(self):
        assert pipeline.STEP_ORDER[0] == "pending"

    def test_last_happy_step_is_completed(self):
        assert pipeline.STEP_ORDER[-1] == "completed"

    def test_all_steps_have_progress(self):
        for step in pipeline.STEP_ORDER:
            assert step in pipeline.STEP_PROGRESS
            assert 0 <= pipeline.STEP_PROGRESS[step] <= 100

    def test_all_steps_have_label(self):
        for step in pipeline.STEP_ORDER:
            assert step in pipeline.STEP_LABEL
            assert len(pipeline.STEP_LABEL[step]) > 0


class TestTransition:
    def test_success_returns_applied_true(self):
        with patch("services.studio_pipeline.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(200, [{"id": "j1", "status": "vocal_separating"}])
            result = pipeline.transition("j1", "pending", "vocal_separating")
        assert result.applied is True
        assert result.to_status == "vocal_separating"

    def test_stale_state_returns_applied_false(self):
        """다른 워커가 이미 전이시킨 경우 — 빈 배열 반환."""
        with patch("services.studio_pipeline.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(200, [])
            result = pipeline.transition("j1", "pending", "vocal_separating")
        assert result.applied is False

    def test_progress_and_label_added_automatically(self):
        with patch("services.studio_pipeline.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(200, [{"id": "j1"}])
            pipeline.transition("j1", "pending", "vocal_rvc")
            call = client.patch.call_args
            assert call.kwargs["json"]["progress_pct"] == pipeline.STEP_PROGRESS["vocal_rvc"]
            assert call.kwargs["json"]["current_step_label"] == pipeline.STEP_LABEL["vocal_rvc"]


class TestOrchestratorAuth:
    def test_start_rejects_wrong_secret(self):
        client = TestClient(app)
        r = client.post(
            "/orchestrator/start",
            json={"job_id": "j1"},
            headers={"X-Orchestrator-Secret": "wrong"},
        )
        assert r.status_code == 401

    def test_start_rejects_missing_secret(self):
        client = TestClient(app)
        r = client.post("/orchestrator/start", json={"job_id": "j1"})
        assert r.status_code == 401


class TestOrchestratorFlow:
    def test_start_pending_job_transitions_to_vocal_separating(self):
        """pending job을 받으면 vocal_separating으로 전이 + Demucs dispatch 시도."""
        fake_job = {
            "id": "j1", "status": "pending", "user_id": "u1",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
            "raw_recording_path": "raw-audio/u1/j1/raw.webm",
            "voice_identity_id": None,
        }
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.studio_pipeline.transition") as mock_t, \
             patch("routers.orchestrator._signed_url", return_value="https://signed.example/r.webm"), \
             patch("services.modal_dispatcher.dispatch_demucs") as mock_demucs:
            mock_t.return_value = pipeline.TransitionResult(
                job_id="j1", from_status="pending",
                to_status="vocal_separating", applied=True,
            )
            client = TestClient(app)
            r = client.post(
                "/orchestrator/start",
                json={"job_id": "j1"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["status"] == "vocal_separating"
        mock_t.assert_called_once()
        mock_demucs.assert_called_once_with("j1", "https://signed.example/r.webm", "u1/j1")

    def test_start_already_running_is_idempotent(self):
        """이미 진행 중인 job에 start 호출해도 에러 없이 현재 상태 반환."""
        fake_job = {"id": "j1", "status": "scene_image_gen", "user_id": "u1",
                     "cost_credits": 5, "attempt_count": 0, "max_attempts": 3}
        with patch("services.studio_pipeline.get_job", return_value=fake_job):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/start",
                json={"job_id": "j1"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["status"] == "scene_image_gen"

    def test_modal_callback_success_advances_step(self):
        from routers.orchestrator import _next_step
        assert _next_step("vocal_separating") == "vocal_rvc"
        assert _next_step("vocal_rvc") == "vocal_mixing"
        assert _next_step("completed") is None
        assert _next_step("unknown") is None


class TestResultMapping:
    def test_vocal_separating_maps_paths(self):
        from routers.orchestrator import _result_to_fields
        fields = _result_to_fields("vocal_separating", {
            "vocals_path": "bucket/v.wav",
            "instrumental_path": "bucket/i.wav",
        })
        assert fields == {
            "vocals_path": "bucket/v.wav",
            "instrumental_path": "bucket/i.wav",
        }

    def test_unknown_step_returns_empty(self):
        from routers.orchestrator import _result_to_fields
        assert _result_to_fields("nonexistent", {"x": 1}) == {}

    def test_none_values_filtered(self):
        from routers.orchestrator import _result_to_fields
        fields = _result_to_fields("vocal_rvc", {"converted_vocals_path": None})
        assert "converted_vocals_path" not in fields


class TestScenePlanningDispatch:
    """_dispatch_step("scene_planning")이 scene_dispatcher.run_scene_pipeline을 호출하고
    lipsync 전이가 감지되면 자동으로 다음 dispatch를 호출하는지 검증.

    주의: _dispatch_step은 재귀로 자기 자신을 부르므로, 모듈 속성을 직접 치환해
    재귀 호출만 가로챈다 (patch context manager는 원본 호출도 덮어써서 못 씀).
    """

    def _run_with_recursion_spy(self, module_fn, arg_job_id, arg_step):
        """원본 함수를 호출하되, 모듈 내 재귀 호출은 spy로 가로챈다."""
        import routers.orchestrator as orch
        calls = []
        orig = orch._dispatch_step
        orch._dispatch_step = lambda j, s: calls.append((j, s))
        try:
            orig(arg_job_id, arg_step)
        finally:
            orch._dispatch_step = orig
        return calls

    def test_scene_planning_invokes_run_pipeline_with_style_and_duration(self):
        fake_job_before = {
            "id": "j1", "status": "scene_planning", "user_id": "u1",
            "style_preset": "cinematic",
            "final_vocal_mix_path": "studio-recording/u1/j1/final.wav",
        }
        fake_job_after = {**fake_job_before, "status": "lipsync"}
        run_calls = []

        with patch("services.studio_pipeline.get_job",
                   side_effect=[fake_job_before, fake_job_after]), \
             patch("routers.orchestrator._signed_url", return_value="https://signed"), \
             patch("routers.orchestrator._probe_duration", return_value=93.5), \
             patch("services.scene_dispatcher.run_scene_pipeline",
                   side_effect=lambda job_id, style_preset, duration_sec, tier="pro":
                       run_calls.append((job_id, style_preset, duration_sec, tier))):
            recursion = self._run_with_recursion_spy(None, "j1", "scene_planning")

        assert run_calls == [("j1", "cinematic", 93.5, "pro")]
        # 상태가 lipsync로 바뀌었으므로 후속 dispatch_step("lipsync") 호출 (재귀)
        assert ("j1", "lipsync") in recursion

    def test_scene_planning_skips_next_dispatch_if_not_lipsync(self):
        """run_scene_pipeline이 실패해 lipsync 전이 안 되면 후속 dispatch 없음."""
        fake_job = {
            "id": "j1", "status": "scene_planning", "user_id": "u1",
            "style_preset": "cozy",
            "final_vocal_mix_path": "studio-recording/u1/j1/final.wav",
        }
        after_fail = {**fake_job, "status": "failed"}

        with patch("services.studio_pipeline.get_job",
                   side_effect=[fake_job, after_fail]), \
             patch("routers.orchestrator._signed_url", return_value="https://signed"), \
             patch("routers.orchestrator._probe_duration", return_value=60.0), \
             patch("services.scene_dispatcher.run_scene_pipeline"):
            recursion = self._run_with_recursion_spy(None, "j1", "scene_planning")

        assert recursion == []


class TestLipsyncDispatch:
    """Phase 0에서 lipsync 단계는 실제 LatentSync 생략 → composing으로 즉시 전이."""

    def test_lipsync_transitions_to_composing_and_dispatches(self):
        fake_job = {
            "id": "j1", "status": "lipsync", "user_id": "u1",
            "style_preset": "cinematic",
        }
        transitions = []

        def fake_transition(job_id, expected_status, next_status, fields=None):
            transitions.append((job_id, expected_status, next_status))
            return pipeline.TransitionResult(
                job_id=job_id, from_status=expected_status,
                to_status=next_status, applied=True,
            )

        import routers.orchestrator as orch
        recursion = []
        orig = orch._dispatch_step
        orch._dispatch_step = lambda j, s: recursion.append((j, s))
        try:
            with patch("services.studio_pipeline.get_job", return_value=fake_job), \
                 patch("services.studio_pipeline.transition", side_effect=fake_transition):
                orig("j1", "lipsync")
        finally:
            orch._dispatch_step = orig

        assert ("j1", "lipsync", "composing") in transitions
        assert ("j1", "composing") in recursion


class TestProbeDuration:
    def test_probe_duration_returns_float_on_success(self):
        from routers.orchestrator import _probe_duration
        fake_completed = MagicMock()
        fake_completed.stdout = "120.5\n"
        with patch("subprocess.run", return_value=fake_completed):
            assert _probe_duration("https://x.mp4") == 120.5

    def test_probe_duration_clamps_to_minimum_10s(self):
        from routers.orchestrator import _probe_duration
        fake_completed = MagicMock()
        fake_completed.stdout = "3.1\n"  # 너무 짧음
        with patch("subprocess.run", return_value=fake_completed):
            assert _probe_duration("https://x.mp4") == 10.0

    def test_probe_duration_falls_back_on_error(self):
        from routers.orchestrator import _probe_duration
        with patch("subprocess.run", side_effect=OSError("ffprobe not found")):
            assert _probe_duration("https://x.mp4") == 60.0

    def test_probe_duration_falls_back_on_empty_output(self):
        from routers.orchestrator import _probe_duration
        fake_completed = MagicMock()
        fake_completed.stdout = ""
        with patch("subprocess.run", return_value=fake_completed):
            assert _probe_duration("https://x.mp4") == 60.0


class TestStage3ModerationGate:
    """watermarking 완료 콜백 시 Stage 3 모더레이션 훅 동작 검증."""

    def _clean_job(self) -> dict:
        return {
            "id": "j1", "status": "watermarking", "user_id": "u1",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
            "landscape_url": "https://storage/out.mp4",
            "scene_plan": {
                "scenes": [
                    {"id": "s1", "prompt": "cinematic sunset", "duration_sec": 60},
                    {"id": "s2", "prompt": "cozy morning", "duration_sec": 60},
                    {"id": "s3", "prompt": "soft light", "duration_sec": 60},
                ],
            },
        }

    def _banned_job(self) -> dict:
        j = self._clean_job()
        j["scene_plan"]["scenes"][1]["prompt"] = "어린이 미성년 장면"
        return j

    def test_clean_output_advances_to_finalizing(self):
        fake_job = self._clean_job()
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.moderation.log_events") as mock_log, \
             patch("services.studio_pipeline.mark_failed") as mock_fail, \
             patch("services.studio_pipeline.transition") as mock_t, \
             patch("routers.orchestrator._dispatch_step"):  # BackgroundTask 실행 차단
            mock_t.return_value = pipeline.TransitionResult(
                job_id="j1", from_status="watermarking",
                to_status="finalizing", applied=True,
            )
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "watermarking", "status": "success",
                    "result": {"c2pa_signed": True},
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "finalizing"
        mock_fail.assert_not_called()
        # 깨끗한 경우에도 로깅 호출은 발생(0 events)
        assert mock_log.call_count == 1

    def test_banned_scene_prompt_marks_failed(self):
        fake_job = self._banned_job()
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.moderation.log_events") as mock_log, \
             patch("services.studio_pipeline.mark_failed") as mock_fail, \
             patch("services.studio_pipeline.transition") as mock_t:
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "watermarking", "status": "success",
                    "result": {},
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "failed"
        mock_fail.assert_called_once()
        args, kwargs = mock_fail.call_args
        assert args[0] == "j1"
        assert kwargs.get("failed_step") == "watermarking"
        assert "moderation" in kwargs.get("error", "").lower()
        # transition은 호출되지 않아야 함 (블록됐으므로)
        mock_t.assert_not_called()
        # 로깅은 1회 (위반 이벤트 포함)
        assert mock_log.call_count == 1

    def test_missing_output_url_marks_failed(self):
        fake_job = self._clean_job()
        fake_job["landscape_url"] = None
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.moderation.log_events"), \
             patch("services.studio_pipeline.mark_failed") as mock_fail, \
             patch("services.studio_pipeline.transition"):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "watermarking", "status": "success",
                    "result": {},
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "failed"
        mock_fail.assert_called_once()

    def test_non_watermarking_step_bypasses_gate(self):
        """Stage 3 훅은 watermarking 단계에서만 동작, 다른 단계는 건드리지 않음."""
        fake_job = {
            "id": "j1", "status": "vocal_separating", "user_id": "u1",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
        }
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.moderation.log_events") as mock_log, \
             patch("services.studio_pipeline.transition") as mock_t, \
             patch("routers.orchestrator._dispatch_step"):
            mock_t.return_value = pipeline.TransitionResult(
                job_id="j1", from_status="vocal_separating",
                to_status="vocal_rvc", applied=True,
            )
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "vocal_separating", "status": "success",
                    "result": {"vocals_path": "v", "instrumental_path": "i"},
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "vocal_rvc"
        # 다른 단계에선 모더레이션 로깅 호출되지 않음
        mock_log.assert_not_called()


class TestVocalMixingDispatch:
    """_dispatch_step("vocal_mixing") → dispatch_mix 호출 검증."""

    def test_dispatches_mix_when_both_inputs_present(self):
        fake_job = {
            "id": "j1", "status": "vocal_mixing", "user_id": "u1",
            "converted_vocals_path": "studio-recording/u1/j1/vocals.wav",
            "instrumental_path": "studio-recording/u1/j1/instrumental.wav",
        }
        mix_calls = []
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("routers.orchestrator._signed_url",
                   side_effect=lambda p, ttl_sec=3600: f"https://signed/{p}"), \
             patch("services.modal_dispatcher.dispatch_mix",
                   side_effect=lambda *a, **kw: mix_calls.append(a)):
            from routers.orchestrator import _dispatch_step
            _dispatch_step("j1", "vocal_mixing")

        assert len(mix_calls) == 1
        job_id, vocals_url, instrumental_url, output_prefix = mix_calls[0]
        assert job_id == "j1"
        assert "vocals.wav" in vocals_url
        assert "instrumental.wav" in instrumental_url
        assert output_prefix == "u1/j1"

    def test_marks_failed_when_vocals_missing(self):
        fake_job = {
            "id": "j1", "status": "vocal_mixing", "user_id": "u1",
            "converted_vocals_path": "",
            "instrumental_path": "studio-recording/u1/j1/instrumental.wav",
        }
        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("routers.orchestrator._signed_url", return_value=None), \
             patch("services.studio_pipeline.mark_failed") as mock_fail:
            from routers.orchestrator import _dispatch_step
            _dispatch_step("j1", "vocal_mixing")

        mock_fail.assert_called_once()
        args = mock_fail.call_args[0]
        assert args[0] == "j1"
        assert "vocal_mixing" in args[1]

    def test_marks_failed_when_instrumental_missing(self):
        fake_job = {
            "id": "j1", "status": "vocal_mixing", "user_id": "u1",
            "converted_vocals_path": "studio-recording/u1/j1/vocals.wav",
            "instrumental_path": "",
        }
        signed_calls = []

        def fake_signed(path, ttl_sec=3600):
            if path:
                signed_calls.append(path)
                return f"https://signed/{path}"
            return None

        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("routers.orchestrator._signed_url", side_effect=fake_signed), \
             patch("services.studio_pipeline.mark_failed") as mock_fail:
            from routers.orchestrator import _dispatch_step
            _dispatch_step("j1", "vocal_mixing")

        mock_fail.assert_called_once()


class TestFormattingAndWatermarkingAutoTransition:
    """formatting/watermarking은 auto-transition (Modal 콜백 없이 즉시 전이)."""

    def test_formatting_transitions_to_watermarking_and_dispatches(self):
        fake_job = {
            "id": "j1", "status": "formatting", "user_id": "u1",
            "landscape_url": "mv-output/u1/j1/landscape.mp4",
            "scene_plan": {"scenes": []},
        }
        transitions = []

        def fake_transition(job_id, expected_status, next_status, fields=None):
            transitions.append((job_id, expected_status, next_status))
            return pipeline.TransitionResult(
                job_id=job_id, from_status=expected_status,
                to_status=next_status, applied=True,
            )

        import routers.orchestrator as orch
        recursion = []
        orig = orch._dispatch_step
        orch._dispatch_step = lambda j, s: recursion.append((j, s))
        try:
            with patch("services.studio_pipeline.get_job", return_value=fake_job), \
                 patch("services.studio_pipeline.transition", side_effect=fake_transition):
                orig("j1", "formatting")
        finally:
            orch._dispatch_step = orig

        assert ("j1", "formatting", "watermarking") in transitions
        assert ("j1", "watermarking") in recursion

    def test_watermarking_clean_transitions_to_finalizing_and_dispatches(self):
        fake_job = {
            "id": "j1", "status": "watermarking", "user_id": "u1",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
            "landscape_url": "https://storage/out.mp4",
            "scene_plan": {"scenes": [{"prompt": "safe scene", "duration_sec": 30}]},
        }
        transitions = []

        def fake_transition(job_id, expected_status, next_status, fields=None):
            transitions.append((job_id, expected_status, next_status))
            return pipeline.TransitionResult(
                job_id=job_id, from_status=expected_status,
                to_status=next_status, applied=True,
            )

        import routers.orchestrator as orch
        recursion = []
        orig = orch._dispatch_step
        orch._dispatch_step = lambda j, s: recursion.append((j, s))
        try:
            with patch("services.studio_pipeline.get_job", return_value=fake_job), \
                 patch("services.studio_pipeline.transition", side_effect=fake_transition), \
                 patch("services.moderation.log_events"):
                orig("j1", "watermarking")
        finally:
            orch._dispatch_step = orig

        assert ("j1", "watermarking", "finalizing") in transitions
        assert ("j1", "finalizing") in recursion

    def test_watermarking_banned_marks_failed_and_stops(self):
        fake_job = {
            "id": "j1", "status": "watermarking", "user_id": "u1",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
            "landscape_url": "https://storage/out.mp4",
            "scene_plan": {"scenes": [{"prompt": "어린이 미성년 장면", "duration_sec": 30}]},
        }

        import routers.orchestrator as orch
        recursion = []
        orig = orch._dispatch_step
        orch._dispatch_step = lambda j, s: recursion.append((j, s))
        try:
            with patch("services.studio_pipeline.get_job", return_value=fake_job), \
                 patch("services.studio_pipeline.mark_failed") as mock_fail, \
                 patch("services.studio_pipeline.transition") as mock_t, \
                 patch("services.moderation.log_events"):
                orig("j1", "watermarking")
        finally:
            orch._dispatch_step = orig

        mock_fail.assert_called_once()
        mock_t.assert_not_called()
        assert recursion == []


class TestFinalizingJob:
    """_finalize_job: covers 레코드 insert + completed 전이."""

    def _full_job(self) -> dict:
        return {
            "id": "j1", "status": "finalizing", "user_id": "u1",
            "landscape_url": "mv-output/u1/j1/landscape.mp4",
            "portrait_url": "mv-output/u1/j1/portrait.mp4",
            "thumbnail_url": "mv-output/u1/j1/thumb.jpg",
            "duration_sec": 45.0,
            "title": "My Cover",
            "cost_credits": 5, "attempt_count": 0, "max_attempts": 3,
        }

    def test_inserts_covers_and_transitions_to_completed(self):
        fake_job = self._full_job()
        transitions = []
        cover_posts = []

        def fake_transition(job_id, expected_status, next_status, fields=None):
            transitions.append((job_id, expected_status, next_status))
            return pipeline.TransitionResult(
                job_id=job_id, from_status=expected_status,
                to_status=next_status, applied=True,
            )

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"id": "cover-1"}]
        mock_resp.text = ""

        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.studio_pipeline.transition", side_effect=fake_transition), \
             patch("httpx.Client") as MockClient:
            client_inst = MockClient.return_value.__enter__.return_value
            client_inst.post.return_value = mock_resp

            from routers.orchestrator import _finalize_job
            _finalize_job("j1")

        assert ("j1", "finalizing", "completed") in transitions
        client_inst.post.assert_called_once()
        call_kwargs = client_inst.post.call_args
        body = call_kwargs[1]["json"] if "json" in call_kwargs[1] else call_kwargs.kwargs["json"]
        assert body["user_id"] == "u1"
        assert body["landscape_url"] == fake_job["landscape_url"]
        assert body["duration_sec"] == 45.0

    def test_marks_failed_when_landscape_url_missing(self):
        fake_job = self._full_job()
        fake_job["landscape_url"] = None

        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.studio_pipeline.mark_failed") as mock_fail:
            from routers.orchestrator import _finalize_job
            _finalize_job("j1")

        mock_fail.assert_called_once()
        assert "j1" in mock_fail.call_args[0]

    def test_marks_failed_when_covers_insert_fails(self):
        fake_job = self._full_job()

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 409
        mock_resp.text = "duplicate key"

        with patch("services.studio_pipeline.get_job", return_value=fake_job), \
             patch("services.studio_pipeline.mark_failed") as mock_fail, \
             patch("httpx.Client") as MockClient:
            client_inst = MockClient.return_value.__enter__.return_value
            client_inst.post.return_value = mock_resp

            from routers.orchestrator import _finalize_job
            _finalize_job("j1")

        mock_fail.assert_called_once()
        assert "covers insert" in mock_fail.call_args[0][2]


class TestResultMappingComposing:
    """_result_to_fields("composing") 이 landscape+portrait+thumbnail+c2pa 모두 저장."""

    def test_composing_maps_all_fields(self):
        from routers.orchestrator import _result_to_fields
        result = {
            "landscape_path": "mv-output/u1/j1/landscape.mp4",
            "portrait_path": "mv-output/u1/j1/portrait.mp4",
            "thumbnail_path": "mv-output/u1/j1/thumb.jpg",
            "c2pa_signed": True,
        }
        fields = _result_to_fields("composing", result)
        assert fields["landscape_url"] == "mv-output/u1/j1/landscape.mp4"
        assert fields["portrait_url"] == "mv-output/u1/j1/portrait.mp4"
        assert fields["thumbnail_url"] == "mv-output/u1/j1/thumb.jpg"
        assert fields["c2pa_signed"] is True

    def test_composing_filters_none_values(self):
        from routers.orchestrator import _result_to_fields
        fields = _result_to_fields("composing", {
            "landscape_path": "mv-output/u1/j1/landscape.mp4",
            "portrait_path": None,
            "thumbnail_path": None,
        })
        assert "landscape_url" in fields
        assert "portrait_url" not in fields
        assert "thumbnail_url" not in fields
