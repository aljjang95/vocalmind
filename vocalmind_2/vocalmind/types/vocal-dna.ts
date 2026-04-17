// ─────────────────────────────────────────────
// 음색 DNA 타입 — 5축 보컬 특성 분석
// ─────────────────────────────────────────────

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

// VocalDNA alias (PascalCase 하위 호환)
export type VocalDNA = VocalDna;

export interface DnaAxis {
  key: keyof Pick<VocalDna, 'laryngeal' | 'tongue_root' | 'jaw' | 'register_break' | 'tone_stability'>;
  label: string;
  value: number;
}
