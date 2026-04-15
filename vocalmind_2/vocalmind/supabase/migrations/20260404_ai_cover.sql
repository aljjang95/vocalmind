-- AI Cover 기능용 테이블 및 스토리지 설정
-- 생성일: 2026-04-04

-- ============================================================
-- 1. voice_models — 사용자별 음성 모델
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  model_path  TEXT,
  index_path  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'training', 'completed', 'failed')),
  epochs      INT NOT NULL DEFAULT 50,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. ai_cover_songs — 업로드된 노래
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cover_songs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  original_path       TEXT,
  vocals_path         TEXT,
  instrumental_path   TEXT,
  separation_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (separation_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. ai_cover_conversions — 변환 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cover_conversions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id       UUID NOT NULL REFERENCES ai_cover_songs(id) ON DELETE CASCADE,
  model_id      UUID REFERENCES voice_models(id),
  pitch_shift   INT NOT NULL DEFAULT 0,
  output_path   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'separating', 'converting', 'mixing', 'completed', 'failed')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. ai_cover_usage — 월별 사용량
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cover_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month  TEXT NOT NULL,
  count       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_month)
);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE voice_models        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cover_songs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cover_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cover_usage      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS 정책 — voice_models
-- ============================================================
CREATE POLICY "voice_models_select" ON voice_models
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "voice_models_insert" ON voice_models
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "voice_models_update" ON voice_models
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "voice_models_delete" ON voice_models
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS 정책 — ai_cover_songs
-- ============================================================
CREATE POLICY "ai_cover_songs_select" ON ai_cover_songs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_cover_songs_insert" ON ai_cover_songs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_cover_songs_update" ON ai_cover_songs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ai_cover_songs_delete" ON ai_cover_songs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS 정책 — ai_cover_conversions
-- ============================================================
CREATE POLICY "ai_cover_conversions_select" ON ai_cover_conversions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_cover_conversions_insert" ON ai_cover_conversions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_cover_conversions_update" ON ai_cover_conversions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ai_cover_conversions_delete" ON ai_cover_conversions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- RLS 정책 — ai_cover_usage
-- ============================================================
CREATE POLICY "ai_cover_usage_select" ON ai_cover_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_cover_usage_insert" ON ai_cover_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_cover_usage_update" ON ai_cover_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 월별 사용량 증가 함수
-- ============================================================
CREATE OR REPLACE FUNCTION increment_cover_usage(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_month TEXT := to_char(now(), 'YYYY-MM');
  v_count INT;
BEGIN
  INSERT INTO ai_cover_usage (user_id, year_month, count)
  VALUES (p_user_id, v_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET count = ai_cover_usage.count + 1, updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- updated_at 자동 갱신 트리거 (voice_models, ai_cover_usage)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_models_updated_at
  BEFORE UPDATE ON voice_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ai_cover_usage_updated_at
  BEFORE UPDATE ON ai_cover_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage 버킷 (Supabase 대시보드에서 수동 생성하거나 아래 실행)
-- ============================================================
-- ai-cover-models  : RVC 모델 파일 (.pth, .index)
-- ai-cover-songs   : 업로드 원본 + 분리 결과 오디오
-- ai-cover-output  : 변환 완료 결과 오디오

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('ai-cover-models', 'ai-cover-models', false, 209715200,  -- 200 MB
   ARRAY['application/octet-stream']),
  ('ai-cover-songs',  'ai-cover-songs',  false, 52428800,   -- 50 MB
   ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4']),
  ('ai-cover-output', 'ai-cover-output', false, 52428800,   -- 50 MB
   ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS 정책 — 자기 폴더(user_id/)만 접근 허용
CREATE POLICY "ai_cover_models_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'ai-cover-models'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "ai_cover_songs_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'ai-cover-songs'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "ai_cover_output_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'ai-cover-output'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
