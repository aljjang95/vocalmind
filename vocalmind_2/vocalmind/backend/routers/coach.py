"""POST /coach — RAG 감각 기반 코칭 피드백."""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
import services.rag_service as rag_service

router = APIRouter()

class CoachRequest(BaseModel):
    stage_id: int
    user_message: str = ""
    score: int = 0
    pitch_accuracy: int = 0
    tension_detail: str = ""
    # 음성 질감 파라미터 (vocal_feedback RAG 검색용)
    jitter: float = 0.0
    shimmer: float = 0.0
    hnr_db: float = 0.0
    avg_pitch_hz: float = 0.0

class VideoRef(BaseModel):
    video_id: str
    timestamp: float

class CoachResponse(BaseModel):
    feedback: str
    next_exercise: str
    encouragement: str
    references: list[VideoRef] = []

@router.post("/coach", response_model=CoachResponse)
async def coach(req: CoachRequest):
    result = rag_service.get_coaching_feedback(
        stage_id=req.stage_id, user_message=req.user_message,
        score=req.score, pitch_accuracy=req.pitch_accuracy,
        tension_detail=req.tension_detail,
        jitter=req.jitter, shimmer=req.shimmer,
        hnr_db=req.hnr_db, avg_pitch_hz=req.avg_pitch_hz,
    )
    return CoachResponse(**result)
