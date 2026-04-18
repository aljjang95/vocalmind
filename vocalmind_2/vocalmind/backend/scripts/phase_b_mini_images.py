"""Phase B 검증 1단계 — 3티어 이미지 1장씩 실호출.

마스터 각인: 품질 최우선 + 낭비 방지.
- 동일 프롬프트를 3개 티어 모델에 각각 1회씩
- 목표: Seedream 5.0 vs 4.5 vs FLUX Schnell 미학 차이 확인
- 예상 과금: ~$0.15
- 실패 시: 재호출 금지. 원인 분석 먼저.

실행:
    cd backend
    RUNWARE_API_KEY=xxx python scripts/phase_b_mini_images.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# backend 루트에서 실행된다고 가정. import 경로 보정.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from infra import runware_catalog as cat  # noqa: E402
from infra import runware_client as rw    # noqa: E402


PROMPT = (
    "a solo female vocalist on a dimly lit stage, a single warm spotlight "
    "illuminating her face, audience silhouettes in the foreground, "
    "35mm film grain, emotional moment"
)

STYLE = "cinematic"

OUT_DIR = Path(__file__).resolve().parent / "phase_b_samples"


def main() -> int:
    if not os.environ.get("RUNWARE_API_KEY"):
        print("[FAIL] RUNWARE_API_KEY 환경변수 누락", file=sys.stderr)
        return 2

    if os.environ.get("RUNWARE_DRY_RUN", "").strip() in ("1", "true", "yes"):
        print("[FAIL] DRY_RUN 켜져있음 — 실호출 의도와 모순", file=sys.stderr)
        return 3

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report: list[dict] = []
    total_cost = 0.0

    for tier in ("draft", "pro", "studio"):
        spec = cat.tier_spec(tier)
        w, h = spec.image_resolution
        prompt = cat.apply_style(PROMPT, STYLE)

        print(f"\n▶ {tier.upper():6s} | {spec.image_model} | {w}x{h}")
        print(f"  prompt: {prompt[:80]}...")
        started = time.time()
        try:
            url, cost = rw.generate_image_with_cost(
                prompt,
                width=w,
                height=h,
                model=spec.image_model,
                steps=4,  # Seedream은 무시됨 (runware_client 조건부 처리)
            )
        except rw.RunwareError as e:
            print(f"  [FAIL] {e}")
            report.append({
                "tier": tier, "model": spec.image_model,
                "url": None, "cost_usd": 0.0, "error": str(e),
            })
            continue

        elapsed = time.time() - started
        total_cost += cost
        print(f"  [OK]  cost=${cost:.4f}  {elapsed:.1f}s")
        print(f"  url:  {url}")

        report.append({
            "tier": tier,
            "model": spec.image_model,
            "resolution": f"{w}x{h}",
            "url": url,
            "cost_usd": cost,
            "elapsed_sec": round(elapsed, 2),
        })

    # 리포트 저장
    (OUT_DIR / "report.json").write_text(
        json.dumps(
            {"prompt": PROMPT, "style": STYLE, "total_cost_usd": round(total_cost, 4),
             "results": report},
            ensure_ascii=False, indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\n{'='*60}")
    print(f"총 과금: ${total_cost:.4f} (약 {int(total_cost * 1400)}원)")
    print(f"리포트: {OUT_DIR / 'report.json'}")
    print(f"{'='*60}")

    # 3티어 모두 성공해야 0
    failed = [r for r in report if not r.get("url")]
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
