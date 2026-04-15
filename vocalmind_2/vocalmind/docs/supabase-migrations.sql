-- HLB 보컬스튜디오 Supabase 테이블 마이그레이션
-- Supabase Dashboard > SQL Editor에서 실행

-- feedback_requests 테이블
create table if not exists public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audio_path text,
  concern text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'completed')),
  teacher_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 활성화
alter table public.feedback_requests enable row level security;

-- 유저는 자신의 요청만 조회/삽입
create policy "users can read own requests"
  on public.feedback_requests for select
  using (auth.uid() = user_id);

create policy "users can insert own requests"
  on public.feedback_requests for insert
  with check (auth.uid() = user_id);

-- 선생님은 service_role로 접근하므로 RLS 우회 (API에서 auth 검사)
-- 또는 선생님 이메일을 profiles 테이블에서 확인하는 policy 추가 가능

-- profiles 테이블 (없으면 생성)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- 신규 유저 가입 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
