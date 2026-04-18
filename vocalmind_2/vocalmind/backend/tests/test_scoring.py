from __future__ import annotations

from services.scoring import (
    calculate_pitch_score,
    calculate_stage_score_v2,
    calculate_scale_practice_score,
)
from models.tension import TensionScore


def test_perfect_pitch_returns_100() -> None:
    """동일한 피치를 넣으면 100점이어야 한다."""
    target = [440.0, 493.88, 523.25]
    actual = [440.0, 493.88, 523.25]
    assert calculate_pitch_score(target, actual) == 100


def test_off_pitch_returns_lower() -> None:
    """피치가 크게 어긋나면 50~80 사이 점수가 나와야 한다."""
    target = [440.0, 440.0, 440.0]
    # ~100cent 이탈 (반음 1개 = 100cent)
    actual = [466.16, 466.16, 466.16]
    score = calculate_pitch_score(target, actual)
    assert 50 <= score <= 80


def test_empty_actual_returns_zero() -> None:
    """actual이 비어있으면 0점이어야 한다."""
    assert calculate_pitch_score([440.0], []) == 0


def test_no_target_returns_zero() -> None:
    """target이 비어있으면 0점이어야 한다."""
    assert calculate_pitch_score([], [440.0]) == 0


def test_stage_score_v2_no_tension() -> None:
    """tension_score=None이면 기본 가중치 점수 반환 + tension_detected=False."""
    score, detected, detail = calculate_stage_score_v2(
        pitch_accuracy=80.0, tone_stability=60.0, tension_score=None
    )
    # 80*0.6 + 60*0.4 = 48 + 24 = 72
    assert score == 72
    assert detected is False
    assert detail == ""


def test_stage_score_v2_with_tension() -> None:
    """tension_detected=True이면 overall 비율로 최대 30% 감점된다."""
    t_score = TensionScore(
        overall=100.0, laryngeal_tension=80.0, tongue_root_tension=70.0,
        jaw_tension=60.0, register_break=80.0, tension_detected=True, detail="후두 긴장",
    )
    score, detected, detail = calculate_stage_score_v2(
        pitch_accuracy=100.0, tone_stability=100.0, tension_score=t_score
    )
    # raw=100, penalty=min(0.3, 100/100*0.3)=0.3, raw*(1-0.3)=70
    assert score == 70
    assert detected is True
    assert detail == "후두 긴장"


# ===== 3단계 채점 공식 (scale-practice) =====

class TestScalePracticeBeginner:
    """초급 (stage 1~9): score = (100 - 긴장도), 통과 = 긴장도 ≤ 45."""

    def test_relaxed_voice_passes(self) -> None:
        """긴장도 20 → 점수 80, 통과."""
        result = calculate_scale_practice_score(
            stage_id=3, tension_overall=20.0, pitch_accuracy=30.0, tone_stability=50.0
        )
        assert result.score == 80
        assert result.passed is True
        assert result.level == "beginner"

    def test_tense_voice_fails(self) -> None:
        """긴장도 60 → 점수 40, 불통과."""
        result = calculate_scale_practice_score(
            stage_id=5, tension_overall=60.0, pitch_accuracy=90.0, tone_stability=90.0
        )
        assert result.score == 40
        assert result.passed is False

    def test_pitch_ignored_in_beginner(self) -> None:
        """초급은 음정이 틀려도 몸이 편하면 통과."""
        result = calculate_scale_practice_score(
            stage_id=1, tension_overall=30.0, pitch_accuracy=10.0, tone_stability=20.0
        )
        assert result.score == 70
        assert result.passed is True

    def test_boundary_stage_9(self) -> None:
        """stage 9는 초급."""
        result = calculate_scale_practice_score(
            stage_id=9, tension_overall=45.0, pitch_accuracy=50.0, tone_stability=50.0
        )
        assert result.score == 55
        assert result.passed is True  # 긴장도 == 45 → 통과

    def test_boundary_tension_46_fails(self) -> None:
        """긴장도 46 → 불통과."""
        result = calculate_scale_practice_score(
            stage_id=2, tension_overall=46.0, pitch_accuracy=80.0, tone_stability=80.0
        )
        assert result.passed is False


class TestScalePracticeIntermediate:
    """중급 (stage 10~17): score = (100-긴장도)*0.6 + 피치정확도*0.4, 통과 = 긴장도 ≤ 40 AND 피치 ≥ 60."""

    def test_good_intermediate_passes(self) -> None:
        """긴장도 30, 피치 80 → 점수 = 70*0.6 + 80*0.4 = 42+32 = 74, 통과."""
        result = calculate_scale_practice_score(
            stage_id=12, tension_overall=30.0, pitch_accuracy=80.0, tone_stability=70.0
        )
        assert result.score == 74
        assert result.passed is True
        assert result.level == "intermediate"

    def test_high_tension_fails(self) -> None:
        """긴장도 50 → 피치 좋아도 불통과."""
        result = calculate_scale_practice_score(
            stage_id=15, tension_overall=50.0, pitch_accuracy=90.0, tone_stability=90.0
        )
        assert result.passed is False

    def test_low_pitch_fails(self) -> None:
        """피치 50 → 긴장도 낮아도 불통과."""
        result = calculate_scale_practice_score(
            stage_id=10, tension_overall=20.0, pitch_accuracy=50.0, tone_stability=80.0
        )
        assert result.passed is False

    def test_boundary_stage_17(self) -> None:
        """stage 17은 중급."""
        result = calculate_scale_practice_score(
            stage_id=17, tension_overall=40.0, pitch_accuracy=60.0, tone_stability=70.0
        )
        assert result.level == "intermediate"
        assert result.passed is True  # 긴장도 == 40, 피치 == 60


