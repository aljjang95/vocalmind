-- ────────────────────────────────────────────────────────────
-- 2026-04-15 스키마 수정
-- 1. avatars 테이블에 ref_image_url 컬럼 추가
-- 2. Storage 버킷 3개 (community-audio, audition-audio, avatars) 생성
-- ────────────────────────────────────────────────────────────

-- ═══ 1. avatars.ref_image_url 컬럼 추가 ═══
-- generate/route.ts 에서 upsert 시 ref_image_url 을 사용하므로 필요
alter table if exists avatars
  add column if not exists ref_image_url text;


-- ═══ 2. Storage 버킷 생성 ═══
-- 버킷이 이미 존재하면 무시 (ON CONFLICT DO NOTHING)

insert into storage.buckets (id, name, public)
values
  ('community-audio', 'community-audio', true),
  ('audition-audio',  'audition-audio',  true),
  ('avatars',         'avatars',         true)
on conflict (id) do nothing;


-- ═══ 3. Storage RLS 정책 ═══
-- community-audio: 인증된 유저만 업로드, 공개 다운로드

do $$
begin
  -- community-audio upload
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'community-audio: authenticated upload'
  ) then
    create policy "community-audio: authenticated upload"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'community-audio');
  end if;

  -- community-audio public read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'community-audio: public read'
  ) then
    create policy "community-audio: public read"
      on storage.objects for select
      to public
      using (bucket_id = 'community-audio');
  end if;

  -- audition-audio upload
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'audition-audio: authenticated upload'
  ) then
    create policy "audition-audio: authenticated upload"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'audition-audio');
  end if;

  -- audition-audio public read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'audition-audio: public read'
  ) then
    create policy "audition-audio: public read"
      on storage.objects for select
      to public
      using (bucket_id = 'audition-audio');
  end if;

  -- avatars upload (본인 경로만)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'avatars: authenticated upload'
  ) then
    create policy "avatars: authenticated upload"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  -- avatars upsert (update)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'avatars: authenticated update'
  ) then
    create policy "avatars: authenticated update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;

  -- avatars public read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'avatars: public read'
  ) then
    create policy "avatars: public read"
      on storage.objects for select
      to public
      using (bucket_id = 'avatars');
  end if;
end $$;
