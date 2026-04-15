// ─────────────────────────────────────────────
// HLB 보컬스튜디오 — 공통 타입 정의
// ─────────────────────────────────────────────

// ── 채팅 메시지 ──
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

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

// ── 플랜 타입 ──
export type Plan = 'free' | 'hobby' | 'pro';

// ── 사용자 ──
export interface User {
  id: string;
  email: string;
  plan: Plan;
  createdAt: string;
}

// ── 대화 세션 ──
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages?: Message[];
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

// ── API 응답 래퍼 ──
export interface ApiSuccess<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

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

// ── 채팅 API 요청/응답 ──
// ChatRequest: Phase 2에서 /api/chat route.ts가 DB 신뢰 소스로 전환 시 재사용
export interface ChatRequest {
  messages: Array<{ role: MessageRole; content: string }>;
}

export interface ChatResponse {
  reply: string;
}

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

// ── F1: 곡 연습 모드 ──

export interface Song {
  id: string;
  title: string;
  artist: string;
  addedAt: string;
  vocalBlobKey: string;
  instrumentalBlobKey: string;
  originalBlobKey?: string;
  durationSec: number;
  separationStatus?: 'pending' | 'done' | 'failed';
  analysisStatus?: 'none' | 'analyzing' | 'done';
  keyShift?: number; // -6 ~ +6 반음
}

export interface PracticeSession {
  songId: string;
  startedAt: string;
  loopStart: number | null;
  loopEnd: number | null;
  playbackRate: number;
}

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

export interface WarmupRecord {
  routineId: string;
  completedAt: string;
  stagesCompleted: number[];
}

// ── F3: 호흡 트레이너 ──

export type BreathMode = 'long' | 'rhythm' | 'phrase';

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

// ── 곡 연습 모드 v2 ──

export interface MelodyPoint {
  time: number;
  frequency: number;
  noteName: string;
}

export interface SongSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'other';
  startTime: number;
  endTime: number;
  label: string;
}

export interface VocalTechnique {
  type: 'vibrato' | 'bending' | 'belting' | 'falsetto' | 'whisper' | 'run' | 'crack' | 'mix' | 'breathy';
  startTime: number;
  endTime: number;
  intensity: number; // 0~1
}

export interface LyricLine {
  text: string;
  startTime: number | null;
  pronunciation?: string; // 한국식 발음
}

export interface SongAnalysis {
  songId: string;
  melodyData: MelodyPoint[];
  sections: SongSection[];
  vocalMap: VocalTechnique[];
  songRange: { low: string; high: string };
  lyrics: LyricLine[];
  analyzedAt: string;
}

export interface SessionScore {
  id: string;
  songId: string;
  playedAt: string;
  keyShift: number;
  overallScore: number;
  sectionScores: { sectionIndex: number; score: number }[];
  userPitchData: MelodyPoint[];
  duration: number;
}

export interface UserVocalRange {
  measuredAt: string;
  low: { frequency: number; noteName: string };
  high: { frequency: number; noteName: string };
}

export type PracticeMode = 'practice' | 'play';

// ── AI Coach ──

export type CoachCondition = 'good' | 'normal' | 'tired' | 'bad';
export type CoachPhase = 'home' | 'condition' | 'lesson' | 'judgment' | 'summary';

export interface StageProgress {
  stageId: number;
  status: StageStatus;
  bestScore: number;
  attempts: number;
  passedAt: string | null;
  lastFeedback: string | null;
  teacherApproved: boolean;
}

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

// ── AI Cover ──────────────────────────────────
export interface VoiceModel {
  id: string;
  user_id: string;
  name: string;
  model_path: string | null;
  index_path: string | null;
  status: 'pending' | 'training' | 'completed' | 'failed';
  epochs: number;
  created_at: string;
}

export interface AiCoverSong {
  id: string;
  user_id: string;
  name: string;
  original_path: string | null;
  vocals_path: string | null;
  instrumental_path: string | null;
  separation_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface AiCoverConversion {
  id: string;
  user_id: string;
  song_id: string;
  model_id: string;
  pitch_shift: number;
  output_path: string | null;
  status: 'pending' | 'separating' | 'converting' | 'mixing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

export type AiCoverStep = 'record' | 'model' | 'convert' | 'result';

// ── 여정 (Journey) ────────────────────────────

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

// ── 스케일 연습 (Scale Practice) ────────────────────────

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

// ── 온보딩 (Onboarding) ──

export interface OnboardingTension {
  overall: number;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  detail: string;
}

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

// ── 여정 레슨 Phase ──
export type JourneyLessonPhase = 'why' | 'demo' | 'practice' | 'eval' | 'summary';

// ── Phase 13: 음색 DNA ──

export interface VocalDna {
  id: string;
  user_id: string;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  tone_stability: number;
  avg_pitch_hz: number | null;
  voice_type: string | null;
  source: string;
  created_at: string;
}

export interface DnaAxis {
  key: keyof Pick<VocalDna, 'laryngeal' | 'tongue_root' | 'jaw' | 'register_break' | 'tone_stability'>;
  label: string;
  value: number;
}

// ── Phase 13: 아바타 + 의상 ──

export type ItemCategory = 'hat' | 'top' | 'bottom' | 'accessory' | 'effect' | 'crown';

export interface AvatarData {
  id: string;
  user_id: string;
  base_image_url: string;
  style_prompt: string | null;
  ref_image_url?: string | null;
  growth_level?: string | null;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  image_url: string;
  price: number;
  is_season: boolean;
  season_end_at: string | null;
  is_reward_only: boolean;
  created_at: string;
}

export interface UserInventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  source: string;
  item?: ShopItem;
}

export interface UserEquipped {
  user_id: string;
  hat_id: string | null;
  top_id: string | null;
  bottom_id: string | null;
  accessory_id: string | null;
  effect_id: string | null;
  updated_at: string;
}

// ── Phase 13: 커뮤니티 ──

export type PostType = 'cover' | 'battle' | 'free';
export type FeedTab = 'latest' | 'popular' | 'battle';

export interface CommunityPost {
  id: string;
  user_id: string;
  type: PostType;
  title: string | null;
  description: string | null;
  audio_url: string | null;
  song_title: string | null;
  song_artist: string | null;
  vote_count: number;
  play_count: number;
  is_deleted: boolean;
  created_at: string;
  // joined fields
  author_name?: string;
  author_avatar_url?: string;
  has_voted?: boolean;
}

export interface CommunityVote {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

// ── Phase 13: 주간 오디션 ──

export type AuditionStatus = 'active' | 'voting' | 'ended';

export interface AuditionEvent {
  id: string;
  song_title: string;
  song_artist: string;
  description: string | null;
  week_start: string;
  week_end: string;
  status: AuditionStatus;
  created_at: string;
}

export interface AuditionEntry {
  id: string;
  event_id: string;
  user_id: string;
  audio_url: string;
  vote_count: number;
  rank: number | null;
  created_at: string;
  // joined
  author_name?: string;
  author_avatar_url?: string;
  has_voted?: boolean;
}

// ── Phase 13: 보상 ──

export type RewardType = 'crown' | 'effect' | 'title' | 'item';

export interface UserReward {
  id: string;
  user_id: string;
  reward_type: RewardType;
  reward_data: Record<string, unknown> | null;
  source: string;
  created_at: string;
}
