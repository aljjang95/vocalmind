"""오디션 AI 채점 서비스 + 라우터 테스트."""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient

from main import app
from services.audition_scoring import (
    AuditionSubScores,
    blend_final_score,
    compute_ai_score,
    score_submission,
)


class TestComputeAiScore:
    def test_all_perfect_returns_100(self):
        subs = AuditionSubScores(tension_score=100, pitch_accuracy=100, rhythm_score=100)
        assert compute_ai_score(subs) == 100

    def test_all_zero_returns_0(self):
        subs = AuditionSubScores(tension_score=0, pitch_accuracy=0, rhythm_score=0)
        assert compute_ai_score(subs) == 0

    def test_pitch_weighted_40pct(self):
        """피치 100, 나머지 0 → 0.4 * 100 = 40"""
        subs = AuditionSubScores(tension_score=0, pitch_accuracy=100, rhythm_score=0)
        assert compute_ai_score(subs) == 40

    def test_no_rhythm_fallback_rebalance(self):
        """리듬 미지원 시 피치 57% + 긴장 43%."""
        subs = AuditionSubScores(tension_score=100, pitch_accuracy=100, rhythm_score=None)
        assert compute_ai_score(subs) == 100

        subs2 = AuditionSubScores(tension_score=0, pitch_accuracy=100, rhythm_score=None)
        assert compute_ai_score(subs2) == 57

    def test_clamps_out_of_range_inputs(self):
        """입력 범위 초과 → 자동 클램프."""
        subs = AuditionSubScores(tension_score=150, pitch_accuracy=-10, rhythm_score=200)
        result = compute_ai_score(subs)
        assert 0 <= result <= 100


class TestBlendFinalScore:
    def test_alpha_0_returns_vote(self):
        assert blend_final_score(ai_score=80, vote_score=50, alpha=0.0) == 50

    def test_alpha_1_returns_ai(self):
        assert blend_final_score(ai_score=80, vote_score=50, alpha=1.0) == 80

    def test_alpha_0_3_weighted(self):
        # 0.7 * 50 + 0.3 * 80 = 35 + 24 = 59
        assert blend_final_score(ai_score=80, vote_score=50, alpha=0.3) == 59

    def test_ai_none_returns_vote(self):
        """AI 채점 실패 → 투표만."""
        assert blend_final_score(ai_score=None, vote_score=70, alpha=0.5) == 70

    def test_alpha_clamped(self):
        assert blend_final_score(ai_score=100, vote_score=0, alpha=1.5) == 100
        assert blend_final_score(ai_score=100, vote_score=0, alpha=-0.5) == 0


class TestScoreSubmission:
    def test_tension_inversion(self):
        """tension_overall 높을수록 tension_score 낮아진다."""
        high = score_submission(tension_overall=80, pitch_accuracy=50, rhythm_score=50)
        low = score_submission(tension_overall=10, pitch_accuracy=50, rhythm_score=50)
        assert low.tension_score > high.tension_score

    def test_rhythm_none_status_partial(self):
        """리듬 점수 없음 → status = partial"""
        result = score_submission(
            tension_overall=30, pitch_accuracy=70, rhythm_score=None,
            vote_score=60, alpha=0.3,
        )
        assert result.status == "partial"
        assert result.rhythm_score is None

    def test_rhythm_present_status_complete(self):
        result = score_submission(
            tension_overall=30, pitch_accuracy=70, rhythm_score=80,
            vote_score=60, alpha=0.5,
        )
        assert result.status == "complete"

    def test_vote_and_alpha_propagated(self):
        result = score_submission(
            tension_overall=30, pitch_accuracy=70, rhythm_score=80,
            vote_score=45, alpha=0.4,
        )
        assert result.vote_score == 45
        assert result.alpha == 0.4

    def test_final_score_in_range(self):
        result = score_submission(
            tension_overall=40, pitch_accuracy=75, rhythm_score=85,
            vote_score=55, alpha=0.3,
        )
        assert 0 <= result.final_score <= 100


class TestAuditionScoreRouter:
    def test_post_score_returns_200(self):
        client = TestClient(app)
        resp = client.post(
            "/audition/score",
            json={
                "tension_overall": 30.0,
                "pitch_accuracy": 75,
                "rhythm_score": 80,
                "vote_score": 60,
                "alpha": 0.3,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "ai_score" in body
        assert "final_score" in body
        assert body["status"] == "complete"

    def test_missing_rhythm_returns_partial(self):
        client = TestClient(app)
        resp = client.post(
            "/audition/score",
            json={
                "tension_overall": 20.0,
                "pitch_accuracy": 80,
                "vote_score": 50,
                "alpha": 0.3,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "partial"
        assert body["rhythm_score"] is None

    def test_invalid_payload_returns_422(self):
        client = TestClient(app)
        resp = client.post("/audition/score", json={"invalid": "data"})
        assert resp.status_code == 422
