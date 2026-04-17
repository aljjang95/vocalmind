// ─────────────────────────────────────────────
// 코치 타입 — AI 코치 세션, 스케일 연습, 피드백
// ─────────────────────────────────────────────

// ── AI Coach ──

export type CoachCondition = 'good' | 'normal' | 'tired' | 'bad';
export type CoachPhase = 'home' | 'condition' | 'lesson' | 'judgment' | 'summary';

export interface LessonAttempt {
  stageId: number;
  score: number;
  bpm: number;
  condition: CoachCondition;
  attemptedAt: string;
  passed: boolean;
}

export interface NoteScore {
  noteIndex: number;
  expectedMidi: number;
  detectedFrequency: number;
  cents: number;
  score: number;
}

export interface PatternScore {
  rootNote: number;
  noteScores: NoteScore[];
  average: number;
}

export interface CoachSession {
  id: string;
  startedAt: string;
  condition: CoachCondition;
  stagesAttempted: LessonAttempt[];
  totalDurationSec: number;
}

export interface CoachFeedback {
  feedback: string;
  suggestion: string;
  encouragement: string;
  shouldLowerBpm: boolean;
}

// ── 코칭 피드백 (Journey Coach) ──

export interface VideoReference {
  videoId: string;
  timestamp: number;
}

export interface CoachingFeedback {
  feedback: string;
  nextExercise: string;
  encouragement: string;
  references?: VideoReference[];
}

// ── 스케일 연습 (Scale Practice) ──

export interface ScalePracticeData {
  guideVideoId: string | null;
  practiceInstructions: string[];
  defaultScale: number[];
  startNote: string;
  transposeRange: [number, number];
  defaultBpm: number;
}

export type FeedbackMode = 'quiet' | 'gentle' | 'active';
export type KeyLabel = 'solfege' | 'note' | 'number';

// ScaleNote — 스케일 패턴의 각 음표
export interface ScaleNote {
  midi: number;
  noteName: string;
  durationBeats: number;
}

// ScalePattern — 연습 스케일 패턴 정의
export interface ScalePattern {
  id: string;
  name: string;
  notes: number[]; // MIDI 노트 오프셋
  bpmRange: [number, number];
  pronunciation: string;
}

// ── 자동 레슨 모드 ──
export type LessonMode = 'auto' | 'free';
export type LessonPhase = 'guide' | 'ready' | 'playing' | 'recording' | 'grading' | 'result';

export interface ScalePracticeScore {
  score: number;
  passed: boolean;
  level: 'beginner' | 'intermediate' | 'advanced';
  feedbackHint: string;
  tensionOverall: number;
  pitchAccuracy: number;
  toneStability: number;
}

