"""Orchestrator 라우터 + application/studio 유스케이스 테스트.

구조:
  - HTTP 어댑터 (FastAPI TestClient) — 인증/파싱/응답 직렬화
  - application.studio 유스케이스 — lifecycle / modal_callback / runware_callback
  - core.studio — STEP_ORDER/상태 전이 순수 검증
"""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app
from core.studio.status import STEP_LABEL, STEP_ORDER, STEP_PROGRESS, next_status
from core.studio import state_machine
from domain_types.studio import (
    ACTIVE_STATUSES,
    CANCELLABLE_STATUSES,
    TERMINAL_STATUSES,
    StudioJob,
)
from application.studio import lifecycle as studio_lifecycle
from application.studio import modal_callback, transitions


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


def _studio_job(**overrides) -> StudioJob:
    row = {
        "id": "j1",
        "user_id": "u1",
        "status": "pending",
        "cost_credits": 5,
        "attempt_count": 0,
        "max_attempts": 3,
        "style_preset": "cinematic",
        "quality_tier": "pro",
        "avatar_mode": "faceless",
    }
    row.update(overrides)
    return StudioJob.from_row(row)


# ============================================================
# Core — STEP_ORDER, 상태 전이 규칙
# ============================================================

class TestStepOrder:
    def test_first_step_is_pending(self):
        assert STEP_ORDER[0] == "pending"

    def test_last_happy_step_is_completed(self):
        assert STEP_ORDER[-1] == "completed"

    def test_all_steps_have_progress(self):
        for step in STEP_ORDER:
            assert step in STEP_PROGRESS
            assert 0 <= STEP_PROGRESS[step] <= 100

    def test_all_steps_have_label(self):
        for step in STEP_ORDER:
            assert step in STEP_LABEL
            assert len(STEP_LABEL[step]) > 0

    def test_next_status_happy_path(self):
        assert next_status("pending") == "vocal_separating"
        assert next_status("vocal_separating") == "vocal_rvc"
        assert next_status("vocal_rvc") == "vocal_mixing"
        assert next_status("completed") is None
        assert next_status("unknown") is None

    def test_retry_exhausted(self):
        assert state_machine.is_retry_exhausted(3, 3) is True
        assert state_machine.is_retry_exhausted(2, 3) is False
        assert state_machine.is_retry_exhausted(5, 3) is True


# ============================================================
# Application — transitions.advance (progress/label 주입)
# ============================================================

