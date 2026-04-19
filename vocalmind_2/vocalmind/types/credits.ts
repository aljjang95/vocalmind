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
 * Phase 0 크레딧 팩 — 티어별 실제 소모량은 types/studio.ts STUDIO_TIERS 참조
 * (draft 3 / pro 15 / studio 40). 아래 "커버 N편" 은 Pro 티어 기준 환산.
 * - 50 → Pro 3편 / Draft 16편
 * - 150 → Pro 10편 / Draft 50편
 * - 500 → Pro 33편 / Draft 166편
 * 가격 인상 시 Toss 매출·원가 동시 검증 필수.
 */
// "커버 N편" 설명은 티어 혼합 사용이 현실적이므로 Pro 티어(기본값, 15크레딧) 기준으로 환산 표시.
// Draft(3크레딧)만 쓰면 각각 16/50/166편까지 가능.
export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    amount: 50_000,
    credits: 50,
    label: '50크레딧 팩',
    badge: null,
    desc: '가볍게 시작 (Pro 3편 · Draft 16편)',
  },
  {
    amount: 140_000,
    credits: 150,
    label: '150크레딧 팩 (10% 할인)',
    badge: '인기',
    desc: '한 달 꾸준히 (Pro 10편 · Draft 50편)',
  },
  {
    amount: 450_000,
    credits: 500,
    label: '500크레딧 팩 (10% 할인)',
    badge: '최대 절약',
    desc: '본격 크리에이터 (Pro 33편 · Draft 166편)',
  },
] as const;

/**
 * 금액으로 팩 조회. 백엔드 confirm route의 whitelist 가드.
 * 조회 실패 시 null — 호출자가 UNKNOWN_PACK 에러 처리.
 */
export function findCreditPack(amount: number): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.amount === amount) ?? null;
}
