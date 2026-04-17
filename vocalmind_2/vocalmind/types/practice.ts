// ─────────────────────────────────────────────
// 곡 연습 타입 — 곡 목록, 연습 세션, 곡 분석
// ─────────────────────────────────────────────

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

// ── AI Cover ──

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
