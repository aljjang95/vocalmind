// ─────────────────────────────────────────────
// 크레딧 충전 팩 — 단일 진실 원천.
// 프론트(CreditsClient)와 백엔드(/api/credits/topup/confirm) 양쪽이 이 파일을 import.
// 가격/개수 수정은 여기 한 곳만 — FAILURES #2(STUDIO_TIERS 해상도 이중 정의) 재발 방지.
// ─────────────────────────────────────────────

export interface CreditPack {
  /** 결제 금액 (KRW). confirm route에서 whitelist 키로 사용. */
  amount: number;
  /** 지급되는 크레딧 개수. */
  credits: number;
  /** 결제 내역 라벨 (ledger metadata / 영수증). */
  label: string;
  /** UI 카드 뱃지. null이면 뱃지 없음. */
  badge: string | null;
  /** UI 카드 하단 설명문. */
  desc: string;
}

/**
 * Phase 0 크레딧 팩 — 1커버 = 5크레딧 기준.
 * - 50 → 10편 · 150 → 30편 · 500 → 100편
 * - 가격 인상 시 Toss 매출·원가 동시 검증 필수.
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    amount: 50_000,
    credits: 50,
    label: '50크레딧 팩',
    badge: null,
    desc: '가볍게 시작 (커버 10편)',
  },
  {
    amount: 140_000,
    credits: 150,
    label: '150크레딧 팩 (10% 할인)',
    badge: '인기',
    desc: '한 달 꾸준히 (커버 30편)',
  },
  {
    amount: 450_000,
    credits: 500,
    label: '500크레딧 팩 (10% 할인)',
    badge: '최대 절약',
    desc: '본격 크리에이터 (커버 100편)',
  },
] as const;

/**
 * 금액으로 팩 조회. 백엔드 confirm route의 whitelist 가드.
 * 조회 실패 시 null — 호출자가 UNKNOWN_PACK 에러 처리.
 */
export function findCreditPack(amount: number): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.amount === amount) ?? null;
}
