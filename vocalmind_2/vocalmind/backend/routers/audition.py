"""POST /audition/score — 오디션 AI 자동 채점 집계."""
from __future__ import annotations

import logging

from fastapi import APIRouter

from schemas.audition import AuditionScoreRequest, AuditionScoreResponse
from services.audition_scoring import score_submission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audition", tags=["audition"])


@router.post("/score", response_model=AuditionScoreResponse)
async def audition_score(payload: AuditionScoreRequest) -> AuditionScoreResponse:
    """이미 계산된 개별 지표(긴장/피치/리듬)를 받아 AI 종합 + 최종 랭킹 점수 반환.

    주의: 오디오 분석은 호출자가 미리 수행한 후 이 엔드포인트에 지표만 전달한다.
    (실시간 /ws/evaluate + /rhythm/analyze 결과 집계용)
    """
    result = score_submission(
        tension_overall=payload.tension_overall,
        pitch_accuracy=payload.pitch_accuracy,
        rhythm_score=payload.rhythm_score,
        vote_score=payload.vote_score,
        alpha=payload.alpha,
    )

    logger.info(
        "audition score: ai=%d final=%d alpha=%.2f status=%s",
        result.ai_score,
        result.final_score,
        result.alpha,
        result.status,
    )

    return AuditionScoreResponse(
        ai_score=result.ai_score,
        tension_score=result.tension_score,
        pitch_accuracy=result.pitch_accuracy,
        rhythm_score=result.rhythm_score,
        vote_score=result.vote_score,
        final_score=result.final_score,
        alpha=result.alpha,
        status=result.status,
    )