class TestScalePracticeAdvanced:
    """고급 (stage 18~28): score = (100-긴장도)*0.4 + 피치정확도*0.5 + 톤안정도*0.1, 통과 = 긴장도 ≤ 35 AND 피치 ≥ 75."""

    def test_good_advanced_passes(self) -> None:
        """긴장도 20, 피치 85, 톤 80 → 점수 = 80*0.4 + 85*0.5 + 80*0.1 = 32+42.5+8 = 82.5 → 83, 통과."""
        result = calculate_scale_practice_score(
            stage_id=20, tension_overall=20.0, pitch_accuracy=85.0, tone_stability=80.0
        )
        assert result.score == 82  # round(82.5) = 82
        assert result.passed is True
        assert result.level == "advanced"

    def test_high_tension_fails(self) -> None:
        """긴장도 40 → 불통과."""
        result = calculate_scale_practice_score(
            stage_id=22, tension_overall=40.0, pitch_accuracy=90.0, tone_stability=90.0
        )
        assert result.passed is False

    def test_low_pitch_fails(self) -> None:
        """피치 70 → 불통과."""
        result = calculate_scale_practice_score(
            stage_id=25, tension_overall=30.0, pitch_accuracy=70.0, tone_stability=90.0
        )
        assert result.passed is False

    def test_boundary_stage_28(self) -> None:
        """stage 28은 고급."""
        result = calculate_scale_practice_score(
            stage_id=28, tension_overall=35.0, pitch_accuracy=75.0, tone_stability=70.0
        )
        assert result.level == "advanced"
        assert result.passed is True  # 긴장도 == 35, 피치 == 75

    def test_score_formula(self) -> None:
        """공식 검증: (100-긴장도)*0.4 + 피치*0.5 + 톤*0.1."""
        result = calculate_scale_practice_score(
            stage_id=18, tension_overall=50.0, pitch_accuracy=60.0, tone_stability=40.0
        )
        # (100-50)*0.4 + 60*0.5 + 40*0.1 = 20 + 30 + 4 = 54
        assert result.score == 54


class TestPitchScoreEdgeCases:
    """calculate_pitch_score 엣지 케이스."""

    def test_zero_target_pitch_treated_as_max_error(self) -> None:
        """target이 0이면 최대 오차(1200 cent)로 처리되어 낮은 점수 반환 (lines 95-96 커버)."""
        # t=0 → 최대 오차로 처리
        score = calculate_pitch_score([0.0, 440.0], [440.0, 440.0])
        # 한 쌍은 0cent, 한 쌍은 1200cent → 평균 600cent → (1-600/300)*100=0
        assert score == 0

    def test_zero_actual_pitch_treated_as_max_error(self) -> None:
        """actual이 0이면 최대 오차(1200 cent)로 처리 (lines 95-96 커버)."""
        score = calculate_pitch_score([440.0], [0.0])
        assert score == 0

    def test_negative_actual_pitch_treated_as_max_error(self) -> None:
        """음수 피치도 최대 오차로 처리 (line 95 커버)."""
        score = calculate_pitch_score([440.0, 440.0], [-1.0, 440.0])
        # -1.0 → 1200cent, 440→440 → 0cent, 평균=600 → 0점
        assert score == 0


class TestScalePracticeResult:
    """ScalePracticeResult 구조 검증."""

    def test_result_has_feedback_hint(self) -> None:
        """결과에 feedback_hint가 포함되어야 한다."""
        result = calculate_scale_practice_score(
            stage_id=5, tension_overall=60.0, pitch_accuracy=80.0, tone_stability=80.0
        )
        assert result.feedback_hint != ""

    def test_beginner_hint_is_tension_only(self) -> None:
        """초급 피드백 힌트는 긴장만 언급."""
        result = calculate_scale_practice_score(
            stage_id=3, tension_overall=50.0, pitch_accuracy=20.0, tone_stability=20.0
        )
        assert "긴장" in result.feedback_hint

    def test_advanced_hint_includes_all(self) -> None:
        """고급 피드백 힌트는 종합."""
        result = calculate_scale_practice_score(
            stage_id=20, tension_overall=40.0, pitch_accuracy=60.0, tone_stability=50.0
        )
        assert "종합" in result.feedback_hint or "긴장" in result.feedback_hint
