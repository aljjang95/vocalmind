// ─────────────────────────────────────────────
// 오디션 타입 — 주간 오디션 이벤트, 참가, 투표
// ─────────────────────────────────────────────

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
  // F3: AI 자동 채점
  ai_score?: number | null;
  tension_score?: number | null;
  pitch_accuracy?: number | null;
  rhythm_score?: number | null;
  final_score?: number | null;
  scoring_status?: 'complete' | 'partial' | 'failed' | 'pending';
}

// F3: 오디션 AI 채점 결과
export interface AuditionAiScore {
  aiScore: number;
  tensionScore: number;
  pitchAccuracy: number;
  rhythmScore: number | null;
  voteScore: number;
  finalScore: number;
  alpha: number;
  status: 'complete' | 'partial' | 'failed';
}
