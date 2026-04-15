-- ────────────────────────────────────────────────────────────
-- Phase 13: 아바타 육성 + 소셜 — 테이블 + RLS + 인덱스
-- ────────────────────────────────────────────────────────────

-- ═══ F1: 음색 DNA ═══

create table vocal_dna (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  laryngeal      float not null,
  tongue_root    float not null,
  jaw            float not null,
  register_break float not null,
  tone_stability float not null,
  avg_pitch_hz   float,
  voice_type     text,
  source         text default 'onboarding',
  created_at     timestamptz default now(),
  unique(user_id)
);

create table vocal_dna_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  dna_snapshot   jsonb not null,
  created_at     timestamptz default now()
);

alter table vocal_dna enable row level security;
alter table vocal_dna_history enable row level security;

create policy "Users can read own DNA"
  on vocal_dna for select using (auth.uid() = user_id);
create policy "Users can insert own DNA"
  on vocal_dna for insert with check (auth.uid() = user_id);
create policy "Users can update own DNA"
  on vocal_dna for update using (auth.uid() = user_id);

create policy "Users can read own DNA history"
  on vocal_dna_history for select using (auth.uid() = user_id);
create policy "Users can insert own DNA history"
  on vocal_dna_history for insert with check (auth.uid() = user_id);


-- ═══ F2: 아바타 + 의상 ═══

create table avatars (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  base_image_url text not null,
  style_prompt   text,
  created_at     timestamptz default now(),
  unique(user_id)
);

create table shop_items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  image_url      text not null,
  price          int not null,
  is_season      boolean default false,
  season_end_at  timestamptz,
  is_reward_only boolean default false,
  created_at     timestamptz default now()
);

create table user_inventory (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  item_id        uuid references shop_items(id) not null,
  acquired_at    timestamptz default now(),
  source         text default 'purchase',
  unique(user_id, item_id)
);

create table user_equipped (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  hat_id         uuid references shop_items(id),
  top_id         uuid references shop_items(id),
  bottom_id      uuid references shop_items(id),
  accessory_id   uuid references shop_items(id),
  effect_id      uuid references shop_items(id),
  updated_at     timestamptz default now()
);

create table item_purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  item_id        uuid references shop_items(id) not null,
  amount         int not null,
  toss_payment_key text,
  toss_order_id  text,
  status         text default 'completed',
  created_at     timestamptz default now()
);

alter table avatars enable row level security;
alter table shop_items enable row level security;
alter table user_inventory enable row level security;
alter table user_equipped enable row level security;
alter table item_purchases enable row level security;

-- avatars: 아바타는 다른 유저 프로필에서도 보여야 함
create policy "Avatars are publicly readable"
  on avatars for select using (true);
create policy "Users can insert own avatar"
  on avatars for insert with check (auth.uid() = user_id);
create policy "Users can update own avatar"
  on avatars for update using (auth.uid() = user_id);

-- shop_items: 누구나 조회 가능
create policy "Shop items are publicly readable"
  on shop_items for select using (true);

-- user_inventory: 본인만
create policy "Users can read own inventory"
  on user_inventory for select using (auth.uid() = user_id);
create policy "Users can insert own inventory"
  on user_inventory for insert with check (auth.uid() = user_id);

-- user_equipped: 공개 읽기 (다른 유저 프로필 카드), 본인만 수정
create policy "Equipped items are publicly readable"
  on user_equipped for select using (true);
create policy "Users can insert own equipped"
  on user_equipped for insert with check (auth.uid() = user_id);
create policy "Users can update own equipped"
  on user_equipped for update using (auth.uid() = user_id);

-- item_purchases: 본인만
create policy "Users can read own purchases"
  on item_purchases for select using (auth.uid() = user_id);
create policy "Users can insert own purchases"
  on item_purchases for insert with check (auth.uid() = user_id);


-- ═══ F3: 커뮤니티 ═══

create table community_posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  type           text not null default 'cover',
  title          text,
  description    text,
  audio_url      text,
  song_title     text,
  song_artist    text,
  vote_count     int default 0,
  play_count     int default 0,
  is_deleted     boolean default false,
  created_at     timestamptz default now()
);

