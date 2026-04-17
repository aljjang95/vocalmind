// ─────────────────────────────────────────────
// 진단 타입 — 보컬 진단 위저드, 커리큘럼
// ─────────────────────────────────────────────

// ── Phase 2: 진단 (Diagnosis) ──

export type VoiceType = '저음' | '중음' | '고음';
export type ExperienceLevel = '초보' | '중급' | '고급';

export interface BasicInfo {
  nickname: string;
  voiceType: VoiceType;
  experience: ExperienceLevel;
  genre: string;
}

export interface SelfEvalScores {
  pitch: number;       // 0~100 음정
  breath: number;      // 0~100 호흡
  power: number;       // 0~100 성량
  tone: number;        // 0~100 음색
  technique: number;   // 0~100 테크닉
}

export type ConcernKey =
  | 'high_notes'
  | 'breath_control'
  | 'pitch_accuracy'
  | 'vocal_fatigue'
  | 'tone_quality'
  | 'diction'
  | 'stage_fear'
  | 'range_expand'
  | 'vibrato';

export interface DiagnosisRequest {
  basicInfo: BasicInfo;
  concerns: ConcernKey[];
  goal: string;
  selfEval: SelfEvalScores;
}

export interface DiagnosisResult {
  id: string;
  createdAt: string;
  nickname: string;
  overallScore: number;
  scores: SelfEvalScores;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  suggestedCategory: string;
  summary: string;
}

// ── Phase 2: 커리큘럼 (Curriculum) ──

export interface CurriculumLesson {
  id: string;
  title: string;
  description: string;
  durationMin: number;
}

export interface CurriculumCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  lessons: CurriculumLesson[];
}
