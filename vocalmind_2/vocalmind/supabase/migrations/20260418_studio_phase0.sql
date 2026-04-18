-- ────────────────────────────────────────────────────────────
-- Paradigm A Phase 0 — AI 스튜디오 파이프라인 기초 스키마
-- 2026-04-18
-- 5개 테이블: credits_ledger / voice_identities / studio_jobs / covers / moderation_events
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- 1) 크레딧 원장 (append-only) + 잔액 뷰 + 원자적 소비 RPC
-- ============================================================

create table if not exists public.studio_credits_ledger (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       int not null,  -- +충전/환불, -소비
  reason      text not null check (reason in (
                'signup_bonus','topup_purchase',
                'cover_consume','scene_regen',
                'job_refund','referral','admin_adjust')),
  job_id      uuid,  -- studio_jobs.id (FK는 studio_jobs 생성 후 ALTER)
  payment_id  uuid,  -- vocal_payments.id (optional)
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ledger_user_time
  on public.studio_credits_ledger(user_id, created_at desc);

create index if not exists idx_ledger_job
  on public.studio_credits_ledger(job_id)
  where job_id is not null;

-- 잔액 집계 뷰 (원장 SUM)
create or replace view public.studio_credit_balances as
  select user_id, coalesce(sum(delta), 0)::int as balance
  from public.studio_credits_ledger
  group by user_id;

-- 원자적 소비 함수 (advisory lock으로 동일 유저 직렬화, 음수 잔액 차단)
create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_job_id uuid default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_ledger_id bigint;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: amount must be positive';
  end if;

  -- 동일 유저 동시 차감 직렬화 (트랜잭션 종료 시 자동 해제)
  perform pg_advisory_xact_lock(hashtext('credits:' || p_user_id::text));

  select balance into v_balance
  from public.studio_credit_balances
  where user_id = p_user_id;

  if coalesce(v_balance, 0) < p_amount then
    raise exception 'INSUFFICIENT_CREDITS: balance=% need=%',
      coalesce(v_balance, 0), p_amount;
  end if;

  insert into public.studio_credits_ledger(user_id, delta, reason, job_id)
  values (p_user_id, -p_amount, p_reason, p_job_id)
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

-- 환불/충전 함수 (양수 delta 삽입, 권한만 통과하면 OK)
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_job_id uuid default null,
  p_payment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_id bigint;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: amount must be positive';
  end if;

  insert into public.studio_credits_ledger(user_id, delta, reason, job_id, payment_id, metadata)
  values (p_user_id, p_amount, p_reason, p_job_id, p_payment_id, p_metadata)
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

-- 일반 유저는 consume/grant 직접 호출 금지 (service role만). RPC는 BFF에서.
revoke all on function public.consume_credits(uuid, int, text, uuid) from public;
revoke all on function public.grant_credits(uuid, int, text, uuid, uuid, jsonb) from public;

-- ============================================================
-- 2) Voice Identity (본인 음색 모델)
-- ============================================================

create table if not exists public.voice_identities (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  status             text not null default 'collecting'
                      check (status in ('collecting','training','ready','failed','archived')),
  rvc_model_path     text,
  rvc_index_path     text,
  source_clip_count  int not null default 0,
  total_duration_sec numeric not null default 0,
  mos_score          numeric,  -- MOS 3.5+ 목표
  liveness_verified  bool not null default false,
  liveness_method    text,  -- 'camera_phrase' 등
  last_error         text,
  created_at         timestamptz not null default now(),
  ready_at           timestamptz
);

-- 활성 모델은 유저당 1개만
create unique index if not exists idx_voice_identity_active
  on public.voice_identities(user_id)
  where status = 'ready';

create index if not exists idx_voice_identity_user
  on public.voice_identities(user_id, created_at desc);

-- ============================================================
-- 3) Studio Jobs (큐 + 상태머신 + 감사로그)
-- ============================================================

create table if not exists public.studio_jobs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  voice_identity_id     uuid references public.voice_identities(id),
  user_mr_path          text not null,   -- Phase 0: 본인 MR만
  raw_recording_path    text not null,
  style_preset          text not null check (style_preset in (
                          'cinematic','cozy','neon_city','fantasy')),
  avatar_mode           text not null check (avatar_mode in (
                          'user_photo','ai_realistic','ai_anime','faceless')),
  avatar_ref_path       text,

  status                text not null default 'pending' check (status in (
                          'pending',
                          'vocal_separating','vocal_rvc','vocal_mixing',
                          'scene_planning','scene_image_gen','scene_video_gen',
                          'lipsync','composing','formatting','watermarking',
                          'finalizing','completed','failed','refunded')),
  progress_pct          int not null default 0 check (progress_pct between 0 and 100),
  current_step_label    text,

  cost_credits          int not null check (cost_credits > 0),
  ledger_entry_id       bigint references public.studio_credits_ledger(id),
  cost_usd_estimated    numeric,
  cost_usd_actual       numeric default 0,

  attempt_count         int not null default 0,
  max_attempts          int not null default 3,
  last_error            text,
  failed_step           text,

  -- 중간 산출물 (단계 완료 시 채워짐)
  vocals_path           text,
  instrumental_path     text,
  converted_vocals_path text,
  final_vocal_mix_path  text,
  scene_plan            jsonb,   -- {scenes:[{id,prompt,duration,image_url,video_url}]}
  landscape_url         text,    -- Supabase Storage: 16:9 최종
  portrait_url          text,    -- Supabase Storage: 9:16 최종
  thumbnail_url         text,

  title                 text,
  description           text,
  c2pa_signed           bool not null default false,

  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  updated_at            timestamptz not null default now()
);

