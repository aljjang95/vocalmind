"""RAG 기반 감각 코칭 — ChromaDB 검색 + Claude API."""
from __future__ import annotations
import logging

import infra.anthropic_client as ai
import infra.chromadb_client as chroma

logger = logging.getLogger(__name__)

COACHING_SYSTEM = """당신은 감각 기반 보컬 코치입니다.

## 핵심 원칙
1. 결과는 원인의 부산물: "배에 힘을 줘" ❌ → "배에 압력이 형성된 거예요" ✅
2. 부드러운 교정: "목에 힘 주지 마" ❌ → "목에 힘 빼는 감각을 느껴봐" ✅
3. 감각 유도: "~하는 느낌으로 해보세요", "지금 ~가 어때요?"
4. 단계적 접근: 허밍 → 입 열기 → 올라가기 → 가사 붙이기
5. 관찰 질문: "이때 배가 어때?", "목 편하세요?"

## 답변 형식
반드시 다음 JSON만 반환하세요:
{"feedback": "감각 기반 피드백 2~3문장", "next_exercise": "다음 연습 제안 1문장", "encouragement": "긍정 강화 1문장"}
"""

def _get_chroma_context(query: str, n_results: int = 3) -> str:
    """vocal_curriculum 컬렉션에서 개념/기법 검색."""
    try:
        results = chroma.search("vocal_curriculum", query, n_results)
        documents = results.get("documents", [[]])[0]
        return "\n---\n".join(documents) if documents else ""
    except Exception as e:
        logger.warning("ChromaDB curriculum 검색 실패: %s", e)
        return ""

def _get_feedback_context(
    jitter: float, shimmer: float, hnr_db: float, avg_pitch_hz: float, n_results: int = 3,
) -> tuple[str, list[dict]]:
    """vocal_feedback 컬렉션에서 유사 음성 질감 → 실제 선생님 피드백 검색.

    Returns:
        (context_text, references) — references는 [{video_id, timestamp}] 목록.
    """
    try:
        query = f"Jitter={jitter:.3f} Shimmer={shimmer:.3f} HNR={hnr_db:.1f}dB 피치={avg_pitch_hz:.0f}Hz"
        results = chroma.search("vocal_feedback", query, n_results, include=["documents", "metadatas"])
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        # 참고 영상 references 추출 (중복 제거)
        seen: set[str] = set()
        references: list[dict] = []
        for meta in metadatas:
            if not meta:
                continue
            vid = meta.get("video_id")
            ts = meta.get("timestamp")
            if vid and ts is not None:
                key = f"{vid}_{ts}"
                if key not in seen:
                    seen.add(key)
                    references.append({"video_id": vid, "timestamp": float(ts)})

        context = "\n---\n".join(documents) if documents else ""
        return context, references
    except Exception as e:
        logger.warning("ChromaDB feedback 검색 실패: %s", e)
        return "", []

def get_coaching_feedback(
    stage_id: int,
    user_message: str,
    score: int,
    pitch_accuracy: int,
    tension_detail: str = "",
    jitter: float = 0.0,
    shimmer: float = 0.0,
    hnr_db: float = 0.0,
    avg_pitch_hz: float = 0.0,
) -> dict:
    search_query = f"{user_message} {tension_detail}".strip() if tension_detail else user_message
    curriculum_context = _get_chroma_context(search_query)

    # 음성 질감 데이터가 있으면 실제 선생님 피드백 사례 검색
    feedback_context = ""
    references: list[dict] = []
    if jitter > 0 or shimmer > 0 or hnr_db != 0:
        feedback_context, references = _get_feedback_context(jitter, shimmer, hnr_db, avg_pitch_hz)

    tension_section = ""
    if tension_detail:
        tension_section = f"\n- 긴장 부위/상태: {tension_detail}"

    texture_section = ""
    if jitter > 0 or shimmer > 0:
        texture_section = f"\n- 음성 질감: Jitter={jitter:.3f}, Shimmer={shimmer:.3f}, HNR={hnr_db:.1f}dB, 피치={avg_pitch_hz:.0f}Hz"

    context_parts = []
    if curriculum_context:
        context_parts.append(f"[커리큘럼 참고]\n{curriculum_context}")
    if feedback_context:
        context_parts.append(f"[유사 상황 실제 피드백 사례]\n{feedback_context}")
    combined_context = "\n\n".join(context_parts)

    user_prompt = f"""학생 상황:
- 현재 단계: {stage_id}단계
- 채점 결과: 총점 {score}/100, 피치 정확도 {pitch_accuracy}/100
- 학생 메시지: {user_message}{tension_section}{texture_section}

참고 자료:
{combined_context}

위 상황에 맞는 감각 기반 코칭 피드백을 JSON으로 제공해주세요."""

    parsed = ai.complete_json(
        COACHING_SYSTEM,
        [{"role": "user", "content": user_prompt}],
        required_keys=["feedback"],
    )
    result: dict
    if parsed:
        result = parsed
    else:
        text = ai.complete(COACHING_SYSTEM, [{"role": "user", "content": user_prompt}])
        result = {"feedback": text[:200], "next_exercise": "천천히 다시 한번 해볼까요?", "encouragement": "잘하고 있어요!"}
    result["references"] = references
    return result
