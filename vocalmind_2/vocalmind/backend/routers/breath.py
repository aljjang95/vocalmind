"""POST /breath/analyze — 호흡 분석 REST 라우터."""
from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile

from core.breath_analyzer import analyze_breathing
from infra.audio_upload import save_and_convert
from schemas.breath import BreathAnalyzeResponse, BreathCycleResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/breath", tags=["breath"])


@router.post("/analyze", response_model=BreathAnalyzeResponse)
async def breath_analyze(
    audio: UploadFile,
    target_exhale_sec: float = Form(10.0),
) -> BreathAnalyzeResponse:
    """호흡 오디오를 받아 사이클 + 점수를 반환한다.

    Args:
        audio: 녹음 오디오 (WAV/WebM/MP3)
        target_exhale_sec: 목표 호기 시간 (발성전문반 기본 10초)
    """
    if target_exhale_sec <= 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "target_exhale_sec는 양수여야 합니다", "code": "INVALID_TARGET"},
        )

    tmp_dir = Path(tempfile.mkdtemp())
    try:
        try:
            wav_path, tmp_dir = await save_and_convert(audio, tmp_dir)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": f"오디오 파일 디코드 실패: {exc}", "code": "AUDIO_DECODE_FAIL"},
            )

        analysis = analyze_breathing(str(wav_path), target_exhale_sec=target_exhale_sec)

        logger.info(
            "breath analyze: cycles=%d overall=%d weakness=%s duration=%.1f",
            len(analysis.cycles),
            analysis.overall_score,
            analysis.weakness,
            analysis.duration_sec,
        )

        return BreathAnalyzeResponse(
            cycles=[
                BreathCycleResponse(
                    inhale_start_sec=c.inhale_start_sec,
                    inhale_end_sec=c.inhale_end_sec,
                    exhale_end_sec=c.exhale_end_sec,
                    inhale_duration_sec=c.inhale_duration_sec,
                    exhale_duration_sec=c.exhale_duration_sec,
                    exhale_stability=c.exhale_stability,
                )
                for c in analysis.cycles
            ],
            avg_inhale_sec=analysis.avg_inhale_sec,
            avg_exhale_sec=analysis.avg_exhale_sec,
            consistency_score=analysis.consistency_score,
            sustain_score=analysis.sustain_score,
            stability_score=analysis.stability_score,
            overall_score=analysis.overall_score,
            duration_sec=analysis.duration_sec,
            weakness=analysis.weakness,
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
