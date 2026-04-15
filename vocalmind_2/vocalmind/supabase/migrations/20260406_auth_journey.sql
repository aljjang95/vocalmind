-- profiles (Auth 가입 시 trigger로 자동 생성)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'hobby', 'pro', 'teacher')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 프로필 읽기" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "본인 프로필 수정" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 가입 시 자동 프로필 생성 trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- evaluations (AI 채점 기록)
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL,
  score INTEGER,
  pitch_accuracy INTEGER,
  tone_stability REAL,
  tension_detected BOOLEAN DEFAULT FALSE,
  tension_detail TEXT DEFAULT '',
  feedback TEXT DEFAULT '',
  passed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 채점 읽기" ON evaluations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 채점 쓰기" ON evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- teacher는 모든 학생 채점 읽기 가능
CREATE POLICY "선생님 전체 읽기" ON evaluations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- progress (단계별 진도)
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL,
  best_score INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  passed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stage_id)
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 진도 읽기" ON progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 진도 쓰기" ON progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 진도 수정" ON progress
  FOR UPDATE USING (auth.uid() = user_id);

-- teacher 전체 진도 읽기
CREATE POLICY "선생님 진도 읽기" ON progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );
