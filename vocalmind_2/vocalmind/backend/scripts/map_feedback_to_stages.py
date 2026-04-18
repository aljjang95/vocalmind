"""ChromaDB vocal_feedback 1850개를 28단계에 자동 매핑.

실행: cd backend && python scripts/map_feedback_to_stages.py
출력: backend/data/stage_feedback_map.json
"""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path

import chromadb

# 28단계 키워드 (name + 핵심 개념)
STAGE_KEYWORDS: dict[int, dict[str, str]] = {
    1: {"name": "설근 안정화", "keywords": "혀뿌리 이완 설근 tongue root 편안 열린"},
    2: {"name": "후두 안정화", "keywords": "후두 larynx 안정 상승 목 이완"},
    3: {"name": "턱 이완 발성", "keywords": "턱 jaw 이완 열림 떨어뜨리기"},
    4: {"name": "호흡 연결 기초", "keywords": "호흡 breath 복식 횡격막 배 지지"},
    5: {"name": "모음 정렬", "keywords": "모음 vowel 아에이오우 정렬 포먼트"},
    6: {"name": "허밍 안정화", "keywords": "허밍 humming 비강 공명 resonance"},
    7: {"name": "가벼운 성대 접촉", "keywords": "성대 접촉 onset 가벼운 시작 vocal fold"},
    8: {"name": "중음역 안정", "keywords": "중음역 mid range 안정 편안"},
    9: {"name": "반폐모음 스케일", "keywords": "반폐모음 semi-closed 입술 트릴 lip trill"},
    10: {"name": "저음역 확장", "keywords": "저음 low register 확장 chest voice"},
    11: {"name": "고음역 진입", "keywords": "고음 high note 올라가기 상승 head voice"},
    12: {"name": "성구 전환 기초", "keywords": "성구 전환 register break passaggio 브릿지"},
    13: {"name": "성구 전환 심화", "keywords": "성구 전환 mix 믹스 혼합 bridge passage"},
    14: {"name": "비브라토 기초", "keywords": "비브라토 vibrato 떨림 자연스러운"},
    15: {"name": "다이나믹 조절", "keywords": "다이나믹 dynamic 강약 크레센도 데크레센도 볼륨"},
    16: {"name": "프레이즈 연결", "keywords": "프레이즈 phrase 레가토 legato 연결 끊김"},
    17: {"name": "자음 연결 발성", "keywords": "자음 consonant 받침 연결 발음 diction"},
    18: {"name": "감정 전달 기초", "keywords": "감정 emotion 표현 느낌 전달"},
    19: {"name": "벨팅 기초", "keywords": "벨팅 belt 파워 강한 chest pull mix"},
    20: {"name": "팔세토 활용", "keywords": "팔세토 falsetto 가성 head voice 가볍"},
    21: {"name": "혼합 발성", "keywords": "혼합 mix voice 믹스보이스 중간"},
    22: {"name": "음정 정확도", "keywords": "음정 pitch 정확 intonation 음감"},
    23: {"name": "리듬 정확도", "keywords": "리듬 rhythm 박자 timing 템포"},
    24: {"name": "고급 호흡 테크닉", "keywords": "호흡 고급 appoggio 지지 breath support"},
    25: {"name": "음색 조절", "keywords": "음색 tone color timbre 밝은 어두운"},
    26: {"name": "실전 곡 적용 1", "keywords": "곡 적용 song 실전 노래 가사"},
    27: {"name": "실전 곡 적용 2", "keywords": "곡 적용 심화 interpretation 해석 스타일"},
    28: {"name": "종합 평가", "keywords": "종합 총정리 평가 final 마무리"},
}

def main() -> None:
    chroma_path = os.environ.get(
        "CHROMA_DB_PATH",
        str(Path(__file__).parent.parent / "chroma_db"),
    )

    print(f"ChromaDB path: {chroma_path}")

    try:
        client = chromadb.PersistentClient(path=chroma_path)
        collection = client.get_collection("vocal_feedback")
    except Exception as e:
        print(f"ERROR: ChromaDB 연결 실패 — {e}", file=sys.stderr)
        sys.exit(1)

    total_count = collection.count()
    if total_count == 0:
        print("WARNING: vocal_feedback 컬렉션이 비어있습니다.", file=sys.stderr)
        sys.exit(1)

    print(f"피드백 총 {total_count}개 확인")

    # 각 단계의 키워드를 query로 유사도 검색
    stage_map: dict[str, dict] = {}
    assigned: set[str] = set()

    for stage_id, info in STAGE_KEYWORDS.items():
        query_text = f"{info['name']} {info['keywords']}"
        results = collection.query(
            query_texts=[query_text],
            n_results=min(100, total_count),
            include=["metadatas"],
        )

        result_ids = results.get("ids", [[]])[0]

        feedback_ids: list[str] = []
        for rid in result_ids:
            if rid not in assigned:
                feedback_ids.append(rid)
                assigned.add(rid)
            if len(feedback_ids) >= 50:  # 단계당 최대 50개
                break

        stage_map[str(stage_id)] = {
            "stage_name": info["name"],
            "feedback_ids": feedback_ids,
            "count": len(feedback_ids),
        }
        print(f"  Stage {stage_id:2d} ({info['name']}): {len(feedback_ids)}개 매핑")

    # 미분류: 전체 ID를 peek로 수집
    all_ids: list[str] = []
    batch_size = 100
    offset = 0
    while offset < total_count:
        batch = collection.peek(limit=min(batch_size, total_count - offset))
        all_ids.extend(batch["ids"])
        if len(batch["ids"]) < batch_size:
            break
        offset += batch_size

    # peek가 중복 반환할 수 있으므로 unique 처리
    all_unique = list(dict.fromkeys(all_ids))
    unassigned = [fid for fid in all_unique if fid not in assigned]

    # assigned 기준 미분류 추정
    total_assigned = len(assigned)
    estimated_unassigned = total_count - total_assigned
    stage_map["unassigned"] = {
        "stage_name": "미분류",
        "feedback_ids": unassigned[:100],  # 샘플만 저장
        "count": max(estimated_unassigned, len(unassigned)),
    }

    unassigned_pct = (estimated_unassigned / total_count * 100) if total_count > 0 else 0
    print(f"\n전체: {total_count}개, 분류: {total_assigned}개, 미분류: ~{estimated_unassigned}개 ({unassigned_pct:.1f}%)")

    # 저장
    out_dir = Path(__file__).parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "stage_feedback_map.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stage_map, f, ensure_ascii=False, indent=2)

    print(f"\n저장 완료: {out_path}")


if __name__ == "__main__":
    main()
