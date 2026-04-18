import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")

@pytest.mark.asyncio
async def test_coach_requires_stage_id(client):
    resp = await client.post("/coach", json={})
    assert resp.status_code == 422

@pytest.mark.asyncio
async def test_coach_returns_feedback(client, monkeypatch):
    import services.rag_service as rag_svc
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", lambda **kw: {
        "feedback": "턱을 편하게 내려놓는 감각을 유지해보세요.",
        "next_exercise": "허밍으로 같은 음을 다시 해볼까요?",
        "encouragement": "좋아요, 방향이 맞아요!",
        "references": [],
    })
    resp = await client.post("/coach", json={
        "stage_id": 3, "user_message": "모음 전환할 때 목이 긴장돼요",
        "score": 65, "pitch_accuracy": 70,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "feedback" in data and "next_exercise" in data

@pytest.mark.asyncio
async def test_coach_returns_encouragement(client, monkeypatch):
    import services.rag_service as rag_svc
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", lambda **kw: {
        "feedback": "호흡이 안정적으로 흐르는 감각이 느껴지시나요?",
        "next_exercise": "같은 음을 모음 'ㅏ'로 다시 해볼까요?",
        "encouragement": "정말 잘하고 있어요!",
        "references": [],
    })
    resp = await client.post("/coach", json={"stage_id": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert "encouragement" in data
    assert len(data["encouragement"]) > 0

@pytest.mark.asyncio
async def test_coach_default_values(client, monkeypatch):
    import services.rag_service as rag_svc
    captured = {}
    def fake_feedback(**kw):
        captured.update(kw)
        return {
            "feedback": "기본값 테스트",
            "next_exercise": "다시 해볼까요?",
            "encouragement": "잘했어요!",
            "references": [],
        }
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", fake_feedback)
    resp = await client.post("/coach", json={"stage_id": 5})
    assert resp.status_code == 200
    assert captured["user_message"] == ""
    assert captured["score"] == 0
    assert captured["pitch_accuracy"] == 0

@pytest.mark.asyncio
async def test_coach_invalid_body_type(client):
    resp = await client.post("/coach", json={"stage_id": "not_an_int"})
    assert resp.status_code == 422

@pytest.mark.asyncio
async def test_coach_with_tension_detail(client, monkeypatch):
    import services.rag_service as rag_svc
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", lambda **kw: {
        "feedback": "혀뿌리에 긴장이 들어가면서 연결이 끊기고 있어요.",
        "next_exercise": "턱을 중력에 의해 떨어트리는 감각을 유지해보세요.",
        "encouragement": "방향은 맞아요!",
        "references": [],
    })
    resp = await client.post("/coach", json={
        "stage_id": 5, "user_message": "고음에서 갈라져요",
        "score": 55, "pitch_accuracy": 60, "tension_detail": "후두 긴장, 성구전환 끊김"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "feedback" in data

@pytest.mark.asyncio
async def test_coach_tension_detail_passed_to_service(client, monkeypatch):
    import services.rag_service as rag_svc
    captured = {}
    def fake_feedback(**kw):
        captured.update(kw)
        return {
            "feedback": "긴장 피드백",
            "next_exercise": "연습 제안",
            "encouragement": "잘하고 있어요!",
            "references": [],
        }
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", fake_feedback)
    resp = await client.post("/coach", json={
        "stage_id": 3, "user_message": "목이 조여요",
        "score": 70, "pitch_accuracy": 75, "tension_detail": "성대 과압축, 후두 긴장"
    })
    assert resp.status_code == 200
    assert captured["tension_detail"] == "성대 과압축, 후두 긴장"

@pytest.mark.asyncio
async def test_coach_tension_detail_optional(client, monkeypatch):
    import services.rag_service as rag_svc
    captured = {}
    def fake_feedback(**kw):
        captured.update(kw)
        return {
            "feedback": "기본 피드백",
            "next_exercise": "연습",
            "encouragement": "좋아요!",
            "references": [],
        }
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", fake_feedback)
    resp = await client.post("/coach", json={"stage_id": 2})
    assert resp.status_code == 200
    assert captured["tension_detail"] == ""

@pytest.mark.asyncio
async def test_coach_low_score_feedback(client, monkeypatch):
    import services.rag_service as rag_svc
    captured = {}
    def fake_feedback(**kw):
        captured.update(kw)
        return {
            "feedback": "아직 연습이 필요해요, 천천히 해보세요.",
            "next_exercise": "허밍부터 다시 시작해볼까요?",
            "encouragement": "처음엔 누구나 어려워요!",
            "references": [],
        }
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", fake_feedback)
    resp = await client.post("/coach", json={
        "stage_id": 2, "user_message": "어렵네요", "score": 10, "pitch_accuracy": 20,
    })
    assert resp.status_code == 200
    assert captured["score"] == 10
    assert captured["pitch_accuracy"] == 20

@pytest.mark.asyncio
async def test_coach_returns_references(client, monkeypatch):
    import services.rag_service as rag_svc
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", lambda **kw: {
        "feedback": "참고 영상이 있어요.",
        "next_exercise": "영상을 보고 따라해보세요.",
        "encouragement": "잘하고 있어요!",
        "references": [
            {"video_id": "abc123", "timestamp": 120.0},
            {"video_id": "def456", "timestamp": 45.5},
        ],
    })
    resp = await client.post("/coach", json={"stage_id": 3, "user_message": "도움이 필요해요"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["references"]) == 2
    assert data["references"][0]["video_id"] == "abc123"
    assert data["references"][0]["timestamp"] == 120.0

@pytest.mark.asyncio
async def test_coach_empty_references(client, monkeypatch):
    import services.rag_service as rag_svc
    monkeypatch.setattr(rag_svc, "get_coaching_feedback", lambda **kw: {
        "feedback": "피드백",
        "next_exercise": "연습",
        "encouragement": "좋아요!",
        "references": [],
    })
    resp = await client.post("/coach", json={"stage_id": 1})
    assert resp.status_code == 200
    assert resp.json()["references"] == []
