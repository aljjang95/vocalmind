"""ChromaDB 매핑 스크립트 테스트."""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_collection():
    coll = MagicMock()
    coll.count.return_value = 10
    # 10개 피드백 mock
    coll.peek.return_value = {
        "ids": [f"fb_{i}" for i in range(10)],
        "documents": [f"피드백 텍스트 {i}" for i in range(10)],
        "metadatas": [{"video_id": "vid1", "timestamp": float(i * 10)} for i in range(10)],
    }
    # query: 처음 호출에 첫 3개 반환, 이후는 다른 ID
    call_count = {"n": 0}

    def fake_query(**kwargs):
        start = call_count["n"] * 3
        call_count["n"] += 1
        ids = [f"fb_{(start + j) % 10}" for j in range(min(3, 10))]
        return {
            "ids": [ids],
            "documents": [["doc"] * len(ids)],
            "metadatas": [[{"video_id": "vid1", "timestamp": 0.0}] * len(ids)],
        }

    coll.query.side_effect = fake_query
    return coll


@patch("chromadb.PersistentClient")
def test_map_creates_json(mock_client_cls, mock_collection, tmp_path, monkeypatch):
    mock_client = MagicMock()
    mock_client.get_collection.return_value = mock_collection
    mock_client_cls.return_value = mock_client

    # scripts 모듈의 __file__ 경로를 tmp_path로 변경하여 출력 파일 위치 제어
    import scripts.map_feedback_to_stages as mapper

    monkeypatch.setattr(mapper, "STAGE_KEYWORDS", {
        1: {"name": "테스트1", "keywords": "키워드1"},
        2: {"name": "테스트2", "keywords": "키워드2"},
    })

    # Path 패치: 출력 디렉토리를 tmp_path로
    original_main = mapper.main

    def patched_main():
        import builtins
        original_open = builtins.open

        def open_redirect(path, *args, **kwargs):
            p = Path(path)
            if p.name == "stage_feedback_map.json":
                return original_open(tmp_path / "stage_feedback_map.json", *args, **kwargs)
            return original_open(path, *args, **kwargs)

        monkeypatch.setattr(builtins, "open", open_redirect)

        # data 디렉토리 존재 설정
        monkeypatch.setenv("CHROMA_DB_PATH", str(tmp_path))
        original_main()

    patched_main()

    out_file = tmp_path / "stage_feedback_map.json"
    assert out_file.exists()

    data = json.loads(out_file.read_text(encoding="utf-8"))
    assert "1" in data
    assert "2" in data
    assert "unassigned" in data
    assert data["1"]["stage_name"] == "테스트1"
    assert isinstance(data["1"]["feedback_ids"], list)


def test_stage_keywords_cover_28():
    from scripts.map_feedback_to_stages import STAGE_KEYWORDS
    assert len(STAGE_KEYWORDS) == 28
    for i in range(1, 29):
        assert i in STAGE_KEYWORDS
        assert "name" in STAGE_KEYWORDS[i]
        assert "keywords" in STAGE_KEYWORDS[i]
