"""온보딩 API — 음성 분석 + AI 상담 + TTS."""
from __future__ import annotations
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response
import services.audio_service as audio_service
from services.onboarding_service import generate_consultation
from services.voice_feedback import synthesize_feedback
from schemas.onboarding import (
    ConsultationResponse,
    OnboardingAnalyzeResponse,
    OnboardingTensionResponse,
    TTSRequest,
)
from infra.audio_upload import save_and_convert

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/analyze", response_model=OnboardingAnalyzeResponse)
async def analyze(audio: UploadFile):
    """음성 파일 업로드 → 긴장 분석 + AI 상담."""
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        wav_path, tmp_dir = await save_and_convert(audio, tmp_dir)

        # 음성 분석
        try:
            analysis = audio_service.analyze_audio_file(str(wav_path))
        except FileNotFoundError:
            raise HTTPException(404, "오디오 파일을 찾을 수 없습니다")
        except Exception as e:
            raise HTTPException(500, f"음성 분석 실패: {e}")

        # 4) 긴장 점수 추출
        tension_score = analysis.get("tension_score")
        if tension_score is None:
            # 긴장 분석 실패 시 기본값
            from models.tension import TensionScore
            tension_score = TensionScore(
                overall=0.0,
                laryngeal_tension=0.0,
                tongue_root_tension=0.0,
                jaw_tension=0.0,
                register_break=0.0,
                tension_detected=False,
                detail="분석 데이터 부족",
            )

        # 5) AI 상담
        consultation = await generate_consultation(tension_score)

        return OnboardingAnalyzeResponse(
            tension=OnboardingTensionResponse(
                overall=tension_score.overall,
                laryngeal=tension_score.laryngeal_tension,
                tongue_root=tension_score.tongue_root_tension,
                jaw=tension_score.jaw_tension,
                register_break=tension_score.register_break,
                detail=tension_score.detail,
            ),
            consultation=ConsultationResponse(**consultation),
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/tts")
async def tts(req: TTSRequest):
    """텍스트 → 음성 합성 (edge-tts)."""
    if not req.text or not req.text.strip():
        raise HTTPException(400, "텍스트가 비어있습니다")

    audio_bytes = await synthesize_feedback(req.text)
    if audio_bytes is None:
        raise HTTPException(500, "음성 합성 실패")

    return Response(content=audio_bytes, media_type="audio/mpeg")
