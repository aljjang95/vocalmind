"""POST /rhythm/analyze — 리듬 정확도 분석 REST 라우터."""
from __future__ import annotations

import json
import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile
from pydantic import ValidationError

from core.beat_estimator import estimate_beats
from core.beat_matcher import match_onsets_to_beats
from core.onset_detector import detect_onsets
from infra.audio_upload import save_and_convert
from schemas.rhythm import (
    BeatGridPayload,
    BeatEstimateResponse,
    RhythmAnalyzeResponse,
    RhythmEventResponse,
    SectionBoundary,
    SectionScoreResponse,
)
from services.rhythm_service import calculate_rhythm_score

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rhythm", tags=["rhythm"])


def _build_section_label_map(sections: list[SectionBoundary]) -> dict[int, str]:
    """섹션 인덱스 → 라벨 매핑 생성. (경계 없을 때 빈 dict 반환)"""
    return {i: s.label for i, s in enumerate(sections)}


@router.post("/analyze", response_model=RhythmAnalyzeResponse)
async def rhythm_analyze(
    audio: UploadFile,
    beat_grid_json: str = Form(...),
    output_latency_ms: int = Form(0),
    sections_json: str = Form("[]"),
) -> RhythmAnalyzeResponse:
    """오디오 파일과 박자 그리드를 받아 리듬 정확도를 분석한다.

    Args:
        audio: 업로드 오디오 (WebM/WAV/MP3 등)
        beat_grid_json: BeatGridPayload JSON 문자열
        output_latency_ms: 출력 레이턴시 보정값 (ms)
        sections_json: SectionBoundary 목록 JSON 문자열

    Returns:
        RhythmAnalyzeResponse
    """
    # beat_grid_json 파싱
    try:
        beat_grid = BeatGridPayload.model_validate(json.loads(beat_grid_json))
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": f"beat_grid_json 파싱 실패: {exc}", "code": "BEAT_GRID_PARSE_FAIL"},
        )

    # sections_json 파싱
    try:
        raw_sections = json.loads(sections_json) if sections_json else []
        sections: list[SectionBoundary] = [SectionBoundary.model_validate(s) for s in raw_sections]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": f"sections_json 파싱 실패: {exc}", "code": "SECTIONS_PARSE_FAIL"},
        )

    tmp_dir = Path(tempfile.mkdtemp())
    try:
        # 오디오 저장 + WAV 변환
        try:
            wav_path, tmp_dir = await save_and_convert(audio, tmp_dir)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": f"오디오 파일 디코드 실패: {exc}", "code": "AUDIO_DECODE_FAIL"},
            )

        # onset 감지
        onsets = detect_onsets(str(wav_path))

        # 섹션 경계 시각 추출 (beat_matcher 인터페이스)
        section_boundaries = [s.start_sec for s in sections] if sections else []
        section_label_map = _build_section_label_map(sections)

        # onset ↔ beat 매칭
        events = match_onsets_to_beats(
            onsets=onsets,
            target_beats=beat_grid.beat_times,
            output_latency_ms=output_latency_ms,
            section_boundaries=section_boundaries or None,
        )

        # 점수 집계
        total_beats = len(beat_grid.beat_times)
        session_score = calculate_rhythm_score(
            events=events,
            section_boundaries=section_boundaries,
            total_target_beats=total_beats,
        )

        logger.info(
            "rhythm analyze: bpm=%.1f beats=%d onsets=%d score=%d",
            beat_grid.bpm,
            len(beat_grid.beat_times),
            len(onsets),
            session_score.rhythm_score,
        )

        # 응답 변환
        event_responses = [
            RhythmEventResponse(
                onset_time_sec=ev.onset_time_sec,
                target_beat_time_sec=ev.target_beat_time_sec,
                error_ms=ev.error_ms,
                classification=ev.classification,  # type: ignore[arg-type]
                section_index=ev.section_index,
            )
            for ev in events
        ]

        section_score_responses = [
            SectionScoreResponse(
                section_index=ss.section_index,
                label=section_label_map.get(ss.section_index, str(ss.section_index)),
                score=ss.score,
                event_count=ss.event_count,
            )
            for ss in session_score.section_scores
        ]

        problem_responses = [
            SectionScoreResponse(
                section_index=ss.section_index,
                label=section_label_map.get(ss.section_index, str(ss.section_index)),
                score=ss.score,
                event_count=ss.event_count,
            )
            for ss in session_score.problem_segments
        ]

        return RhythmAnalyzeResponse(
            rhythm_score=session_score.rhythm_score,
            events=event_responses,
            section_scores=section_score_responses,
            problem_segments=problem_responses,
            coverage_ratio=session_score.coverage_ratio,
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/estimate-beats", response_model=BeatEstimateResponse)
async def rhythm_estimate_beats(audio: UploadFile) -> BeatEstimateResponse:
    """오디오에서 BPM + 비트 격자를 자동 추정한다.

    신뢰도 < 0.7이면 beat_times 빈 리스트 반환 (폴백 권장).
    """
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

        estimation = estimate_beats(str(wav_path))
        logger.info(
            "beat estimate: bpm=%.1f conf=%.2f n_beats=%d",
            estimation.bpm,
            estimation.confidence,
            len(estimation.beat_times),
        )
        return BeatEstimateResponse(
            bpm=estimation.bpm,
            first_beat_offset_sec=estimation.first_beat_offset_sec,
            beat_times=estimation.beat_times,
            confidence=estimation.confidence,
            source="ai" if estimation.confidence >= 0.7 else "none",
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
