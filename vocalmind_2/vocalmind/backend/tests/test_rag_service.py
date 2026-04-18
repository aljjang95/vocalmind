"""rag_service 테스트 — ChromaDB + Anthropic 모킹."""
from __future__ import annotations
import json
from unittest.mock import patch, MagicMock


class TestGetChromaContext:
    """_get_chroma_context 테스트."""

    def test_returns_documents_joined(self):
        """ChromaDB에서 문서를 찾으면 '---'으로 합쳐 반환."""
        mock_results = {
            "documents": [["문서1 내용", "문서2 내용", "문서3 내용"]],
            "metadatas": [[]],
        }
        with patch("services.rag_service.chroma") as mock_chroma:
            mock_chroma.search.return_value = mock_results
            from services.rag_service import _get_chroma_context
            result = _get_chroma_context("허밍 연습")

        assert "문서1 내용" in result
        assert "문서2 내용" in result
        assert "---" in result

    def test_returns_empty_string_on_no_documents(self):
        """ChromaDB 결과가 빈 리스트면 빈 문자열 반환."""
        mock_results = {"documents": [[]], "metadatas": [[]]}
        with patch("services.rag_service.chroma") as mock_chroma:
            mock_chroma.search.return_value = mock_results
            from services.rag_service import _get_chroma_context
            result = _get_chroma_context("존재하지 않는 쿼리")

        assert result == ""

    def test_returns_empty_string_on_exception(self):
        """ChromaDB 연결 실패 시 빈 문자열 반환 (에러 안남)."""
        with patch("services.rag_service.chroma") as mock_chroma:
            mock_chroma.search.side_effect = Exception("connection failed")
            from services.rag_service import _get_chroma_context
            result = _get_chroma_context("쿼리")

        assert result == ""


class TestGetCoachingFeedback:
    """get_coaching_feedback 테스트."""

    def test_valid_json_response_parsed(self):
        """Claude가 올바른 JSON 반환 시 파싱하여 dict 반환."""
        expected = {
            "feedback": "허밍할 때 코 뒤쪽이 울리는 감각을 느껴보세요.",
            "next_exercise": "같은 음에서 입을 살짝 열어보세요.",
            "encouragement": "좋은 시작이에요!",
        }
        with patch("services.rag_service._get_chroma_context", return_value="참고 자료"):
            with patch("services.rag_service.ai") as mock_ai:
                mock_ai.complete_json.return_value = expected

                from services.rag_service import get_coaching_feedback
                result = get_coaching_feedback(
                    stage_id=3,
                    user_message="목이 조이는 느낌이에요",
                    score=65,
                    pitch_accuracy=70,
                    tension_detail="후두 긴장 55점",
                )

        assert result["feedback"] == expected["feedback"]
        assert result["next_exercise"] == expected["next_exercise"]
        assert result["encouragement"] == expected["encouragement"]

    def test_invalid_json_response_uses_fallback(self):
        """Claude가 JSON 파싱 실패 시 폴백 딕셔너리 반환."""
        with patch("services.rag_service._get_chroma_context", return_value=""):
            with patch("services.rag_service.ai") as mock_ai:
                mock_ai.complete_json.return_value = None
                mock_ai.complete.return_value = "이것은 JSON이 아닌 일반 텍스트 응답입니다."

                from services.rag_service import get_coaching_feedback
                result = get_coaching_feedback(
                    stage_id=1,
                    user_message="처음이에요",
                    score=50,
                    pitch_accuracy=40,
                )

        assert "feedback" in result
        assert result["next_exercise"] == "천천히 다시 한번 해볼까요?"
        assert result["encouragement"] == "잘하고 있어요!"

    def test_tension_detail_included_in_query(self):
        """tension_detail이 있으면 검색 쿼리에 포함."""
        expected = {"feedback": "ok", "next_exercise": "ok", "encouragement": "ok"}
        with patch("services.rag_service._get_chroma_context", return_value="") as mock_ctx:
            with patch("services.rag_service.ai") as mock_ai:
                mock_ai.complete_json.return_value = expected

                from services.rag_service import get_coaching_feedback
                get_coaching_feedback(
                    stage_id=5,
                    user_message="소리가 답답해요",
                    score=60,
                    pitch_accuracy=55,
                    tension_detail="혀뿌리 긴장 70점",
                )

        # _get_chroma_context 호출 시 tension_detail이 포함된 쿼리
        call_args = mock_ctx.call_args[0][0]
        assert "혀뿌리 긴장 70점" in call_args

    def test_no_tension_detail_uses_message_only(self):
        """tension_detail이 없으면 user_message만 검색 쿼리로 사용."""
        expected = {"feedback": "ok", "next_exercise": "ok", "encouragement": "ok"}
        with patch("services.rag_service._get_chroma_context", return_value="") as mock_ctx:
            with patch("services.rag_service.ai") as mock_ai:
                mock_ai.complete_json.return_value = expected

                from services.rag_service import get_coaching_feedback
                get_coaching_feedback(
                    stage_id=1,
                    user_message="허밍 연습",
                    score=50,
                    pitch_accuracy=50,
                )

        call_args = mock_ctx.call_args[0][0]
        assert call_args == "허밍 연습"
