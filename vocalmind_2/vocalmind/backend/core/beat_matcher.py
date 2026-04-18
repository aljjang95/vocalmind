"""Beat Matcher — onset 시각과 기준 beat 시각을 매칭하고 리듬 정확도를 분류한다."""
from __future__ import annotations

from dataclasses import dataclass, field

from core.onset_detector import OnsetEvent


@dataclass
class RhythmEvent:
    """단일 리듬 이벤트 — 매칭 결과 또는 miss/ghost."""
    onset_time_sec: float | None      # 감지된 onset 시각 (miss는 None)
    target_beat_time_sec: float | None  # 기준 beat 시각 (ghost는 None)
    error_ms: float                   # 오차 (ms). miss/ghost는 0.0
    classification: str               # "perfect" | "good" | "off" | "miss" | "ghost"
    section_index: int = 0            # 섹션 번호


# 분류 임계값 (ms)
_PERFECT_THRESHOLD_MS = 50.0
_GOOD_THRESHOLD_MS = 150.0
# 매칭 윈도우: 이 범위 내의 onset은 off로 분류 (매칭은 되지만 정확도는 낮음)
# 이 범위를 벗어난 onset만 ghost, beat만 miss로 처리
_MATCH_WINDOW_MS = 500.0


def _classify(error_ms: float) -> str:
    """절댓값 오차(ms)를 기준으로 리듬 분류 반환."""
    abs_err = abs(error_ms)
    # 부동소수점 안전: 경계값에서 epsilon 허용
    if abs_err <= _PERFECT_THRESHOLD_MS + 1e-9:
        return "perfect"
    if abs_err <= _GOOD_THRESHOLD_MS + 1e-9:
        return "good"
    return "off"


def _get_section_index(
    time_sec: float,
    section_boundaries: list[float],
) -> int:
    """time_sec이 속하는 섹션 인덱스를 반환한다.

    section_boundaries = [0.0, 1.0, 2.0] 이면:
      0.0 ~ 0.999 → 0
      1.0 ~ 1.999 → 1
      2.0 ~       → 2
    """
    idx = 0
    for i, boundary in enumerate(section_boundaries):
        if time_sec >= boundary:
            idx = i
        else:
            break
    return idx


def match_onsets_to_beats(
    onsets: list[OnsetEvent],
    target_beats: list[float],
    output_latency_ms: int = 0,
    section_boundaries: list[float] | None = None,
) -> list[RhythmEvent]:
    """onset 시각 목록을 기준 beat 시각과 1:1 매칭하여 RhythmEvent 리스트를 반환한다.

    알고리즘:
      1. onset 시각에서 output_latency_ms/1000 차감 (레이턴시 보정)
      2. 각 target beat에 대해 오차 ≤ 150ms인 미매칭 onset 중 가장 가까운 것을 탐색
      3. 매칭된 onset → classification(perfect/good/off)
      4. 매칭되지 않은 target beat → miss 이벤트
      5. 매칭되지 않은 onset → ghost 이벤트

    Args:
        onsets: 감지된 onset 이벤트 리스트
        target_beats: 기준 beat 시각 리스트 (초)
        output_latency_ms: 출력 레이턴시 보정값 (ms)
        section_boundaries: 섹션 경계 시각 리스트 (None이면 모두 section_index=0)

    Returns:
        RhythmEvent 리스트 (matched, miss, ghost 포함)
    """
    if not target_beats and not onsets:
        return []

    latency_sec = output_latency_ms / 1000.0
    boundaries = section_boundaries or []

    # onset 시각 보정 (레이턴시 차감)
    corrected_onset_times: list[float] = [
        ev.time_sec - latency_sec for ev in onsets
    ]

    matched_onset_indices: set[int] = set()
    events: list[RhythmEvent] = []

    # 각 target beat에 대해 가장 가까운 onset 탐색
    for beat_time in target_beats:
        best_idx: int | None = None
        best_err_ms: float = float("inf")

        for i, onset_t in enumerate(corrected_onset_times):
            if i in matched_onset_indices:
                continue
            err_ms = (onset_t - beat_time) * 1000.0
            # _MATCH_WINDOW_MS 이내의 모든 onset을 매칭 후보로 포함
            # (off 분류 포함)
            if abs(err_ms) <= _MATCH_WINDOW_MS:
                if abs(err_ms) < abs(best_err_ms):
                    best_err_ms = err_ms
                    best_idx = i

        if best_idx is not None:
            # 매칭 성공
            matched_onset_indices.add(best_idx)
            classification = _classify(best_err_ms)
            sec_idx = _get_section_index(beat_time, boundaries)
            events.append(RhythmEvent(
                onset_time_sec=onsets[best_idx].time_sec,
                target_beat_time_sec=beat_time,
                error_ms=round(best_err_ms, 2),
                classification=classification,
                section_index=sec_idx,
            ))
        else:
            # miss: 해당 beat에 매칭할 onset 없음
            sec_idx = _get_section_index(beat_time, boundaries)
            events.append(RhythmEvent(
                onset_time_sec=None,
                target_beat_time_sec=beat_time,
                error_ms=0.0,
                classification="miss",
                section_index=sec_idx,
            ))

    # 매칭되지 않은 onset → ghost 이벤트
    for i, onset_t in enumerate(corrected_onset_times):
        if i not in matched_onset_indices:
            sec_idx = _get_section_index(onset_t, boundaries)
            events.append(RhythmEvent(
                onset_time_sec=onsets[i].time_sec,
                target_beat_time_sec=None,
                error_ms=0.0,
                classification="ghost",
                section_index=sec_idx,
            ))

    return events
