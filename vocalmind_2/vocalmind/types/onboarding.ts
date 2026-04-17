// ─────────────────────────────────────────────
// 온보딩 타입 — 상담 위저드, 긴장 분석 결과
// ─────────────────────────────────────────────

// ── 온보딩 (Onboarding) ──

export interface OnboardingTension {
  overall: number;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  detail: string;
}

// TensionResult alias (하위 호환)
export type TensionResult = OnboardingTension;

export interface OnboardingConsultation {
  problems: string[];
  roadmap: string[];
  suggested_stage_id: number;
  summary: string;
}

export interface OnboardingResult {
  tension: OnboardingTension;
  consultation: OnboardingConsultation;
}
