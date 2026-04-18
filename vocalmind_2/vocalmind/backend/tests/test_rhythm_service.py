"""Rhythm Service 테스트 — 리듬 점수 집계 및 구간별 분석 검증."""
from __future__ import annotations

import pytest

from core.beat_matcher import RhythmEvent
from services.rhythm_service import (
    RhythmSessionScore,
    SectionScore,
    calculate_rhythm_score,
)


def _make_event(
    classification: str,
    section_index: int = 0,
    target_beat_time: float = 1.0,
    onset_time: float | None = 1.0,
) -> RhythmEvent:
    """테스트용 RhythmEvent 생성 헬퍼."""
    err = 0.0
    if onset_time is not None and target_beat_time is not None:
        err = (onset_time - target_beat_time) * 1000.0
    return RhythmEvent(
        onset_time_sec=onset_time,
        target_beat_time_sec=target_beat_time if classification != "ghost" else None,
        error_ms=err,
        classification=classification,
        section_index=section_index,
    )


class TestOverallScore:
    """전체 리듬 점수 계산."""

    def test_score_formula(self):
        """30 이벤트(perfect 20, good 5, off 3, miss 2) → 81.

        계산: (20×100 + 5×70 + 3×30 + 2×0) / 30 = 2440/30 = 81.33 → int(81)
        """
        events: list[RhythmEvent] = (
            [_make_event("perfect", section_index=0)] * 20
            + [_make_event("good", section_index=1)] * 5
            + [_make_event("off", section_index=2)] * 3
            + [_make_event("miss", section_index=0)] * 2
        )
        result = calculate_rhythm_score(
            events=events,
            section_boundaries=[0.0, 5.0, 10.0],
            total_target_beats=30,
        )
        assert isinstance(result, RhythmSessionScore)
        assert result.rhythm_score == 81, (
            f"expected rhythm_score=81, got {result.rhythm_score}"
        )

    def test_all_perfect_score_100(self):
        """모든 이벤트 perfect → rhythm_score=100."""
        events = [_make_event("perfect")] * 10
        result = calculate_rhythm_score(events, [], total_target_beats=10)
        assert result.rhythm_score == 100

    def test_all_miss_score_0(self):
        """모든 이벤트 miss → rhythm_score=0."""
        events = [_make_event("miss", onset_time=None)] * 5
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        assert result.rhythm_score == 0

    def test_empty_events_score_0(self):
        """이벤트 없음 → rhythm_score=0."""
        result = calculate_rhythm_score([], [], total_target_beats=0)
        assert result.rhythm_score == 0


class TestGhostExclusion:
    """ghost 이벤트는 점수 집계에서 제외."""

    def test_ghost_excluded_from_score(self):
        """perfect 5 + ghost 5 → 점수는 perfect 5개만으로 계산 = 100."""
        events = (
            [_make_event("perfect")] * 5
            + [_make_event("ghost", onset_time=2.0, target_beat_time=None)] * 5
        )
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        # ghost 제외, perfect 5/5 = 100
        assert result.rhythm_score == 100

    def test_ghost_does_not_affect_total(self):
        """ghost 이벤트가 total_target_beats 분모에 영향 없음."""
        # perfect 3, miss 1, ghost 10 → (3×100 + 1×0) / 4 = 75
        events = (
            [_make_event("perfect")] * 3
            + [_make_event("miss", onset_time=None)] * 1
            + [_make_event("ghost", onset_time=0.5, target_beat_time=None)] * 10
        )
        result = calculate_rhythm_score(events, [], total_target_beats=4)
        assert result.rhythm_score == 75


