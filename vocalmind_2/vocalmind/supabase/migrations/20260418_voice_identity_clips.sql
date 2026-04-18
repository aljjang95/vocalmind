-- voice_identities.source_clips: 원본 녹음 clip 경로 + 길이 목록 (Phase 0 admin 검토용)
-- [{storage_path, duration_sec, sentence_index}]
alter table public.voice_identities
  add column if not exists source_clips jsonb not null default '[]'::jsonb;

comment on column public.voice_identities.source_clips is
  'Phase 0 admin 학습 검토용 — [{storage_path, duration_sec, sentence_index}] 배열';
