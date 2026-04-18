"""WebSocket /ws/rhythm — 리듬 정확도 실시간 스트리밍 분석."""
from __future__ import annotations

import json
import logging
import shutil
import tempfile
import uuid
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.beat_matcher import match_onsets_to_beats
from core.onset_detector import OnsetEvent, detect_onsets
from schemas.rhythm import BeatGridPayload, SectionBoundary
from services.rhythm_service import calculate_rhythm_score

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_wav_duration(wav_path: Path) -> float:
    """WAV 파일의 재생 시간(초)을 반환한다. 실패 시 0.0."""
    try:
        info = sf.info(str(wav_path))
        return info.duration
    except Exception:
        return 0.0


def _save_chunk_as_wav(chunk_bytes: bytes, tmp_dir: Path) -> Path | None:
    """바이너리 청크를 임시 WAV 파일로 저장한다.

    청크가 이미 WAV 헤더를 가지면 그대로 저장.
    WAV가 아닌 경우(WebM 등)는 soundfile로 읽어 WAV로 재저장.
    실패 시 None 반환.
    """
    chunk_path = tmp_dir / f"{uuid.uuid4().hex}.chunk"
    chunk_path.write_bytes(chunk_bytes)

    # WAV 서명 확인
    if chunk_bytes[:4] == b"RIFF":
        wav_path = chunk_path.with_suffix(".wav")
        chunk_path.rename(wav_path)
        return wav_path

    # WAV가 아닌 포맷: soundfile로 디코드 후 WAV 저장
    try:
        data, sr = sf.read(str(chunk_path), dtype="float32", always_2d=False)
        wav_path = chunk_path.with_suffix(".wav")
        sf.write(str(wav_path), data, sr, subtype="PCM_16")
        chunk_path.unlink(missing_ok=True)
        return wav_path
    except Exception:
        chunk_path.unlink(missing_ok=True)
        return None


def _section_boundaries_from_list(sections: list[SectionBoundary]) -> list[float]:
    """SectionBoundary 목록에서 start_sec 리스트를 추출한다."""
    return [s.start_sec for s in sections]


