-- API 사용량 추적 (AI 커버 등 유료 API)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS api_usage_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS api_usage_reset_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN profiles.api_usage_won IS '이번 달 API 사용액 (원)';
COMMENT ON COLUMN profiles.api_usage_reset_at IS 'API 사용량 월 리셋 시점';
