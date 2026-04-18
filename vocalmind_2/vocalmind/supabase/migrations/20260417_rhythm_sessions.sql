-- ─────────────────────────────────────────────
-- F2 리듬 정확도 — rhythm_sessions 테이블
-- 2026-04-17
-- ─────────────────────────────────────────────

-- 곡별 세션 점수 누적 저장 (대시보드 성장 그래프 + 주간 리포트 소스)
create table if not exists public.rhythm_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null,
  played_at timestamptz not null default now(),
  rhythm_score int not null check (rhythm_score between 0 and 100),
  coverage_ratio real not null check (coverage_ratio between 0 and 1),
  events_json jsonb not null,
  section_scores jsonb not null,
  problem_segments jsonb not null default '[]'::jsonb,
  output_latency_ms int not null default 0,
  created_at timestamptz not null default now()
);

-- 최근 세션 조회용 복합 인덱스 (대시보드 성장 그래프)
create index if not exists rhythm_sessions_user_song_played_idx
  on public.rhythm_sessions (user_id, song_id, played_at desc);

-- 사용자별 최근 전체 조회 인덱스
create index if not exists rhythm_sessions_user_played_idx
  on public.rhythm_sessions (user_id, played_at desc);

-- RLS: 자신의 세션만 조회/삽입
alter table public.rhythm_sessions enable row level security;

create policy "Users can view own rhythm sessions"
  on public.rhythm_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own rhythm sessions"
  on public.rhythm_sessions for insert
  with check (auth.uid() = user_id);

-- 업데이트/삭제는 금지 (세션 로그 불변성)
-- 운영자 수동 정리는 service_role bypass 사용

comment on table public.rhythm_sessions is 'F2 리듬 분석 세션 결과 로그 (불변)';
comment on column public.rhythm_sessions.events_json is 'RhythmEvent 배열 — 각 이벤트의 onset_time_sec, target_beat_time_sec, error_ms, classification';
comment on column public.rhythm_sessions.coverage_ratio is '매칭된 target beat / 전체 target beat (0~1)';
