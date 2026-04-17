// ─────────────────────────────────────────────
// 워밍업 타입 — AI 워밍업 루틴 생성
// ─────────────────────────────────────────────

// ── F2: AI 워밍업 루틴 ──

export interface WarmupCondition {
  energy: 'good' | 'normal' | 'tired' | 'bad';
  goals: string[]; // max 2
}

export interface WarmupRoutine {
  id: string;
  createdAt: string;
  condition: WarmupCondition;
  stages: WarmupStage[];
  totalMinutes: number;
  aiComment: string;
}

export interface WarmupStage {
  stageId: number;
  name: string;
  pronunciation: string;
  pattern: number[];
  bpmRange: [number, number];
  suggestedBpm: number;
  repetitions: number;
  durationMin: number;
  guideText: string;
}

// WarmupExercise alias for WarmupStage (하위 호환)
export type WarmupExercise = WarmupStage;

export interface WarmupRecord {
  routineId: string;
  completedAt: string;
  stagesCompleted: number[];
}
