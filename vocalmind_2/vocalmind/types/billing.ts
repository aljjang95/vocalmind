// ─────────────────────────────────────────────
// 결제/요금제 타입 — 플랜, 구독, 리포트
// ─────────────────────────────────────────────

import type { Plan } from './shared';

// PlanTier alias
export type PlanTier = Plan;

// ── 가격 플랜 UI ──
export interface PricingPlan {
  id: Plan;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: Array<{ label: string; included: boolean }>;
  isFeatured: boolean;
  ctaLabel: string;
}

// BillingPlan — 청구 플랜 상세
export interface BillingPlan {
  tier: Plan;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
}

// Subscription — 구독 상태
export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// ── 주간 성장 리포트 ──
export interface WeeklyReport {
  id: string;
  userId: string;
  weekStart: string; // ISO date
  summary: string;
  scores: {
    pitch: number;
    breath: number;
    diction: number;
  };
  recommendations: string[];
}