class TestTransitionAdvance:
    def test_success_marks_applied_true(self):
        with patch("infra.supabase.gateway.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(
                200, [{"id": "j1", "status": "vocal_separating"}],
            )
            outcome = transitions.advance("j1", "pending", "vocal_separating")
        assert outcome.applied is True
        assert outcome.to_status == "vocal_separating"

    def test_stale_state_marks_applied_false(self):
        with patch("infra.supabase.gateway.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(200, [])
            outcome = transitions.advance("j1", "pending", "vocal_separating")
        assert outcome.applied is False

    def test_progress_and_label_injected(self):
        with patch("infra.supabase.gateway.httpx.Client") as MockClient:
            client = MockClient.return_value.__enter__.return_value
            client.patch.return_value = _mock_resp(200, [{"id": "j1"}])
            transitions.advance("j1", "pending", "vocal_rvc")
            sent = client.patch.call_args.kwargs["json"]
        assert sent["progress_pct"] == STEP_PROGRESS["vocal_rvc"]
        assert sent["current_step_label"] == STEP_LABEL["vocal_rvc"]


# ============================================================
# Application — modal_callback 결과 → DB 필드 매핑
# ============================================================

class TestResultMapping:
    def test_vocal_separating_maps_paths(self):
        fields = modal_callback._result_to_fields("vocal_separating", {
            "vocals_path": "bucket/v.wav",
            "instrumental_path": "bucket/i.wav",
        })
        assert fields == {
            "vocals_path": "bucket/v.wav",
            "instrumental_path": "bucket/i.wav",
        }

    def test_unknown_step_returns_empty(self):
        assert modal_callback._result_to_fields("nonexistent", {"x": 1}) == {}  # type: ignore[arg-type]

    def test_none_values_filtered(self):
        fields = modal_callback._result_to_fields("vocal_rvc", {"converted_vocals_path": None})
        assert "converted_vocals_path" not in fields

    def test_composing_maps_all_fields(self):
        result = {
            "landscape_path": "mv-output/u1/j1/landscape.mp4",
            "portrait_path": "mv-output/u1/j1/portrait.mp4",
            "thumbnail_path": "mv-output/u1/j1/thumb.jpg",
            "c2pa_signed": True,
        }
        fields = modal_callback._result_to_fields("composing", result)
        assert fields["landscape_url"] == "mv-output/u1/j1/landscape.mp4"
        assert fields["portrait_url"] == "mv-output/u1/j1/portrait.mp4"
        assert fields["thumbnail_url"] == "mv-output/u1/j1/thumb.jpg"
        assert fields["c2pa_signed"] is True

    def test_composing_filters_none_values(self):
        fields = modal_callback._result_to_fields("composing", {
            "landscape_path": "mv-output/u1/j1/landscape.mp4",
            "portrait_path": None,
            "thumbnail_path": None,
        })
        assert "landscape_url" in fields
        assert "portrait_url" not in fields
        assert "thumbnail_url" not in fields


# ============================================================
# HTTP 어댑터 — 인증
# ============================================================

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


# ============================================================
# HTTP 어댑터 — /start
# ============================================================

class TestStartEndpoint:
    def test_start_pending_job_transitions_to_vocal_separating(self):
        job = _studio_job(status="pending")
        with patch("application.studio.start.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.start.transitions.advance") as mock_advance, \
             patch("application.studio.start.dispatch.dispatch_step"):
            mock_advance.return_value = transitions.TransitionOutcome(
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
        body = r.json()
        assert body["accepted"] is True
        assert body["status"] == "vocal_separating"

    def test_start_already_running_is_idempotent(self):
        job = _studio_job(status="scene_image_gen")
        with patch("application.studio.start.studio_jobs_repo.get", return_value=job):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/start",
                json={"job_id": "j1"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["status"] == "scene_image_gen"

    def test_start_not_found_returns_404(self):
        from infra.supabase.studio_jobs_repo import JobNotFound
        with patch(
            "application.studio.start.studio_jobs_repo.get",
            side_effect=JobNotFound("j-x"),
        ):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/start",
                json={"job_id": "j-x"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 404


# ============================================================
# HTTP 어댑터 — /callback/modal
# ============================================================

class TestModalCallbackEndpoint:
    def test_success_non_watermarking_advances(self):
        job = _studio_job(status="vocal_separating")
        with patch("application.studio.modal_callback.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.modal_callback.transitions.advance") as mock_advance, \
             patch("application.studio.modal_callback.dispatch.dispatch_step") as mock_disp:
            mock_advance.return_value = transitions.TransitionOutcome(
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
        mock_disp.assert_called_once_with("j1", "vocal_rvc")

    def test_failure_not_exhausted_retries(self):
        job = _studio_job(attempt_count=0, max_attempts=3)
        with patch(
            "application.studio.modal_callback.studio_jobs_repo.increment_attempt",
            return_value=1,
        ), patch(
            "application.studio.modal_callback.studio_jobs_repo.get",
            return_value=job,
        ), patch(
            "application.studio.modal_callback.dispatch.redispatch_step",
        ) as mock_redisp:
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "vocal_separating", "status": "failed",
                    "result": {}, "error": "boom",
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "vocal_separating"
        mock_redisp.assert_called_once_with("j1", "vocal_separating")

    def test_failure_exhausted_marks_failed(self):
        job = _studio_job(attempt_count=2, max_attempts=3)
        with patch(
            "application.studio.modal_callback.studio_jobs_repo.increment_attempt",
            return_value=3,
        ), patch(
            "application.studio.modal_callback.studio_jobs_repo.get",
            return_value=job,
        ), patch(
            "application.studio.modal_callback.lifecycle.mark_failed",
        ) as mock_fail:
            client = TestClient(app)
            r = client.post(
                "/orchestrator/callback/modal",
                json={
                    "job_id": "j1", "step": "vocal_separating", "status": "failed",
                    "result": {}, "error": "permanent",
                },
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["next_step"] == "failed"
        mock_fail.assert_called_once()


# ============================================================
# Stage 3 moderation gate — watermarking 콜백
# ============================================================

class TestStage3ModerationGate:
    def _clean_job(self) -> StudioJob:
        return _studio_job(
            status="watermarking",
            landscape_url="https://storage/out.mp4",
            scene_plan={
                "scenes": [
                    {"id": "s1", "prompt": "cinematic sunset", "duration_sec": 60},
                    {"id": "s2", "prompt": "cozy morning", "duration_sec": 60},
                    {"id": "s3", "prompt": "soft light", "duration_sec": 60},
                ],
            },
        )

    def _banned_job(self) -> StudioJob:
        return _studio_job(
            status="watermarking",
            landscape_url="https://storage/out.mp4",
            scene_plan={
                "scenes": [
                    {"id": "s1", "prompt": "cinematic sunset", "duration_sec": 60},
                    {"id": "s2", "prompt": "어린이 미성년 장면", "duration_sec": 60},
                ],
            },
        )

    def test_clean_output_advances_to_finalizing(self):
        job = self._clean_job()
        with patch("application.studio.cover_gate.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.cover_gate.moderation_repo.log_events") as mock_log, \
             patch("application.studio.cover_gate.lifecycle.mark_failed") as mock_fail, \
             patch("application.studio.modal_callback.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.modal_callback.transitions.advance") as mock_t, \
             patch("application.studio.modal_callback.dispatch.dispatch_step"):
            mock_t.return_value = transitions.TransitionOutcome(
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
        assert mock_log.call_count == 1

    def test_banned_scene_prompt_marks_failed(self):
        job = self._banned_job()
        with patch("application.studio.cover_gate.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.cover_gate.moderation_repo.log_events") as mock_log, \
             patch("application.studio.cover_gate.lifecycle.mark_failed") as mock_fail:
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
        assert mock_log.call_count == 1

    def test_non_watermarking_step_bypasses_gate(self):
        job = _studio_job(status="vocal_separating")
        with patch("application.studio.modal_callback.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.cover_gate.moderation_repo.log_events") as mock_log, \
             patch("application.studio.modal_callback.transitions.advance") as mock_t, \
             patch("application.studio.modal_callback.dispatch.dispatch_step"):
            mock_t.return_value = transitions.TransitionOutcome(
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
        mock_log.assert_not_called()


# ============================================================
# Application — lifecycle (cancel / force_fail)
# ============================================================

class TestCancelByUser:
    def test_cancellable_statuses_cover_pre_gpu_stages(self):
        assert "pending" in CANCELLABLE_STATUSES
        assert "vocal_separating" in CANCELLABLE_STATUSES
        assert "vocal_rvc" in CANCELLABLE_STATUSES
        assert "vocal_mixing" in CANCELLABLE_STATUSES
        assert "scene_planning" in CANCELLABLE_STATUSES
        assert "scene_image_gen" not in CANCELLABLE_STATUSES
        assert "scene_video_gen" not in CANCELLABLE_STATUSES
        assert "lipsync" not in CANCELLABLE_STATUSES

    def test_cancel_pending_job_marks_failed_and_refunds(self):
        job = _studio_job(status="pending")
        with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.lifecycle.mark_failed") as mock_fail:
            result = studio_lifecycle.cancel_by_user("j1", "u1")
        mock_fail.assert_called_once()
        assert mock_fail.call_args.kwargs.get("failed_step") == "cancelled_by_user"
        assert result["previous_status"] == "pending"
        assert result["status"] == "refunded"

    def test_cancel_wrong_user_raises_forbidden(self):
        job = _studio_job(status="pending", user_id="u1")
        with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job):
            with pytest.raises(studio_lifecycle.PipelineError) as exc:
                studio_lifecycle.cancel_by_user("j1", "someone-else")
        assert exc.value.code == "FORBIDDEN"

    def test_cancel_post_gpu_stage_raises_not_cancellable(self):
        job = _studio_job(status="scene_image_gen")
        with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job):
            with pytest.raises(studio_lifecycle.PipelineError) as exc:
                studio_lifecycle.cancel_by_user("j1", "u1")
        assert exc.value.code == "NOT_CANCELLABLE"

    def test_cancel_terminal_status_raises_not_cancellable(self):
        for terminal in ("completed", "failed", "refunded"):
            job = _studio_job(status=terminal)
            with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job):
                with pytest.raises(studio_lifecycle.PipelineError) as exc:
                    studio_lifecycle.cancel_by_user("j1", "u1")
            assert exc.value.code == "NOT_CANCELLABLE"


class TestForceFailByAdmin:
    def test_force_fail_calls_mark_failed_with_admin_prefix(self):
        job = _studio_job(status="scene_video_gen", cost_credits=15)
        with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job), \
             patch("application.studio.lifecycle.mark_failed") as mock_fail:
            result = studio_lifecycle.force_fail_by_admin("j1", "Modal 콜백 유실")
        mock_fail.assert_called_once()
        assert "force_failed_by_admin" in mock_fail.call_args.kwargs["failed_step"]
        assert "scene_video_gen" in mock_fail.call_args.kwargs["failed_step"]
        assert "Modal 콜백 유실" in mock_fail.call_args.kwargs["error"]
        assert result["previous_status"] == "scene_video_gen"
        assert result["status"] == "refunded"

    def test_force_fail_on_terminal_raises_already_terminal(self):
        for terminal in ("completed", "failed", "refunded"):
            job = _studio_job(status=terminal)
            with patch("application.studio.lifecycle.studio_jobs_repo.get", return_value=job):
                with pytest.raises(studio_lifecycle.PipelineError) as exc:
                    studio_lifecycle.force_fail_by_admin("j1", "재처리")
            assert exc.value.code == "ALREADY_TERMINAL"


# ============================================================
# HTTP 어댑터 — /cancel
# ============================================================

class TestOrchestratorCancelEndpoint:
    def test_rejects_wrong_secret(self):
        client = TestClient(app)
        r = client.post(
            "/orchestrator/cancel",
            json={"job_id": "j1", "user_id": "u1"},
            headers={"X-Orchestrator-Secret": "wrong"},
        )
        assert r.status_code == 401

    def test_success_returns_refunded_status(self):
        with patch("application.studio.lifecycle.cancel_by_user") as mock_cancel:
            mock_cancel.return_value = {
                "job_id": "j1", "previous_status": "vocal_separating", "status": "refunded",
            }
            client = TestClient(app)
            r = client.post(
                "/orchestrator/cancel",
                json={"job_id": "j1", "user_id": "u1"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["status"] == "refunded"
        assert body["previous_status"] == "vocal_separating"

    def test_not_cancellable_returns_409(self):
        with patch(
            "application.studio.lifecycle.cancel_by_user",
            side_effect=studio_lifecycle.PipelineError(
                "cancel 불가", code="NOT_CANCELLABLE",
            ),
        ):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/cancel",
                json={"job_id": "j1", "user_id": "u1"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 409
        assert r.json()["detail"]["code"] == "NOT_CANCELLABLE"

    def test_wrong_owner_returns_403(self):
        with patch(
            "application.studio.lifecycle.cancel_by_user",
            side_effect=studio_lifecycle.PipelineError(
                "본인 작업이 아닙니다", code="FORBIDDEN",
            ),
        ):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/cancel",
                json={"job_id": "j1", "user_id": "bad"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "FORBIDDEN"


# ============================================================
# HTTP 어댑터 — /admin/stuck-jobs, /admin/force-fail
# ============================================================

class TestActiveStatuses:
    def test_active_statuses_exclude_terminals(self):
        assert "pending" in ACTIVE_STATUSES
        assert "scene_image_gen" in ACTIVE_STATUSES
        assert TERMINAL_STATUSES.isdisjoint(ACTIVE_STATUSES)


class TestOrchestratorAdminEndpoints:
    def test_stuck_jobs_rejects_wrong_secret(self):
        client = TestClient(app)
        r = client.get(
            "/orchestrator/admin/stuck-jobs",
            headers={"X-Orchestrator-Secret": "wrong"},
        )
        assert r.status_code == 401

    def test_stuck_jobs_returns_list(self):
        with patch("infra.supabase.studio_jobs_repo.list_stuck") as mock_list:
            mock_list.return_value = [{
                "id": "j1", "user_id": "u1", "status": "scene_image_gen",
                "cost_credits": 15, "attempt_count": 1, "last_error": None,
                "created_at": "2026-04-19T00:00:00Z",
                "updated_at": "2026-04-19T01:00:00Z",
            }]
            client = TestClient(app)
            r = client.get(
                "/orchestrator/admin/stuck-jobs?older_than_minutes=60",
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["count"] == 1
        assert body["older_than_minutes"] == 60
        mock_list.assert_called_once_with(60)

    def test_stuck_jobs_clamps_range(self):
        with patch("infra.supabase.studio_jobs_repo.list_stuck", return_value=[]) as mock_list:
            client = TestClient(app)
            r = client.get(
                "/orchestrator/admin/stuck-jobs?older_than_minutes=999999",
                headers={"X-Orchestrator-Secret": "shhh"},
            )
            assert r.status_code == 200
            mock_list.assert_called_once_with(1440)

    def test_force_fail_rejects_wrong_secret(self):
        client = TestClient(app)
        r = client.post(
            "/orchestrator/admin/force-fail",
            json={"job_id": "j1", "reason": "test"},
            headers={"X-Orchestrator-Secret": "wrong"},
        )
        assert r.status_code == 401

    def test_force_fail_requires_reason(self):
        client = TestClient(app)
        r = client.post(
            "/orchestrator/admin/force-fail",
            json={"job_id": "j1", "reason": "   "},
            headers={"X-Orchestrator-Secret": "shhh"},
        )
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "MISSING_REASON"

    def test_force_fail_success(self):
        with patch("application.studio.lifecycle.force_fail_by_admin") as mock_force:
            mock_force.return_value = {
                "job_id": "j1", "previous_status": "scene_video_gen", "status": "refunded",
            }
            client = TestClient(app)
            r = client.post(
                "/orchestrator/admin/force-fail",
                json={"job_id": "j1", "reason": "Modal 콜백 유실"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 200
        assert r.json()["status"] == "refunded"

    def test_force_fail_already_terminal_returns_409(self):
        with patch(
            "application.studio.lifecycle.force_fail_by_admin",
            side_effect=studio_lifecycle.PipelineError(
                "이미 종료됨", code="ALREADY_TERMINAL",
            ),
        ):
            client = TestClient(app)
            r = client.post(
                "/orchestrator/admin/force-fail",
                json={"job_id": "j1", "reason": "test"},
                headers={"X-Orchestrator-Secret": "shhh"},
            )
        assert r.status_code == 409
        assert r.json()["detail"]["code"] == "ALREADY_TERMINAL"
