from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.tension import TensionScore


@dataclass
class ScalePracticeResult:
    """3단계 채점 결과."""
    score: int
    passed: bool
    level: str  # "beginner" | "intermediate" | "advanced"
    feedback_hint: str


def _get_level(stage_id: int) -> str:
    if stage_id <= 9:
        return "beginner"
    if stage_id <= 17:
        return "intermediate"
    return "advanced"


def calculate_scale_practice_score(
    stage_id: int,
    tension_overall: float,
    pitch_accuracy: float,
    tone_stability: float,
) -> ScalePracticeResult:
    """3단계 채점 공식으로 스케일 연습 점수를 계산한다.

    초급 (1~9):  score = (100 - 긴장도), 통과 = 긴장도 ≤ 45
    중급 (10~17): score = (100-긴장도)*0.6 + 피치정확도*0.4, 통과 = 긴장도 ≤ 40 AND 피치 ≥ 60
    고급 (18~28): score = (100-긴장도)*0.4 + 피치정확도*0.5 + 톤안정도*0.1, 통과 = 긴장도 ≤ 35 AND 피치 ≥ 75
    """
    level = _get_level(stage_id)
    tension_overall = max(0.0, min(100.0, tension_overall))
    pitch_accuracy = max(0.0, min(100.0, pitch_accuracy))
    tone_stability = max(0.0, min(100.0, tone_stability))

    if level == "beginner":
        raw = 100.0 - tension_overall
        passed = tension_overall <= 45
        if not passed:
            feedback_hint = "긴장 부위를 이완하는 데 집중하세요"
        else:
            feedback_hint = "긴장 없이 편안한 소리가 나고 있어요"
    elif level == "intermediate":
        raw = (100.0 - tension_overall) * 0.6 + pitch_accuracy * 0.4
        passed = tension_overall <= 40 and pitch_accuracy >= 60
        if tension_overall > 40:
            feedback_hint = "긴장을 더 풀어야 합니다"
        elif pitch_accuracy < 60:
            feedback_hint = "긴장은 좋으나 음정 정확도를 높여보세요"
        else:
            feedback_hint = "긴장 관리와 음정 모두 양호합니다"
    else:  # advanced
        raw = (100.0 - tension_overall) * 0.4 + pitch_accuracy * 0.5 + tone_stability * 0.1
        passed = tension_overall <= 35 and pitch_accuracy >= 75
        if tension_overall > 35:
            feedback_hint = "종합: 고음에서 긴장이 감지됩니다"
        elif pitch_accuracy < 75:
            feedback_hint = "종합: 긴장 관리는 좋으나 음정 정밀도를 높여야 합니다"
        else:
            feedback_hint = "종합: 긴장, 음정, 톤 모두 우수합니다"

    score = round(max(0.0, min(100.0, raw)))
    return ScalePracticeResult(score=score, passed=passed, level=level, feedback_hint=feedback_hint)


def calculate_pitch_score(target_hz: list[float], actual_hz: list[float]) -> int:
    """cent 단위 오차 기반 피치 정확도를 계산한다.

    Args:
        target_hz: 목표 주파수 목록 (Hz)
        actual_hz: 실제 측정된 주파수 목록 (Hz)

    Returns:
        피치 정확도 점수 (0~100)
    """
    if not target_hz or not actual_hz:
        return 0

    pairs = list(zip(target_hz, actual_hz))
    if not pairs:
        return 0

    cent_errors: list[float] = []
    for t, a in pairs:
        if t <= 0 or a <= 0:
            cent_errors.append(1200.0)  # 최대 오차로 처리
            continue
        # 1 cent = 1/100 반음, 1 옥타브 = 1200 cent
        cents = abs(1200.0 * math.log2(a / t))
        cent_errors.append(cents)

    mean_error = sum(cent_errors) / len(cent_errors)

    # 0cent = 100점, 300cent (단3도) 이상 = 0점 선형 보간
    # 반음 1개(100cent) 이탈 시 약 67점 수준
    max_error = 300.0
    score = max(0.0, (1.0 - mean_error / max_error) * 100.0)
    return round(score)


def calculate_stage_score_v2(
    pitch_accuracy: float,
    tone_stability: float,
    tension_score: "TensionScore | None",
) -> tuple[int, bool, str]:
    """피치 정확도, 음색 안정도, tension_score를 통합하여 스테이지 점수를 계산한다.

    tension_score.overall 비율에 따라 최대 30% 감점.

    Args:
        pitch_accuracy: 피치 정확도 (0~100)
        tone_stability: 음색 안정도 (0~100)
        tension_score: TensionScore 또는 None

    Returns:
        (통합 점수 0~100, tension_detected, tension_detail)
    """
    raw = pitch_accuracy * 0.6 + tone_stability * 0.4
    tension_detected = False
    tension_detail = ""
    if tension_score is not None:
        tension_detected = tension_score.tension_detected
        tension_detail = tension_score.detail
        if tension_detected:
            penalty = min(0.3, tension_score.overall / 100 * 0.3)
            raw *= (1 - penalty)
    return round(max(0, min(100, raw))), tension_detected, tension_detail
