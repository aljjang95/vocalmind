"""WebSocket /ws/evaluate — 실시간 오디오 스트림 분석."""
from __future__ import annotations
import json
import logging
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from services.realtime_analyzer import (
    SessionAccumulator,
    analyze_chunk,
    convert_chunk_to_wav,
    extract_avg_pitch,
    get_somatic_feedback,
)
from services.session_report import generate_session_report

logger = logging.getLogger(__name__)
router = APIRouter()

# NOTE(Phase 10): WebSocket auth 한계
# HTTP 헤더 기반 인증은 WebSocket 핸드셰이크에서 브라우저가 지원하지 않음.
# 현재는 query param `token`(JWT)을 수신하고 경고를 기록함.
# Phase 10(React Native 전환) 시 Supabase realtime 또는 signed URL 방식으로 교체 예정.


@router.websocket("/ws/evaluate")
async def ws_evaluate(ws: WebSocket, token: str | None = Query(default=None)):
    """실시간 음성 분석 WebSocket.

    클라이언트 → 서버 메시지:
      - binary: 오디오 청크 (WebM)
      - text JSON: {"type": "start", "stage_id": 1} 또는 {"type": "end"}

    서버 → 클라이언트 메시지 (JSON):
      - {"type": "analysis", "tension": {...}, "feedback": "...", "chunk_index": N}
      - {"type": "report", ...종합 리포트...}
      - {"type": "error", "message": "..."}
    """
    await ws.accept()

    # 토큰 존재 여부만 검증 (실제 JWT 검증은 Phase 10에서 구현)
    if not token:
        logger.warning("[ws/evaluate] 인증 토큰 없이 연결됨 — Phase 10에서 강제 인증 예정")
    else:
        logger.info("[ws/evaluate] 토큰 포함 연결 (token 길이=%d)", len(token))

    session = SessionAccumulator()
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        while True:
            message = await ws.receive()

            # 텍스트 메시지: start/end 제어
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except (json.JSONDecodeError, TypeError):
                    await ws.send_json({"type": "error", "message": "잘못된 메시지 형식"})
                    continue
                msg_type = data.get("type", "")

                if msg_type == "start":
                    session = SessionAccumulator(stage_id=data.get("stage_id", 0))
                    await ws.send_json({"type": "started", "stage_id": session.stage_id})

                elif msg_type == "end":
                    # 세션 종료 → 종합 리포트
                    report = generate_session_report(session)
                    report["type"] = "report"
                    report["stats"] = session.summary_stats()
                    await ws.send_json(report)
                    break

            # 바이너리 메시지: 오디오 청크
            elif "bytes" in message:
                chunk_data = message["bytes"]
                if not chunk_data:
                    continue

                try:
                    wav_path = convert_chunk_to_wav(chunk_data, tmp_dir)
                    score = analyze_chunk(wav_path)
                    avg_pitch = extract_avg_pitch(wav_path)
                    wav_path.unlink(missing_ok=True)

                    if score:
                        feedback = get_somatic_feedback(score, session.chunk_count)
                        session.add(score, feedback, pitch=avg_pitch)
                        await ws.send_json({
                            "type": "analysis",
                            "chunk_index": session.chunk_count,
                            "avg_pitch_hz": avg_pitch,
                            "tension": {
                                "overall": score.overall,
                                "laryngeal": score.laryngeal_tension,
                                "tongue_root": score.tongue_root_tension,
                                "jaw": score.jaw_tension,
                                "register_break": score.register_break,
                                "detected": score.tension_detected,
                                "detail": score.detail,
                            },
                            "feedback": feedback,
                        })
                    else:
                        await ws.send_json({
                            "type": "analysis",
                            "chunk_index": session.chunk_count,
                            "avg_pitch_hz": avg_pitch,
                            "tension": None,
                            "feedback": "음성이 감지되지 않았어요. 마이크를 확인해보세요.",
                        })

                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"청크 분석 실패: {e}"})

    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
