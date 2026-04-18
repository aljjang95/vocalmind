-- studio_jobs.style_preset CHECK 제약을 6개 스타일로 확장
-- 기존: cinematic, cozy, neon_city, fantasy
-- 추가: retro, ghibli

alter table public.studio_jobs
  drop constraint if exists studio_jobs_style_preset_check;

alter table public.studio_jobs
  add constraint studio_jobs_style_preset_check
  check (style_preset in (
    'cinematic', 'cozy', 'retro', 'ghibli', 'neon_city', 'fantasy'
  ));
