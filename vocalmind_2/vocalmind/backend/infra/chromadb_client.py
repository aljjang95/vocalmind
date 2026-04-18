"""ChromaDB 클라이언트 싱글톤 — 매호출 생성 대신 모듈 레벨에서 1회 초기화."""
from __future__ import annotations

import logging
import os

import chromadb

logger = logging.getLogger(__name__)

CHROMA_DB_PATH = os.environ.get(
    "CHROMA_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db"),
)

_client: chromadb.PersistentClient | None = None


def get_client() -> chromadb.PersistentClient:
    """ChromaDB PersistentClient 반환 (lazy 싱글톤)."""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    return _client


def search(collection_name: str, query: str, n_results: int = 3, include: list[str] | None = None) -> dict:
    """컬렉션에서 쿼리 검색. 실패 시 빈 결과 반환."""
    include = include or ["documents"]
    try:
        client = get_client()
        collection = client.get_collection(collection_name)
        return collection.query(query_texts=[query], n_results=n_results, include=include)
    except Exception as e:
        logger.warning("ChromaDB %s 검색 실패: %s", collection_name, e)
        return {"documents": [[]], "metadatas": [[]]}
