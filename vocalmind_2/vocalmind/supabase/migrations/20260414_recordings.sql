-- ────────────────────────────────────────────────────────────
-- recordings 테이블 + user_recording_stats 뷰
-- 성장 시스템(totalRecordingSec) 데이터 소스
-- ────────────────────────────────────────────────────────────

create table if not exists recordings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  storage_path  text,
  duration_sec  double precision not null default 0,
  source        text not null default 'ai_cover_training',
  stage_id      int,
  created_at    timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_recordings_user_id on recordings(user_id);

-- RLS
alter table recordings enable row level security;

create policy "recordings_select_own" on recordings
  for select using (auth.uid() = user_id);

create policy "recordings_insert_own" on recordings
  for insert with check (auth.uid() = user_id);

create policy "recordings_delete_own" on recordings
  for delete using (auth.uid() = user_id);

-- 뷰 재생성 (recordings 테이블 존재 후)
create or replace view user_recording_stats as
select
  user_id,
  count(*) as recording_count,
  coalesce(sum(duration_sec), 0) as total_recording_sec
from recordings
group by user_id;
