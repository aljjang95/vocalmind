"""Beat Matcher 테스트 — onset vs target beat 오차 분류 및 매칭 로직 검증."""
from __future__ import annotations

import pytest

from core.onset_detector import OnsetEvent
from core.beat_matcher import RhythmEvent, match_onsets_to_beats


def _make_onsets(*times: float) -> list[OnsetEvent]:
    """float 시각 목록을 OnsetEvent 리스트로 변환."""
    return [OnsetEvent(time_sec=t, confidence=1.0) for t in times]


class TestClassificationBoundaries:
    """오차 임계값 경계 케이스 — ≤50ms: perfect, ≤150ms: good, >150ms: off."""

    @pytest.mark.parametrize("error_ms,expected_cls", [
        (49,  "perfect"),
        (50,  "perfect"),
        (51,  "good"),
        (149, "good"),
        (150, "good"),
        (151, "off"),
    ])
    def test_boundary_classification(self, error_ms: int, expected_cls: str):
        """오차 49/50/51/149/150/151ms → 각각 perfect/perfect/good/good/good/off."""
        target_beats = [1.0]
        onset_time = 1.0 + error_ms / 1000.0
        onsets = _make_onsets(onset_time)
        result = match_onsets_to_beats(onsets, target_beats)
        assert len(result) == 1
        assert result[0].classification == expected_cls, (
            f"error={error_ms}ms: expected {expected_cls}, got {result[0].classification}"
        )
        assert abs(result[0].error_ms - error_ms) < 0.5

    def test_negative_error_boundary(self):
        """음수 오차(조기 onset)도 절댓값으로 분류."""
        target_beats = [1.0]
        onset_time = 1.0 - 0.049  # -49ms → perfect
        onsets = _make_onsets(onset_time)
        result = match_onsets_to_beats(onsets, target_beats)
        assert result[0].classification == "perfect"
        assert result[0].error_ms == pytest.approx(-49.0, abs=1.0)


class TestMissingOnsets:
    """onset 누락 → miss 이벤트 생성."""

    def test_unmatched_targets_become_miss(self):
        """기준 beat 5개, 매칭 onset 3개 → miss 2개 포함."""
        target_beats = [0.5, 1.0, 1.5, 2.0, 2.5]
        # onset을 3개만 제공 (0.5, 1.0, 1.5 근처)
        onsets = _make_onsets(0.50, 1.01, 1.49)
        result = match_onsets_to_beats(onsets, target_beats)
        classifications = [ev.classification for ev in result]
        miss_count = classifications.count("miss")
        assert miss_count == 2, (
            f"expected 2 miss events, got {miss_count}. classifications: {classifications}"
        )

    def test_miss_event_fields(self):
        """miss 이벤트의 onset_time은 None, target_beat_time은 유효 값."""
        target_beats = [1.0]
        onsets = []  # onset 없음
        result = match_onsets_to_beats(onsets, target_beats)
        assert len(result) == 1
        assert result[0].classification == "miss"
        assert result[0].onset_time_sec is None
        assert result[0].target_beat_time_sec == pytest.approx(1.0)

    def test_empty_both(self):
        """빈 onset 리스트 + 빈 target beats → 빈 결과."""
        result = match_onsets_to_beats([], [])
        assert result == []


class TestGhostOnsets:
    """매칭되지 않은 onset → ghost 이벤트."""

    def test_extra_onsets_become_ghost(self):
        """기준 beat 3개, 측정 onset 5개 → ghost 2개."""
        target_beats = [0.5, 1.0, 1.5]
        onsets = _make_onsets(0.50, 0.75, 1.01, 1.25, 1.51)
        result = match_onsets_to_beats(onsets, target_beats)
        ghost_count = sum(1 for ev in result if ev.classification == "ghost")
        assert ghost_count == 2, (
            f"expected 2 ghost events, got {ghost_count}. "
            f"classifications: {[ev.classification for ev in result]}"
        )

    def test_ghost_event_fields(self):
        """ghost 이벤트의 target_beat_time은 None, onset_time은 유효 값.

        매칭 윈도우(_MATCH_WINDOW_MS=500ms) 초과 onset은 ghost로 분류됨.
        """
        target_beats = [1.0]
        # onset이 1.0에서 600ms 오차 → 매칭 윈도우 초과 → ghost
        onsets = _make_onsets(1.6)  # 600ms 오차 > 매칭 윈도우(500ms)
        result = match_onsets_to_beats(onsets, target_beats)
        ghost_events = [ev for ev in result if ev.classification == "ghost"]
        assert len(ghost_events) == 1
        assert ghost_events[0].onset_time_sec == pytest.approx(1.6)
        assert ghost_events[0].target_beat_time_sec is None