create index idx_posts_created on community_posts(created_at desc) where not is_deleted;
create index idx_posts_votes on community_posts(vote_count desc) where not is_deleted;
create index idx_posts_type on community_posts(type, created_at desc) where not is_deleted;

create table community_votes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  post_id        uuid references community_posts(id) on delete cascade not null,
  created_at     timestamptz default now(),
  unique(user_id, post_id)
);

alter table community_posts enable row level security;
alter table community_votes enable row level security;

create policy "Posts are publicly readable"
  on community_posts for select using (not is_deleted);
create policy "Users can insert own posts"
  on community_posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts"
  on community_posts for update using (auth.uid() = user_id);

create policy "Votes are publicly readable"
  on community_votes for select using (true);
create policy "Users can insert own votes"
  on community_votes for insert with check (auth.uid() = user_id);
create policy "Users can delete own votes"
  on community_votes for delete using (auth.uid() = user_id);


-- ═══ F4: 주간 오디션 ═══

create table audition_events (
  id             uuid primary key default gen_random_uuid(),
  song_title     text not null,
  song_artist    text not null,
  description    text,
  week_start     date not null,
  week_end       date not null,
  status         text default 'active',
  created_at     timestamptz default now()
);

create table audition_entries (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references audition_events(id) on delete cascade not null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  audio_url      text not null,
  vote_count     int default 0,
  rank           int,
  created_at     timestamptz default now(),
  unique(event_id, user_id)
);

create table audition_votes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  entry_id       uuid references audition_entries(id) on delete cascade not null,
  created_at     timestamptz default now(),
  unique(user_id, entry_id)
);

alter table audition_events enable row level security;
alter table audition_entries enable row level security;
alter table audition_votes enable row level security;

-- 오디션 이벤트/참가/투표: 공개 읽기
create policy "Audition events are publicly readable"
  on audition_events for select using (true);
create policy "Audition entries are publicly readable"
  on audition_entries for select using (true);
create policy "Audition votes are publicly readable"
  on audition_votes for select using (true);

-- 참가/투표: 본인만
create policy "Users can insert own entries"
  on audition_entries for insert with check (auth.uid() = user_id);
create policy "Users can insert own audition votes"
  on audition_votes for insert with check (auth.uid() = user_id);
create policy "Users can delete own audition votes"
  on audition_votes for delete using (auth.uid() = user_id);


-- ═══ 공통: 보상 ═══

create table user_rewards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  reward_type    text not null,
  reward_data    jsonb,
  source         text not null,
  created_at     timestamptz default now()
);

alter table user_rewards enable row level security;

create policy "Users can read own rewards"
  on user_rewards for select using (auth.uid() = user_id);
create policy "Users can insert own rewards"
  on user_rewards for insert with check (auth.uid() = user_id);


-- ═══ vote_count 자동 증감 함수 ═══

-- 커뮤니티 투표 시 자동 카운트
create or replace function increment_post_vote_count()
returns trigger as $$
begin
  update community_posts set vote_count = vote_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function decrement_post_vote_count()
returns trigger as $$
begin
  update community_posts set vote_count = greatest(vote_count - 1, 0) where id = old.post_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_community_vote_insert
  after insert on community_votes
  for each row execute function increment_post_vote_count();

create trigger on_community_vote_delete
  after delete on community_votes
  for each row execute function decrement_post_vote_count();

-- 오디션 투표 시 자동 카운트
create or replace function increment_entry_vote_count()
returns trigger as $$
begin
  update audition_entries set vote_count = vote_count + 1 where id = new.entry_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function decrement_entry_vote_count()
returns trigger as $$
begin
  update audition_entries set vote_count = greatest(vote_count - 1, 0) where id = old.entry_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_audition_vote_insert
  after insert on audition_votes
  for each row execute function increment_entry_vote_count();

create trigger on_audition_vote_delete
  after delete on audition_votes
  for each row execute function decrement_entry_vote_count();
