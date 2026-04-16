-- 유료 피드백 요청 테이블
create table if not exists public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audio_path text,
  concern text not null,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed', 'rejected')),
  teacher_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_feedback_requests_user on public.feedback_requests(user_id);
create index if not exists idx_feedback_requests_status on public.feedback_requests(status);

-- RLS
alter table public.feedback_requests enable row level security;

-- 사용자: 자신의 요청만 조회
create policy "Users can view own feedback requests"
  on public.feedback_requests for select
  using (auth.uid() = user_id);

-- 사용자: 새 요청 생성
create policy "Users can create feedback requests"
  on public.feedback_requests for insert
  with check (auth.uid() = user_id);

-- 선생님은 서비스 롤 키로 접근 (RLS 우회)
