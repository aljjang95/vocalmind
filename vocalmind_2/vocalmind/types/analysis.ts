// ─────────────────────────────────────────────
// 분석 타입 — 음성 분석 결과
// ─────────────────────────────────────────────

// ── 음성 분석 결과 (Phase 1: 더미 타입 확정 / Phase 2: Web Audio API 교체) ──
export interface AnalysisResult {
  id: string;
  userId?: string;
  sessionDate: string; // ISO date string
  pitchAccuracy: number;    // 0~100
  breathStability: number;  // 0~100
  dictionClarity: number;   // 0~100
  rawData?: Record<string, unknown>; // Phase 2: Web Audio API 출력 원본
}