class TestOneToNMatching:
    """1:N 매칭 방지 — 가장 가까운 onset 1개만 매칭, 나머지는 ghost."""

    def test_closest_onset_wins(self):
        """target beat 1개, 매우 근접한 onset 2개 → 가장 가까운 것만 perfect, 나머지 ghost."""
        target_beats = [1.0]
        # 두 onset 모두 1.0과 가까움 (30ms, 40ms)
        onsets = _make_onsets(0.970, 0.960)
        result = match_onsets_to_beats(onsets, target_beats)
        classifications = sorted([ev.classification for ev in result])
        assert "perfect" in classifications
        assert "ghost" in classifications
        perfect_count = classifications.count("perfect")
        assert perfect_count == 1, f"expected 1 perfect, got {perfect_count}"


class TestLatencyCorrection:
    """output_latency_ms 보정 — onset 시각에서 latency 차감 후 매칭."""

    def test_latency_correction_applied(self):
        """onset이 100ms 지연된 경우, latency=100ms 보정 후 perfect 분류."""
        target_beats = [1.0]
        # 실제 onset은 1.1초이지만 latency 100ms를 빼면 1.0초 → perfect
        onsets = _make_onsets(1.1)
        result = match_onsets_to_beats(onsets, target_beats, output_latency_ms=100)
        assert result[0].classification == "perfect", (
            f"expected perfect with 100ms latency correction, got {result[0].classification}"
        )

    def test_no_latency_correction(self):
        """latency=0ms일 때는 보정 없이 원래 오차로 분류."""
        target_beats = [1.0]
        onsets = _make_onsets(1.2)  # 200ms 오차 → off
        result = match_onsets_to_beats(onsets, target_beats, output_latency_ms=0)
        assert result[0].classification == "off"


class TestSectionIndex:
    """section_boundaries로 section_index 계산."""

    def test_section_index_assigned(self):
        """섹션 경계 [0.0, 1.0, 2.0] → 각 이벤트에 올바른 section_index."""
        target_beats = [0.5, 1.5, 2.5]
        onsets = _make_onsets(0.5, 1.5, 2.5)
        section_boundaries = [0.0, 1.0, 2.0]
        result = match_onsets_to_beats(onsets, target_beats, section_boundaries=section_boundaries)
        matched = {ev.target_beat_time_sec: ev.section_index for ev in result if ev.target_beat_time_sec is not None}
        assert matched[0.5] == 0
        assert matched[1.5] == 1
        assert matched[2.5] == 2

    def test_no_section_boundaries(self):
        """section_boundaries=None → 모두 section_index=0."""
        target_beats = [0.5, 1.5]
        onsets = _make_onsets(0.5, 1.5)
        result = match_onsets_to_beats(onsets, target_beats, section_boundaries=None)
        for ev in result:
            assert ev.section_index == 0

    def test_event_fields_complete(self):
        """RhythmEvent 필드 완전성 검증."""
        target_beats = [1.0]
        onsets = _make_onsets(1.02)
        result = match_onsets_to_beats(onsets, target_beats)
        ev = result[0]
        assert hasattr(ev, "onset_time_sec")
        assert hasattr(ev, "target_beat_time_sec")
        assert hasattr(ev, "error_ms")
        assert hasattr(ev, "classification")
        assert hasattr(ev, "section_index")
