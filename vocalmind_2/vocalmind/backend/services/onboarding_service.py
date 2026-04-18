"""온보딩 AI 상담 서비스 — Claude Haiku 기반 긴장 분석 + 로드맵 생성."""
from __future__ import annotations
import logging
import infra.anthropic_client as ai
from models.tension import TensionScore

logger = logging.getLogger(__name__)

ONBOARDING_SYSTEM = """당신은 10년 경력의 보컬 트레이너입니다. 학생의 첫 녹음 분석 결과를 바탕으로 현재 문제점과 학습 로드맵을 제안합니다.

## 말투
- 선생님 말투: 따뜻하지만 전문적
- 감각 기반 표현: "목에 힘 빼세요" ❌ → "목이 편안해지는 감각을 찾아봐요" ✅
- 구체적 관찰: 숫자를 감각으로 변환

## 8블록 커리큘럼 구조
블록1 (1~3단계): 이완 기초 — 설근 안정화, 후두 안정, 허밍
블록2 (4~6단계): 호흡/허밍 — 복식호흡, 연결 호흡, 프레이즈 호흡
블록3 (7~10단계): 모음/발음 — 모음 라운딩, 모음 연결, 자음 발음, 자연 발음
블록4 (11~14단계): 공명/발성 — 공명 포인트, 두성 밸런스, 성량 조절, 고음 접근
블록5 (15~18단계): 가창 기초 — 프레이즈 연결, 감정 표현, 다이나믹, 가창 통합
블록6 (19~21단계): 세팅 심화 — 성대 세팅, 벨팅 기초, 믹스보이스
블록7 (22~25단계): 고급 테크닉 — 고음 안정, 비브라토, 런/리프, 페이크
블록8 (26~28단계): 가창 마스터 — 장르 적용, 무대 표현, 종합 평가

## 추천 로직
- 긴장도 높음(>60): 1단계부터 시작 (이완 기초가 최우선)
- 긴장도 중간(30~60): 7단계부터 시작 (기초는 있으니 모음/발음부터)
- 긴장도 낮음(<30): 11단계부터 시작 (공명/발성으로 바로 진행)

## 답변 형식 (반드시 JSON)
{"problems": ["문제점1", "문제점2", "문제점3"], "roadmap": ["1단계: 구체적 계획", "2단계: 구체적 계획", "3단계: 구체적 계획"], "suggested_stage_id": 숫자, "summary": "전체 요약 2~3문장"}
"""


async def generate_consultation(tension_score: TensionScore) -> dict:
    """4축 긴장 분석 결과를 바탕으로 AI 상담 결과 생성.

    Returns:
        dict with keys: problems, roadmap, suggested_stage_id, summary
    """
    user_prompt = f"""학생의 첫 녹음 분석 결과입니다:

- 종합 긴장도: {tension_score.overall}/100
- 후두 긴장: {tension_score.laryngeal_tension}/100
- 혀뿌리 긴장: {tension_score.tongue_root_tension}/100
- 턱 긴장: {tension_score.jaw_tension}/100
- 성구 전환: {tension_score.register_break}/100
- 긴장 감지: {'예' if tension_score.tension_detected else '아니오'}
- 상세: {tension_score.detail or '특이사항 없음'}

위 데이터를 바탕으로 문제점, 학습 로드맵, 추천 시작 단계를 JSON으로 제공해주세요."""

    try:
        result = ai.complete_json(
            ONBOARDING_SYSTEM,
            [{"role": "user", "content": user_prompt}],
            required_keys=["problems", "roadmap", "suggested_stage_id", "summary"],
        )
        if result:
            return result
    except Exception as e:
        logger.warning("온보딩 상담 생성 실패: %s", e)

    # 폴백: 템플릿 기반 응답
    return _fallback_consultation(tension_score)


def _fallback_consultation(tension_score: TensionScore) -> dict:
    """Claude 호출 실패 시 템플릿 기반 응답."""
    problems: list[str] = []
    if tension_score.laryngeal_tension > 50:
        problems.append("후두 주변에 긴장이 감지돼요. 소리를 낼 때 목이 조이는 느낌이 있을 수 있어요.")
    if tension_score.tongue_root_tension > 50:
        problems.append("혀뿌리에 힘이 들어가고 있어요. 모음 소리가 답답하게 느껴질 수 있어요.")
    if tension_score.jaw_tension > 50:
        problems.append("턱에 불필요한 힘이 들어가고 있어요. 입을 열 때 뻣뻣한 느낌이 있을 거예요.")
    if tension_score.register_break > 50:
        problems.append("성구 전환 구간에서 소리가 끊기는 현상이 있어요.")
    if not problems:
        problems.append("전반적으로 안정적이에요. 세부 테크닉을 다듬어볼 차례예요.")

    if tension_score.overall > 60:
        stage = 1
        roadmap = [
            "1~3단계: 이완 기초부터 차근차근 시작해요",
            "4~6단계: 호흡과 허밍으로 편안한 발성 습관을 만들어요",
            "7단계 이후: 기초가 잡히면 모음과 발음 연습으로 넘어가요",
        ]
        summary = "긴장도가 높은 편이에요. 이완 기초부터 시작하면 빠르게 좋아질 거예요."
    elif tension_score.overall > 30:
        stage = 7
        roadmap = [
            "7~10단계: 모음과 발음의 기초를 다져요",
            "11~14단계: 공명과 발성을 확장해요",
            "15단계 이후: 가창 기초로 넘어가요",
        ]
        summary = "기초적인 이완은 되어 있어요. 모음과 발음부터 시작하면 효율적이에요."
    else:
        stage = 11
        roadmap = [
            "11~14단계: 공명과 발성의 깊이를 더해요",
            "15~18단계: 가창 기초를 익혀요",
            "19단계 이후: 세팅 심화로 넘어가요",
        ]
        summary = "이완과 기초가 잘 잡혀 있어요. 공명과 발성부터 바로 시작해도 좋아요."

    return {
        "problems": problems,
        "roadmap": roadmap,
        "suggested_stage_id": stage,
        "summary": summary,
    }
