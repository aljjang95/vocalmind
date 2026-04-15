-- 온보딩 결과를 profiles에 JSONB로 저장 (1:1 관계)
-- Supabase Dashboard > SQL Editor에서 실행

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_result JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.onboarding_result IS '온보딩 상담 결과 (tension + consultation)';