@router.websocket("/ws/rhythm")
async def ws_rhythm(ws: WebSocket, token: str | None = Query(default=None)):
    """리듬 실시간 분석 WebSocket.

    클라이언트 → 서버 메시지:
      text JSON: {"type": "start", "beat_grid": {...}, "output_latency_ms": 0, "sections": [...]}
      binary:    오디오 청크 (WAV / WebM)
      text JSON: {"type": "end"}

    서버 → 클라이언트 메시지 (JSON):
      {"type": "ready"}
      {"type": "onsets", "events": [...], "chunk_start_sec": N}
      {"type": "report", "rhythm_score": N, "section_scores": [...], ...}
      {"type": "error", "message": "..."}
    """
    await ws.accept()

    if not token:
        logger.warning("[ws/rhythm] 인증 토큰 없이 연결됨")
    else:
        logger.info("[ws/rhythm] 토큰 포함 연결 (token 길이=%d)", len(token))

    # 세션 상태
    beat_grid: BeatGridPayload | None = None
    sections: list[SectionBoundary] = []
    output_latency_ms: int = 0
    session_onsets: list[OnsetEvent] = []
    chunk_start_sec: float = 0.0

    tmp_dir = Path(tempfile.mkdtemp())

    try:
        while True:
            message = await ws.receive()

            # ── 클라이언트 연결 해제 감지 ──
            if message.get("type") == "websocket.disconnect":
                break

            # ── 텍스트 메시지 처리 ──
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except (json.JSONDecodeError, TypeError):
                    await ws.send_json({"type": "error", "message": "잘못된 JSON 메시지 형식"})
                    continue

                msg_type = data.get("type", "")

                if msg_type == "start":
                    # beat_grid 파싱
                    raw_grid = data.get("beat_grid")
                    if not raw_grid:
                        await ws.send_json({"type": "error", "message": "beat_grid가 없습니다"})
                        continue

                    try:
                        beat_grid = BeatGridPayload.model_validate(raw_grid)
                    except Exception as exc:
                        await ws.send_json({"type": "error", "message": f"beat_grid 파싱 실패: {exc}"})
                        continue

                    # 섹션 파싱
                    raw_sections = data.get("sections", [])
                    try:
                        sections = [SectionBoundary.model_validate(s) for s in raw_sections]
                    except Exception:
                        sections = []

                    output_latency_ms = int(data.get("output_latency_ms", 0))

                    # 세션 초기화
                    session_onsets = []
                    chunk_start_sec = 0.0

                    await ws.send_json({"type": "ready"})

                elif msg_type == "end":
                    if beat_grid is None:
                        await ws.send_json({"type": "error", "message": "start 메시지가 없었습니다"})
                        break

                    # 전체 세션 최종 집계
                    section_boundaries = _section_boundaries_from_list(sections)
                    events = match_onsets_to_beats(
                        onsets=session_onsets,
                        target_beats=beat_grid.beat_times,
                        output_latency_ms=output_latency_ms,
                        section_boundaries=section_boundaries or None,
                    )
                    total_beats = len(beat_grid.beat_times)
                    score = calculate_rhythm_score(
                        events=events,
                        section_boundaries=section_boundaries,
                        total_target_beats=total_beats,
                    )

                    logger.info(
                        "[ws/rhythm] 세션 종료: onsets=%d beats=%d score=%d",
                        len(session_onsets),
                        total_beats,
                        score.rhythm_score,
                    )

                    section_label_map = {i: s.label for i, s in enumerate(sections)}

                    await ws.send_json({
                        "type": "report",
                        "rhythm_score": score.rhythm_score,
                        "coverage_ratio": score.coverage_ratio,
                        "section_scores": [
                            {
                                "section_index": ss.section_index,
                                "label": section_label_map.get(ss.section_index, str(ss.section_index)),
                                "score": ss.score,
                                "event_count": ss.event_count,
                            }
                            for ss in score.section_scores
                        ],
                        "problem_segments": [
                            {
                                "section_index": ss.section_index,
                                "label": section_label_map.get(ss.section_index, str(ss.section_index)),
                                "score": ss.score,
                                "event_count": ss.event_count,
                            }
                            for ss in score.problem_segments
                        ],
                    })
                    break

                else:
                    await ws.send_json({"type": "error", "message": f"알 수 없는 메시지 타입: {msg_type}"})

            # ── 바이너리 메시지 처리 (오디오 청크) ──
            elif "bytes" in message:
                chunk_data = message["bytes"]
                if not chunk_data:
                    continue

                if beat_grid is None:
                    await ws.send_json({"type": "error", "message": "start 먼저 전송해주세요"})
                    continue

                try:
                    # 청크 → WAV 저장
                    wav_path = _save_chunk_as_wav(chunk_data, tmp_dir)
                    if wav_path is None:
                        await ws.send_json({
                            "type": "error",
                            "message": "청크 디코드 실패",
                        })
                        continue

                    # 청크 재생 시간 측정 (절대 시각 계산용)
                    chunk_duration = _get_wav_duration(wav_path)

                    # onset 감지 + 절대 시각 변환
                    chunk_onsets = detect_onsets(str(wav_path))
                    abs_onsets = [
                        OnsetEvent(
                            time_sec=ev.time_sec + chunk_start_sec,
                            confidence=ev.confidence,
                        )
                        for ev in chunk_onsets
                    ]
                    session_onsets.extend(abs_onsets)

                    # 임시 파일 삭제
                    wav_path.unlink(missing_ok=True)

                    # 현재까지의 onset 기반 1차 미리보기
                    section_boundaries = _section_boundaries_from_list(sections)
                    preview_events = match_onsets_to_beats(
                        onsets=session_onsets,
                        target_beats=beat_grid.beat_times,
                        output_latency_ms=output_latency_ms,
                        section_boundaries=section_boundaries or None,
                    )

                    await ws.send_json({
                        "type": "onsets",
                        "chunk_start_sec": chunk_start_sec,
                        "chunk_onset_count": len(chunk_onsets),
                        "events": [
                            {
                                "onset_time_sec": ev.onset_time_sec,
                                "target_beat_time_sec": ev.target_beat_time_sec,
                                "error_ms": ev.error_ms,
                                "classification": ev.classification,
                                "section_index": ev.section_index,
                            }
                            for ev in preview_events
                        ],
                    })

                    # 다음 청크의 시작 시각 업데이트
                    chunk_start_sec += chunk_duration

                except Exception as exc:
                    logger.warning("[ws/rhythm] 청크 처리 실패: %s", exc, exc_info=True)
                    await ws.send_json({"type": "error", "message": f"청크 처리 실패: {exc}"})

    except WebSocketDisconnect:
        logger.info("[ws/rhythm] 클라이언트 연결 해제")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
