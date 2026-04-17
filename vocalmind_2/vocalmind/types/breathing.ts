// ─────────────────────────────────────────────
// 호흡 타입 — 호흡 트레이너 모드, 세션 기록
// ─────────────────────────────────────────────

// ── F3: 호흡 트레이너 ──

export type BreathMode = 'long' | 'rhythm' | 'phrase';

// BreathingMode alias (하위 호환)
export type BreathingMode = BreathMode;

export interface BreathPhase {
  type: 'inhale' | 'hold' | 'exhale' | 'rest';
  durationSec: number;
}

export interface BreathRecord {
  id: string;
  date: string;
  mode: BreathMode;
  longestExhaleSec: number;
  avgExhaleSec: number;
  sessionsCount: number;
  completedAt: string;
}

// BreathingRecord alias (하위 호환)
export type BreathingRecord = BreathRecord;

// BreathingSession — 진행 중인 호흡 세션 상태
export interface BreathingSession {
  mode: BreathMode;
  startedAt: string;
  currentPhaseIndex: number;
  phases: BreathPhase[];
  longestExhaleSec: number;
}
