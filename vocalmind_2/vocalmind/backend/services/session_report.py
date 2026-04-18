"""세션 종료 후 Claude Haiku 종합 리포트 생성."""
from __future__ import annotations
import logging
import infra.anthropic_client as ai
from services.realtime_analyzer import SessionAccumulator

logger = logging.getLogger(__name__)

SESSION_REPORT_SYSTEM = """당신은 감각 기반 보컬 코치입니다. 학생의 연습 세션 데이터를 분석하여 종합 피드백을 제공합니다.

## 핵심 원칙
1. 감각 언어 사용: "배에 힘을 줘" ❌ → "배에 압력이 형성된 거예요" ✅
2. 부드러운 교정: "목에 힘 주지 마" ❌ → "목에 힘 빼는 감각을 느껴봐" ✅
3. 구체적 관찰: 숫자나 데이터를 감각적 표현으로 변환
4. 긍정 강화: 개선된 부분을 먼저 언급

## 답변 형식 (JSON)
{"summary": "세션 전체 요약 2~3문장", "improvements": "잘된 점 1~2문장", "focus_area": "다음에 집중할 부분 1~2문장", "exercise": "추천 연습 1문장", "encouragement": "마무리 격려 1문장"}
"""


def generate_session_report(accumulator: SessionAccumulator) -> dict:
    """세션 누적 데이터로 Claude Haiku 종합 리포트 생성."""
    stats = accumulator.summary_stats()

    if stats["chunk_count"] == 0:
        return {
            "summary": "녹음 데이터가 충분하지 않아요.",
            "improvements": "",
            "focus_area": "다시 녹음해볼까요?",
            "exercise": "편안하게 '음~' 허밍부터 시작해보세요.",
            "encouragement": "괜찮아요, 천천히 해봐요!",
        }

    # 긴장 추이 (시간순)
    tension_trend = [round(s.overall, 1) for s in accumulator.scores]
    improving = len(tension_trend) >= 3 and tension_trend[-1] < tension_trend[0]

    user_prompt = f"""학생 세션 데이터:
- 단계: {accumulator.stage_id}단계
- 분석 횟수: {stats['chunk_count']}회 (2초 간격)
- 평균 긴장도: {stats['avg_tension']}/100
- 최대 긴장도: {stats['max_tension']}/100
- 최소 긴장도: {stats['min_tension']}/100
- 긴장 감지 횟수: {stats['tension_events']}회
- 주요 긴장 부위: {', '.join(stats['main_issues']) if stats['main_issues'] else '없음'}
- 긴장도 추이: {tension_trend[:15]}{'...' if len(tension_trend) > 15 else ''}
- 시간에 따라 개선됨: {'예' if improving else '아니오'}

위 데이터를 바탕으로 감각 기반 종합 피드백을 JSON으로 제공해주세요."""

    try:
        result = ai.complete_json(
            SESSION_REPORT_SYSTEM,
            [{"role": "user", "content": user_prompt}],
            max_tokens=400,
        )
        if result:
            return result
    except Exception as e:
        logger.warning("세션 리포트 생성 실패: %s", e)

    # 폴백: 템플릿 기반
    main = stats["main_issues"]
    area = f"{', '.join(main)} 부분" if main else "전반적인 이완"
    return {
        "summary": f"총 {stats['chunk_count']}구간 분석, 평균 긴장도 {stats['avg_tension']}점이에요.",
        "improvements": "꾸준히 연습하는 것 자체가 좋은 신호예요." if not improving else "시간이 갈수록 긴장이 줄어들고 있어요!",
        "focus_area": f"다음엔 {area}에 집중해보세요.",
        "exercise": "편안한 허밍으로 시작해서 천천히 음을 올려보세요.",
        "encouragement": "오늘도 수고했어요! 매일 조금씩 나아지고 있어요.",
    }
