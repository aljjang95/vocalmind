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
