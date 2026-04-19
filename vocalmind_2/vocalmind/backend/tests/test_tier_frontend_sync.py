"""프론트-백엔드 STUDIO_TIERS / runware_catalog.TIERS 드리프트 방지 회귀 테스트.

FAILURES.md #2 — imageResolution 동기화 누락 사건 이후 필수 가드.
types/studio.ts 를 텍스트로 파싱(정규식)해 백엔드 TierSpec과 필드별 비교.

불일치 시 즉시 FAIL — '한쪽만 수정하고 다른 쪽은 까먹는' 안티패턴 차단.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from infra.runware_catalog import TIERS, QualityTier


FRONTEND_STUDIO_TS = (
    Path(__file__).resolve().parent.parent.parent / "types" / "studio.ts"
)


def _parse_frontend_tier(tier_name: QualityTier) -> dict:
    """types/studio.ts 의 STUDIO_TIERS 객체에서 지정 티어 블록을 정규식으로 추출."""
    src = FRONTEND_STUDIO_TS.read_text(encoding="utf-8")

    # 티어 블록 — `<name>: {...}` 까지 greedy 하지 않게.
    block_pattern = rf"\b{tier_name}:\s*\{{([^}}]+)\}}"
    m = re.search(block_pattern, src)
    assert m, f"types/studio.ts 에서 {tier_name} 티어 블록을 찾지 못함"
    body = m.group(1)

    def num(field: str) -> float:
        mm = re.search(rf"{field}:\s*([\d_\.]+)", body)
        assert mm, f"{tier_name}.{field} 파싱 실패"
        return float(mm.group(1).replace("_", ""))

    def string(field: str) -> str:
        mm = re.search(rf"{field}:\s*'([^']+)'", body)
        assert mm, f"{tier_name}.{field} 파싱 실패"
        return mm.group(1)

    return {
        "credits": int(num("credits")),
        "priceKrw": int(num("priceKrw")),
        "durationSec": num("durationSec"),
        "sceneCount": int(num("sceneCount")),
        "budgetUsd": num("budgetUsd"),
        "imageResolution": string("imageResolution"),
    }


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_credits_match(tier: QualityTier):
    """크레딧 차감량은 프론트·백엔드가 정확히 일치해야 함 (결제 일관성)."""
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    assert fe["credits"] == be.credits, (
        f"{tier}: frontend {fe['credits']} vs backend {be.credits}. "
        f"types/studio.ts STUDIO_TIERS 또는 runware_catalog TIERS 동기화 필요"
    )


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_price_krw_match(tier: QualityTier):
    """가격(KRW)은 프론트·백엔드가 정확히 일치해야 함."""
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    assert fe["priceKrw"] == be.price_krw, (
        f"{tier}: frontend priceKrw={fe['priceKrw']} vs backend={be.price_krw}"
    )


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_duration_match(tier: QualityTier):
    """영상 길이(초) 일치."""
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    assert fe["durationSec"] == be.duration_sec, (
        f"{tier}: frontend={fe['durationSec']} vs backend={be.duration_sec}"
    )


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_scene_count_match(tier: QualityTier):
    """씬 수 일치."""
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    assert fe["sceneCount"] == be.scene_count, (
        f"{tier}: frontend={fe['sceneCount']} vs backend={be.scene_count}"
    )


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_budget_usd_match(tier: QualityTier):
    """예산 상한(USD) 일치 — 이 값이 자동 환불 결정에 사용됨."""
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    assert fe["budgetUsd"] == be.budget_usd, (
        f"{tier}: frontend={fe['budgetUsd']} vs backend={be.budget_usd}"
    )


def test_avatar_modes_frontend_db_in_sync():
    """AvatarMode — 프론트 타입 / DB CHECK constraint 2곳 일치 검증.

    orchestrator.py에서 avatar_mode를 문자열로 직접 비교하므로 (lipsync 분기 등)
    프론트/DB 중 한 곳이라도 누락되면 런타임 에러 경로 발생.
    """
    src_ts = FRONTEND_STUDIO_TS.read_text(encoding="utf-8")
    m = re.search(r"export type AvatarMode\s*=\s*([^;]+);", src_ts)
    assert m, "types/studio.ts 에서 AvatarMode 타입 파싱 실패"
    frontend_modes = set(re.findall(r"'([^']+)'", m.group(1)))

    migrations_dir = FRONTEND_STUDIO_TS.parent.parent / "supabase" / "migrations"
    # avatar_mode CHECK가 포함된 마이그레이션 찾기
    db_modes = None
    for sql_file in sorted(migrations_dir.glob("*.sql")):
        content = sql_file.read_text(encoding="utf-8")
        m2 = re.search(r"avatar_mode\s+text\s+not\s+null\s+check\s*\(avatar_mode\s+in\s*\(([^)]+)\)", content)
        if m2:
            db_modes = set(re.findall(r"'([^']+)'", m2.group(1)))
            # 최신 정의 기준 — 같은 이름으로 재정의되면 마지막이 유효.
    assert db_modes is not None, "studio_jobs.avatar_mode CHECK constraint를 찾지 못함"

    assert frontend_modes == db_modes, (
        f"AvatarMode 드리프트 — frontend={frontend_modes} db={db_modes}. "
        f"types/studio.ts AvatarMode 타입과 supabase/migrations CHECK 동기화 필요."
    )


def test_style_presets_frontend_backend_db_in_sync():
    """스타일 프리셋 — 프론트 타입 / 백엔드 Literal / DB CHECK 3곳 일치 검증.

    FAILURES #2 계열 — 한쪽 빠뜨리면 RLS에서 일치 안 하거나 UI에 누락 발생.
    """
    from typing import get_args
    from infra.runware_catalog import StylePreset

    backend_styles = set(get_args(StylePreset))

    # 프론트 types/studio.ts
    src_ts = FRONTEND_STUDIO_TS.read_text(encoding="utf-8")
    # export type StylePreset = 'cinematic' | 'cozy' | ... 파싱
    m = re.search(r"export type StylePreset\s*=\s*([^;]+);", src_ts)
    assert m, "types/studio.ts 에서 StylePreset 타입 파싱 실패"
    frontend_styles = set(re.findall(r"'([^']+)'", m.group(1)))

    # DB migration CHECK constraint
    migrations_dir = FRONTEND_STUDIO_TS.parent.parent / "supabase" / "migrations"
    style_migrations = sorted(migrations_dir.glob("*studio*styles*.sql"))
    assert style_migrations, "studio_add_styles 마이그레이션 파일을 찾지 못함"
    latest = style_migrations[-1].read_text(encoding="utf-8")
    check_match = re.search(r"style_preset\s+in\s*\(([^)]+)\)", latest)
    assert check_match, "style_preset CHECK constraint 파싱 실패"
    db_styles = set(re.findall(r"'([^']+)'", check_match.group(1)))

    assert backend_styles == frontend_styles == db_styles, (
        f"스타일 드리프트 감지 — "
        f"backend={backend_styles} frontend={frontend_styles} db={db_styles}. "
        f"한 곳을 수정했으면 3곳 모두 동기화 필요."
    )


@pytest.mark.parametrize("tier", ["draft", "pro", "studio"])
def test_tier_image_resolution_match(tier: QualityTier):
    """FAILURES #2 핵심 필드 — 이미지 해상도 불일치가 실제 사고 원인이었음.

    프론트 '2560×1440' ↔ 백엔드 (2560, 1440) 비교.
    """
    fe = _parse_frontend_tier(tier)
    be = TIERS[tier]
    # 프론트 표기 정규화: '×' 또는 'x' 로 분리된 숫자 쌍
    parts = re.split(r"[×x]", fe["imageResolution"])
    assert len(parts) == 2, f"{tier} 해상도 문자열 형식 예상 밖: {fe['imageResolution']!r}"
    fe_w, fe_h = int(parts[0].strip()), int(parts[1].strip())
    be_w, be_h = be.image_resolution
    assert (fe_w, fe_h) == (be_w, be_h), (
        f"{tier}: frontend {fe['imageResolution']} vs backend {be.image_resolution}. "
        f"FAILURES #2 재발 — types/studio.ts 또는 backend/infra/runware_catalog.py 동기화"
    )