class TestSectionScores:
    """구간별 점수 계산."""

    def test_section_scores_correct(self):
        """섹션 0: 10 이벤트, 섹션 1: 15 이벤트, 섹션 2: 5 이벤트 분포."""
        # 섹션 0: perfect 8, miss 2 → (8×100 + 2×0) / 10 = 80
        # 섹션 1: perfect 10, good 5 → (10×100 + 5×70) / 15 = 1350/15 = 90
        # 섹션 2: off 3, miss 2 → (3×30 + 2×0) / 5 = 90/5 = 18
        events = (
            [_make_event("perfect", section_index=0)] * 8
            + [_make_event("miss", section_index=0, onset_time=None)] * 2
            + [_make_event("perfect", section_index=1)] * 10
            + [_make_event("good", section_index=1)] * 5
            + [_make_event("off", section_index=2)] * 3
            + [_make_event("miss", section_index=2, onset_time=None)] * 2
        )
        result = calculate_rhythm_score(
            events=events,
            section_boundaries=[0.0, 5.0, 10.0],
            total_target_beats=30,
        )
        assert len(result.section_scores) == 3
        scores_by_idx = {ss.section_index: ss.score for ss in result.section_scores}
        assert scores_by_idx[0] == 80, f"섹션 0: expected 80, got {scores_by_idx[0]}"
        assert scores_by_idx[1] == 90, f"섹션 1: expected 90, got {scores_by_idx[1]}"
        assert scores_by_idx[2] == 18, f"섹션 2: expected 18, got {scores_by_idx[2]}"

    def test_section_scores_empty_when_no_boundaries(self):
        """section_boundaries=[] → section_scores는 section_index=0 하나만."""
        events = [_make_event("perfect")] * 5
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        assert len(result.section_scores) >= 1


class TestProblemSegments:
    """problem_segments: 구간 점수 < 60인 섹션만 반환."""

    def test_problem_segments_below_60(self):
        """섹션 점수 50(< 60) → problem_segments에 포함."""
        # 섹션 0: perfect 5, miss 5 → 50점 (문제)
        # 섹션 1: perfect 9, off 1 → (9×100+1×30)/10 = 93점 (정상)
        events = (
            [_make_event("perfect", section_index=0)] * 5
            + [_make_event("miss", section_index=0, onset_time=None)] * 5
            + [_make_event("perfect", section_index=1)] * 9
            + [_make_event("off", section_index=1)] * 1
        )
        result = calculate_rhythm_score(
            events=events,
            section_boundaries=[0.0, 5.0],
            total_target_beats=20,
        )
        assert len(result.problem_segments) == 1
        assert result.problem_segments[0].section_index == 0

    def test_no_problem_segments_when_all_good(self):
        """모든 섹션 점수 ≥ 60 → problem_segments 빈 리스트."""
        events = [_make_event("perfect", section_index=0)] * 10
        result = calculate_rhythm_score(events, [0.0], total_target_beats=10)
        assert result.problem_segments == []

    def test_problem_segment_threshold_boundary(self):
        """구간 점수 정확히 60 → problem_segments에 미포함."""
        # 섹션 0: perfect 6, miss 4 → (6×100 + 4×0) / 10 = 60 (정상)
        events = (
            [_make_event("perfect", section_index=0)] * 6
            + [_make_event("miss", section_index=0, onset_time=None)] * 4
        )
        result = calculate_rhythm_score(events, [0.0], total_target_beats=10)
        assert result.problem_segments == []


class TestCoverageRatio:
    """coverage_ratio: 매칭된 target beats / 전체 target beats."""

    def test_coverage_ratio_full(self):
        """모든 beat 매칭 → coverage_ratio=1.0."""
        events = [_make_event("perfect")] * 5
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        assert result.coverage_ratio == pytest.approx(1.0)

    def test_coverage_ratio_partial(self):
        """miss 2개 포함 → coverage_ratio = 3/5 = 0.6."""
        events = (
            [_make_event("perfect")] * 3
            + [_make_event("miss", onset_time=None)] * 2
        )
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        assert result.coverage_ratio == pytest.approx(0.6)

    def test_coverage_ratio_zero(self):
        """전부 miss → coverage_ratio=0.0."""
        events = [_make_event("miss", onset_time=None)] * 5
        result = calculate_rhythm_score(events, [], total_target_beats=5)
        assert result.coverage_ratio == pytest.approx(0.0)

    def test_coverage_ratio_zero_total_beats(self):
        """total_target_beats=0 → coverage_ratio=0.0 (ZeroDivision 방어)."""
        result = calculate_rhythm_score([], [], total_target_beats=0)
        assert result.coverage_ratio == pytest.approx(0.0)
