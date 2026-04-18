"""Rhythm Service — 리듬 이벤트를 집계하여 세션 점수와 구간 분석을 반환한다."""
from __future__ import annotations

from dataclasses import dataclass, field

from core.beat_matcher import RhythmEvent


# 분류별 점수 가중치 (ghost는 집계 제외)
_SCORE_MAP: dict[str, int] = {
    "perfect": 100,
    "good": 70,
    "off": 30,
    "miss": 0,
}

# 구간 문제 판정 임계값
_PROBLEM_THRESHOLD = 60


@dataclass
class SectionScore:
    """단일 섹션의 점수 요약."""
    section_index: int
    score: int
    event_count: int


@dataclass
class RhythmSessionScore:
    """세션 전체 리듬 점수 요약."""
    rhythm_score: int
    section_scores: list[SectionScore]
    problem_segments: list[SectionScore]
    coverage_ratio: float


def calculate_rhythm_score(
    events: list[RhythmEvent],
    section_boundaries: list[float],
    total_target_beats: int,
) -> RhythmSessionScore:
    """RhythmEvent 리스트를 집계하여 RhythmSessionScore를 반환한다.

    - ghost 이벤트는 집계에서 완전히 제외
    - rhythm_score = Σ(classification 점수) / 집계 이벤트 수 (int)
    - coverage_ratio = 매칭된 beats / total_target_beats
    - problem_segments = 섹션 점수 < 60인 섹션 리스트

    Args:
        events: RhythmEvent 리스트 (beat_matcher 출력)
        section_boundaries: 섹션 경계 시각 리스트 (섹션 인덱스 key로만 사용)
        total_target_beats: 전체 기준 beat 수 (coverage 계산용)

    Returns:
        RhythmSessionScore
    """
    # ghost 제외 후 집계 대상 이벤트만 필터링
    scoreable = [ev for ev in events if ev.classification != "ghost"]

    # 전체 점수 계산
    if not scoreable:
        overall_score = 0
    else:
        total_points = sum(_SCORE_MAP.get(ev.classification, 0) for ev in scoreable)
        overall_score = int(total_points / len(scoreable))

    # 섹션별 집계
    section_buckets: dict[int, list[RhythmEvent]] = {}
    for ev in scoreable:
        idx = ev.section_index
        if idx not in section_buckets:
            section_buckets[idx] = []
        section_buckets[idx].append(ev)

    section_scores: list[SectionScore] = []
    for idx in sorted(section_buckets.keys()):
        bucket = section_buckets[idx]
        if not bucket:
            continue
        sec_points = sum(_SCORE_MAP.get(ev.classification, 0) for ev in bucket)
        sec_score = int(sec_points / len(bucket))
        section_scores.append(SectionScore(
            section_index=idx,
            score=sec_score,
            event_count=len(bucket),
        ))

    # 기본 섹션(경계 없음): section_index=0으로 통합해 반환
    if not section_scores and scoreable:
        sec_points = sum(_SCORE_MAP.get(ev.classification, 0) for ev in scoreable)
        sec_score = int(sec_points / len(scoreable))
        section_scores.append(SectionScore(
            section_index=0,
            score=sec_score,
            event_count=len(scoreable),
        ))

    # 문제 구간 (점수 < 60)
    problem_segments = [ss for ss in section_scores if ss.score < _PROBLEM_THRESHOLD]

    # coverage_ratio: 매칭된 beat 수 / 전체 target beats
    if total_target_beats <= 0:
        coverage_ratio = 0.0
    else:
        matched_beats = sum(
            1 for ev in scoreable if ev.classification != "miss"
        )
        coverage_ratio = matched_beats / total_target_beats

    return RhythmSessionScore(
        rhythm_score=overall_score,
        section_scores=section_scores,
        problem_segments=problem_segments,
        coverage_ratio=coverage_ratio,
    )
