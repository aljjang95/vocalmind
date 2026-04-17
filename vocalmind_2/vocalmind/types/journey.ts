// ─────────────────────────────────────────────
// 여정 타입 — HLB 커리큘럼 단계, 진도, 레슨 흐름
// ─────────────────────────────────────────────

// ── 공유: HLB 커리큘럼 ──

export type UserTier = 'free' | 'hobby' | 'pro' | 'teacher';
export type StageStatus = 'locked' | 'available' | 'in_progress' | 'passed';

export interface EvaluationCriteria {
  description: string;
  passingScore: number;
  metrics: string[];
}

export interface SomaticFeedback {
  onSuccess: string;
  onStruggle: string;
  observationQuestion: string;
}

export interface HLBCurriculumStage {
  id: number;
  block: string;
  blockIcon: string;
  name: string;
  pattern: number[];
  bpmRange: [number, number];
  pronunciation: string;
  scaleType: string;
  isFree: boolean;
  minTier: UserTier;
  evaluationCriteria: EvaluationCriteria;
  somaticFeedback: SomaticFeedback;
  whyText: string;
  demoScript: string;
  demoAudioUrl?: string;
  demoVideoId?: string;
  demoStartSec?: number;
  demoEndSec?: number;
  whyAudioUrl?: string;
}

export interface PitchData {
  frequency: number;
  noteName: string;
  cents: number;
  confidence: number;
}

export interface BreathData {
  rms: number;
  isBreathing: boolean;
  durationSec: number;
}

// ── 여정 진도 ──

export interface StageProgress {
  stageId: number;
  status: StageStatus;
  bestScore: number;
  attempts: number;
  passedAt: string | null;
  lastFeedback: string | null;
  teacherApproved: boolean;
}

// ── 여정 레슨 Phase ──
export type JourneyLessonPhase = 'why' | 'demo' | 'practice' | 'eval' | 'summary';

// LessonStage alias (하위 호환)
export type LessonStage = JourneyLessonPhase;

// ── 평가 결과 ──

export interface TensionDetail {
  overall: number;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  detail: string;
}

export interface EvaluationResult {
  score: number;
  pitchAccuracy: number;
  toneStability: number;
  tensionDetected: boolean;
  tension?: TensionDetail;  // optional: 이전 응답 호환
  feedback: string;
  passed: boolean;
}
