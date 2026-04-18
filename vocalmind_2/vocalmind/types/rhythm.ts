// ─────────────────────────────────────────────
// 리듬/박자 정확도 — F2 기능
// ─────────────────────────────────────────────

// 곡의 기준 비트 격자 (Supabase Storage JSON)
export interface BeatGrid {
  bpm: number;
  firstBeatOffsetSec: number;
  beatTimes: number[];
  source: 'manual' | 'ai' | 'none';
}

// 클라이언트 RMS 또는 서버 parselmouth 감지 결과
export interface RhythmOnset {
  timeSec: number;
  confidence: number;
  source: 'server' | 'client';
}

// 매칭 분류
export type RhythmClassification = 'perfect' | 'good' | 'off' | 'miss' | 'ghost';

// 매칭된 이벤트 (onset ↔ target beat)
export interface RhythmEvent {
  onsetTimeSec: number;
  targetBeatTimeSec: number | null;
  errorMs: number | null;
  classification: RhythmClassification;
  sectionIndex: number;
}

export interface RhythmSectionScore {
  sectionIndex: number;
  label: string;
  score: number;
  eventCount: number;
}

// 세션 종합 점수
export interface RhythmSessionScore {
  rhythmScore: number; // 0~100
  events: RhythmEvent[];
  sectionScores: RhythmSectionScore[];
  problemSegments: RhythmSectionScore[];
  coverageRatio: number; // 매칭 target beat / 전체 target beat
}

// 실시간 UI 반응 상태 (즉시 시각 피드백)
export interface RhythmLiveState {
  lastClassification: RhythmClassification | null;
  updatedAt: number;
}
