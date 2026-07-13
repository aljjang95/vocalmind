-- 2026-06-15 Storage public bucket hardening
-- Supabase security advisor 대상: audition-audio, avatars, community-audio, demo-audio.
-- 버킷 public flag를 끄고 앱은 signed URL/내부 프록시로 접근한다.

update storage.buckets
set public = false
where id in ('audition-audio', 'avatars', 'community-audio', 'demo-audio');
drop policy if exists "community-audio: public read" on storage.objects;
drop policy if exists "audition-audio: public read" on storage.objects;
drop policy if exists "avatars: public read" on storage.objects;

-- 기존 public object URL로 저장된 행은 Storage object path만 남긴다.
update public.community_posts
set audio_url = regexp_replace(audio_url, '^.*/storage/v1/object/public/community-audio/', '')
where audio_url like '%/storage/v1/object/public/community-audio/%';

update public.audition_entries
set audio_url = regexp_replace(audio_url, '^.*/storage/v1/object/public/audition-audio/', '')
where audio_url like '%/storage/v1/object/public/audition-audio/%';

update public.avatars
set
  base_image_url = case
    when base_image_url like '%/storage/v1/object/public/avatars/%'
      then regexp_replace(base_image_url, '^.*/storage/v1/object/public/avatars/', '')
    else base_image_url
  end,
  ref_image_url = case
    when ref_image_url like '%/storage/v1/object/public/avatars/%'
      then regexp_replace(ref_image_url, '^.*/storage/v1/object/public/avatars/', '')
    else ref_image_url
  end;