create index if not exists idx_jobs_user_status
  on public.studio_jobs(user_id, status, created_at desc);

-- 활성 작업 큐 인덱스 (orchestrator 스캔용)
create index if not exists idx_jobs_active
  on public.studio_jobs(created_at)
  where status in (
    'pending','vocal_separating','vocal_rvc','vocal_mixing',
    'scene_planning','scene_image_gen','scene_video_gen',
    'lipsync','composing','formatting','watermarking','finalizing'
  );

-- studio_credits_ledger에 이제 FK 걸기
alter table public.studio_credits_ledger
  drop constraint if exists fk_ledger_job;
alter table public.studio_credits_ledger
  add constraint fk_ledger_job
  foreign key (job_id) references public.studio_jobs(id) on delete set null;

-- updated_at 자동 갱신 트리거
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_studio_jobs_touch on public.studio_jobs;
create trigger trg_studio_jobs_touch
  before update on public.studio_jobs
  for each row execute function public.touch_updated_at();

-- Realtime 활성화
alter publication supabase_realtime add table public.studio_jobs;

-- ============================================================
-- 4) Covers (완성 MV 작품)
-- ============================================================

create table if not exists public.covers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  job_id         uuid not null references public.studio_jobs(id) on delete cascade,
  title          text not null,
  landscape_url  text not null,
  portrait_url   text not null,
  thumbnail_url  text not null,
  duration_sec   numeric not null check (duration_sec > 0),
  sns_uploadable bool not null default false,  -- Phase 0은 전부 false (본인 MR)
  created_at     timestamptz not null default now()
);

create index if not exists idx_covers_user_time
  on public.covers(user_id, created_at desc);

create unique index if not exists idx_covers_job
  on public.covers(job_id);

-- ============================================================
-- 5) Moderation Events (3단계 검사 로그)
-- ============================================================

create table if not exists public.moderation_events (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid references public.studio_jobs(id) on delete set null,
  category    text not null check (category in (
                'nsfw','minor_face','celebrity_lookalike',
                'lyrics_policy','voice_not_owner','dmca','other')),
  severity    text not null check (severity in ('warn','block','review')),
  detail      jsonb not null default '{}'::jsonb,
  decided_by  text not null default 'auto',
  created_at  timestamptz not null default now()
);

create index if not exists idx_mod_user_time
  on public.moderation_events(user_id, created_at desc);

create index if not exists idx_mod_job
  on public.moderation_events(job_id)
  where job_id is not null;

-- ============================================================
-- RLS 정책 (본인 데이터만 조회/생성)
-- ============================================================

alter table public.studio_credits_ledger enable row level security;
alter table public.voice_identities      enable row level security;
alter table public.studio_jobs           enable row level security;
alter table public.covers                enable row level security;
alter table public.moderation_events     enable row level security;

-- credits_ledger: 본인 내역 조회만. 삽입은 SECURITY DEFINER 함수로만 (직접 insert 차단)
drop policy if exists "ledger_select_own" on public.studio_credits_ledger;
create policy "ledger_select_own" on public.studio_credits_ledger
  for select using (auth.uid() = user_id);

-- voice_identities: 본인 모델 조회·생성 가능, 업데이트·삭제는 service role (학습 완료/상태 전이)
drop policy if exists "voice_select_own" on public.voice_identities;
create policy "voice_select_own" on public.voice_identities
  for select using (auth.uid() = user_id);

drop policy if exists "voice_insert_own" on public.voice_identities;
create policy "voice_insert_own" on public.voice_identities
  for insert with check (auth.uid() = user_id);

-- studio_jobs: 본인 작업 조회·생성. 상태 전이는 orchestrator(service role)만
drop policy if exists "jobs_select_own" on public.studio_jobs;
create policy "jobs_select_own" on public.studio_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.studio_jobs;
create policy "jobs_insert_own" on public.studio_jobs
  for insert with check (auth.uid() = user_id);

-- covers: 본인 작품 조회만 (생성은 orchestrator)
drop policy if exists "covers_select_own" on public.covers;
create policy "covers_select_own" on public.covers
  for select using (auth.uid() = user_id);

-- moderation_events: 본인 기록만 조회 가능 (사유 알림용), 생성은 service role
drop policy if exists "mod_select_own" on public.moderation_events;
create policy "mod_select_own" on public.moderation_events
  for select using (auth.uid() = user_id);

-- ============================================================
-- 설명 주석
-- ============================================================

comment on table public.studio_credits_ledger is
  'Phase 0 크레딧 append-only 원장. 직접 insert 금지 — consume_credits/grant_credits RPC 사용.';
comment on table public.studio_jobs is
  'Phase 0 스튜디오 파이프라인 큐+상태머신+감사. Realtime 구독 활성.';
comment on table public.voice_identities is
  'Phase 0 본인 음색 RVC 모델. liveness_verified=true + status=ready만 사용 가능.';
comment on column public.studio_jobs.user_mr_path is
  'Phase 0은 본인 MR만 허용 — SNS 업로드 불가 (라이선스 리스크 회피).';
comment on column public.covers.sns_uploadable is
  'Phase 0에서는 항상 false. Phase 1 MR 카탈로그 도입 시 true 가능.';
