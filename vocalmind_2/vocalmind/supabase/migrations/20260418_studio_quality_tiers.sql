-- Phase 0 품질 티어 도입 (2026-04-18)
-- 마스터 각인: "최고 품질을 겨냥하되 낭비 방지."
-- Draft/Pro/Studio 3티어별로 모델과 예산을 분기.

-- ============================================================
-- studio_jobs: quality_tier + budget_usd 컬럼 추가
-- ============================================================

alter table public.studio_jobs
  add column if not exists quality_tier text
    not null
    default 'pro'
    check (quality_tier in ('draft', 'pro', 'studio'));

alter table public.studio_jobs
  add column if not exists budget_usd numeric(10, 4)
    not null
    default 7.0
    check (budget_usd > 0 and budget_usd <= 50.0);

comment on column public.studio_jobs.quality_tier is
  'Phase 0 품질 티어. draft=FLUX Schnell+Wan2.2, pro=Seedream 4.5+Kling 2.6 Pro, studio=Seedream 5.0+Kling 3.0 Pro';
comment on column public.studio_jobs.budget_usd is
  '티어별 누적 API 원가 상한. 초과 시 scene_dispatcher가 mark_failed + 자동 환불.';

-- 기존 행들은 default로 채워짐 — pro/7$가 합리적 (과거 FLUX Schnell 기본값과 호환 가능)

-- ============================================================
-- STUDIO_PRICING 티어 뷰 (프론트에서 참조 가능)
-- ============================================================
-- 가격 정보 단일 진실 근원 — 코드 수정 없이 관리자가 UPDATE 가능한 테이블로 관리할 수도 있지만,
-- Phase 0은 단순 상수로 유지 (types/studio.ts + 이 뷰는 참고용).

create or replace view public.studio_tier_catalog as
select * from (values
  ('draft', 3,  3000,  15.0, 3, 2.0,
   'FLUX Schnell + Wan 2.2',           '빠른 체험용 15초'),
  ('pro',   15, 15000, 30.0, 5, 7.0,
   'Seedream 4.5 + Kling 2.6 Pro',     '표준 30초 — 대부분 여기서 시작'),
  ('studio',40, 40000, 60.0, 8, 18.0,
   'Seedream 5.0 Lite + Kling 3.0 Pro','프리미엄 60초 — 브랜드·인플루언서용')
) as t(
  tier         text,
  credits      integer,
  price_krw    integer,
  duration_sec numeric,
  scene_count  integer,
  budget_usd   numeric,
  model_label  text,
  tagline      text
);

comment on view public.studio_tier_catalog is
  'Phase 0 티어 카탈로그 뷰 — types/studio.ts의 STUDIO_PRICING과 동기화 유지.';

-- ============================================================
-- 감사 인덱스 (티어별 실제 사용 분포 분석용)
-- ============================================================

create index if not exists idx_studio_jobs_tier_status
  on public.studio_jobs(quality_tier, status);
