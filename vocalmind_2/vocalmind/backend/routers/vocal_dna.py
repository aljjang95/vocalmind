"""POST /vocal-dna/analyze — 보컬 DNA 5축 분석 라우터."""
from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from models.tension import TensionAnalysis, TensionScore
from services.audio_utils import convert_to_wav
from services.tension_analyzer import analyze_tension
from services.tension_scorer import calculate_tension_score
from schemas.vocal_dna import VocalDnaResponse
from core.pitch_extractor import extract_avg_pitch as _extract_avg_pitch
from core.voice_classifier import classify_voice_type as _classify_voice_type

router = APIRouter()


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────


def _run_analysis(wav_path: str) -> tuple[TensionAnalysis, TensionScore, float]:
    """WAV 경로 → (TensionAnalysis, TensionScore, avg_pitch_hz)."""
    analysis = analyze_tension(wav_path)
    score = calculate_tension_score(analysis)
    avg_pitch = _extract_avg_pitch(wav_path)
    return analysis, score, avg_pitch


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ── 라우터 ────────────────────────────────────────────────────────────────────

@router.post("/vocal-dna/analyze", response_model=VocalDnaResponse)
async def analyze_vocal_dna(audio: UploadFile) -> VocalDnaResponse:
    """오디오 업로드 → 5축 보컬 DNA 분석.

    긴장 점수를 반전하여 '높을수록 좋음' 스케일로 반환한다.
    """
    raw_bytes = await audio.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="빈 오디오 파일입니다.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        # 원본 파일 저장
        src = tmp / f"input_{audio.filename or 'audio'}"
        src.write_bytes(raw_bytes)

        # WAV 변환
        dst = tmp / "converted.wav"
        try:
            convert_to_wav(src, dst)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"오디오 변환 실패: {exc}",
            ) from exc

        # 분석 실행
        try:
            analysis, score, avg_pitch = _run_analysis(str(dst))
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"음성 분석 중 오류: {exc}",
            ) from exc

    # 긴장 점수 반전 (긴장↑ = 나쁨 → DNA↑ = 좋음)
    laryngeal = _clamp(100.0 - score.laryngeal_tension)
    tongue_root = _clamp(100.0 - score.tongue_root_tension)
    jaw = _clamp(100.0 - score.jaw_tension)
    register_break = _clamp(100.0 - score.register_break)

    # tone_stability: HNR 20dB = 100점 기준 정규화
    tone_stability = _clamp(analysis.voice_quality.hnr * 5.0)

    # pitch / voice_type
    pitch_out = avg_pitch if avg_pitch > 0 else None
    voice_type = _classify_voice_type(avg_pitch)

    return VocalDnaResponse(
        laryngeal=laryngeal,
        tongue_root=tongue_root,
        jaw=jaw,
        register_break=register_break,
        tone_stability=tone_stability,
        avg_pitch_hz=pitch_out,
        voice_type=voice_type,
    )
