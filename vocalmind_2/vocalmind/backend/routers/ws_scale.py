"""WebSocket /ws/scale-practice — 스케일 연습 실시간 분석 + TTS 음성."""
from __future__ import annotations
import json
import logging
import shutil
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.realtime_analyzer import (
    SessionAccumulator,
    analyze_chunk,
    convert_chunk_to_wav,
    get_somatic_feedback,
)
from services.session_report import generate_session_report
from services.voice_feedback import synthesize_feedback
from services.rag_service import get_coaching_feedback

router = APIRouter()


@router.websocket("/ws/scale-practice")
async def ws_scale_practice(ws: WebSocket):
    """스케일 연습 실시간 분석 WebSocket.

    클라이언트 → 서버:
      text: {"type": "start", "stage_id": N, "feedback_mode": "quiet|gentle|active"}
      text: {"type": "end"}
      binary: 오디오 청크 (WebM)

    서버 → 클라이언트:
      {"type": "started", "stage_id": N}
      {"type": "analysis", "tension": {...}, "feedback": "..."} (gentle/active)
      binary: MP3 음성 (active 모드에서 analysis 직후)
      {"type": "report", ...}
      binary: MP3 리포트 음성
    """
    await ws.accept()
    session = SessionAccumulator()
    feedback_mode = "quiet"
    stage_id = 0
    tmp_dir = Path(tempfile.mkdtemp())
    last_feedback = ""
    same_feedback_count = 0

    try:
        while True:
            message = await ws.receive()

            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except (json.JSONDecodeError, TypeError):
                    await ws.send_json({"type": "error", "message": "잘못된 메시지 형식"})
                    continue
                msg_type = data.get("type", "")

                if msg_type == "start":
                    stage_id = data.get("stage_id", 0)
                    feedback_mode = data.get("feedback_mode", "quiet")
                    session = SessionAccumulator(stage_id=stage_id)
                    await ws.send_json({"type": "started", "stage_id": stage_id})

                elif msg_type == "end":
                    # 종합 리포트
                    report = generate_session_report(session)
                    report["type"] = "report"
                    report["stats"] = session.summary_stats()
                    await ws.send_json(report)

                    # 리포트 음성 (모든 모드)
                    summary_text = report.get("summary", "")
                    if summary_text:
                        voice_bytes = await synthesize_feedback(summary_text)
                        if voice_bytes:
                            await ws.send_bytes(voice_bytes)
                    break

            elif "bytes" in message:
                chunk_data = message["bytes"]
                if not chunk_data:
                    continue

                try:
                    wav_path = convert_chunk_to_wav(chunk_data, tmp_dir)
                    score = analyze_chunk(wav_path)
                    wav_path.unlink(missing_ok=True)

                    if not score:
                        continue

                    feedback = get_somatic_feedback(score, session.chunk_count)
                    session.add(score, feedback)

                    # quiet: 분석만, UI 전송 안 함
                    if feedback_mode == "quiet":
                        continue

                    # gentle/active: 분석 결과 전송
                    # active 모드에서 Claude RAG 피드백 생성
                    if feedback_mode == "active" and score.tension_detected:
                        try:
                            rag = get_coaching_feedback(
                                stage_id, f"스케일 연습 중 {score.detail}",
                                0, 0, score.detail,
                            )
                            feedback = rag.get("feedback", feedback)
                        except Exception:
                            pass  # RAG 실패 시 템플릿 피드백 유지

                    await ws.send_json({
                        "type": "analysis",
                        "chunk_index": session.chunk_count,
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

                    # active: 음성 피드백 전송
                    if feedback_mode == "active":
                        # 같은 피드백 연속 3회 → 생략
                        if feedback == last_feedback:
                            same_feedback_count += 1
                        else:
                            same_feedback_count = 0
                            last_feedback = feedback

                        if same_feedback_count < 3:
                            voice_bytes = await synthesize_feedback(feedback)
                            if voice_bytes:
                                await ws.send_bytes(voice_bytes)

                except Exception:
                    logger.warning("[ws/scale] 청크 분석 실패", exc_info=True)

    except WebSocketDisconnect:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
