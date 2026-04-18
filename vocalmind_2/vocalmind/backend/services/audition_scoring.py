"""오디션 AI 자동 채점 — 4축 긴장 + 피치 + 리듬을 통합 점수로 집계."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AuditionSubScores:
    """AI 채점 서브 지표 (각 0~100)."""
    tension_score: int        # 4축 긴장 반전 점수 (100 - tension_overall)
    pitch_accuracy: int       # 피치 정확도
    rhythm_score: int | None  # 리듬 정확도 (beatGrid 없으면 None)


@dataclass
class AuditionScore:
    """최종 AI 종합 점수 + 가중 조합 결과."""
    ai_score: int             # AI 종합 (0~100)
    tension_score: int
    pitch_accuracy: int
    rhythm_score: int | None
    final_score: int          # 투표 + AI 가중 평균
    vote_score: int
    alpha: float              # AI 가중치 (0~1)
    status: str               # "complete" / "partial" / "failed"


# 가중치 (AI 종합 점수 계산용)
WEIGHT_PITCH = 0.40
WEIGHT_RHYTHM = 0.30
WEIGHT_TENSION = 0.30

# 리듬 미지원 곡 폴백: 피치 + 긴장만 재가중 (각 57/43)
WEIGHT_PITCH_NO_RHYTHM = 0.57
WEIGHT_TENSION_NO_RHYTHM = 0.43


def compute_ai_score(subs: AuditionSubScores) -> int:
    """서브 지표 → AI 종합 점수 (0~100)."""
    pitch = max(0, min(100, subs.pitch_accuracy))
    tension = max(0, min(100, subs.tension_score))

    if subs.rhythm_score is not None:
        rhythm = max(0, min(100, subs.rhythm_score))
        score = (
            WEIGHT_PITCH * pitch
            + WEIGHT_RHYTHM * rhythm
            + WEIGHT_TENSION * tension
        )
    else:
        # 리듬 미지원 곡: 피치/긴장 재가중
        score = WEIGHT_PITCH_NO_RHYTHM * pitch + WEIGHT_TENSION_NO_RHYTHM * tension

    return int(round(max(0, min(100, score))))


def blend_final_score(ai_score: int | None, vote_score: int, alpha: float) -> int:
    """AI 점수 + 투표 점수를 가중 평균으로 합친다.

    - ai_score가 None(채점 실패)이면 투표 점수 그대로
    - alpha = 0 → 투표만, alpha = 1 → AI만
    """
    alpha = max(0.0, min(1.0, alpha))
    vote = max(0, min(100, vote_score))

    if ai_score is None:
        return vote

    ai = max(0, min(100, ai_score))
    final = (1 - alpha) * vote + alpha * ai
    return int(round(max(0, min(100, final))))


def score_submission(
    tension_overall: float,
    pitch_accuracy: int,
    rhythm_score: int | None,
    vote_score: int = 0,
    alpha: float = 0.3,
) -> AuditionScore:
    """참가 제출 전체 점수 계산.

    Args:
        tension_overall: 긴장 4축 종합 (0~100, 높을수록 긴장 심함)
        pitch_accuracy: 피치 정확도 (0~100, 높을수록 정확)
        rhythm_score: 리듬 정확도 (0~100) 또는 None
        vote_score: 투표 집계 점수 (0~100)
        alpha: AI 가중치 (0~1)
    """
    # 긴장 반전: 100 - tension_overall (편안할수록 고점)
    tension_score = int(round(max(0, min(100, 100.0 - tension_overall))))
    pitch = int(max(0, min(100, pitch_accuracy)))
    rhythm_int: int | None = (
        None if rhythm_score is None else int(max(0, min(100, rhythm_score)))
    )

    subs = AuditionSubScores(
        tension_score=tension_score,
        pitch_accuracy=pitch,
        rhythm_score=rhythm_int,
    )
    ai_score = compute_ai_score(subs)
    final = blend_final_score(ai_score, vote_score, alpha)

    status = "complete" if rhythm_int is not None else "partial"

    return AuditionScore(
        ai_score=ai_score,
        tension_score=tension_score,
        pitch_accuracy=pitch,
        rhythm_score=rhythm_int,
        final_score=final,
        vote_score=vote_score,
        alpha=alpha,
        status=status,
    )
