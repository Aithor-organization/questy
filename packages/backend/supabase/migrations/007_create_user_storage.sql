-- User Storage Table
-- Zustand 스토어 데이터를 사용자별로 저장
-- questStore, chatStore 등의 데이터를 Supabase에 저장

-- 테이블 생성 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS user_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL, -- 'quest', 'chat' 등
  key TEXT NOT NULL,        -- localStorage 키
  value TEXT NOT NULL,      -- JSON 직렬화된 상태
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_name, key)
);

-- 인덱스 생성 (이미 존재하면 스킵)
CREATE INDEX IF NOT EXISTS idx_user_storage_user_id ON user_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_store_name ON user_storage(store_name);
CREATE INDEX IF NOT EXISTS idx_user_storage_key ON user_storage(key);
CREATE INDEX IF NOT EXISTS idx_user_storage_user_store ON user_storage(user_id, store_name);

-- RLS 활성화
ALTER TABLE user_storage ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (idempotent)
DROP POLICY IF EXISTS "Users can read own storage" ON user_storage;
DROP POLICY IF EXISTS "Users can insert own storage" ON user_storage;
DROP POLICY IF EXISTS "Users can update own storage" ON user_storage;
DROP POLICY IF EXISTS "Users can delete own storage" ON user_storage;

-- RLS 정책: 자신의 데이터만 접근 가능
CREATE POLICY "Users can read own storage"
  ON user_storage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own storage"
  ON user_storage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own storage"
  ON user_storage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own storage"
  ON user_storage FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_user_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS set_user_storage_updated_at ON user_storage;

CREATE TRIGGER set_user_storage_updated_at
  BEFORE UPDATE ON user_storage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_storage_updated_at();

-- 주석
COMMENT ON TABLE user_storage IS 'Zustand 스토어 데이터를 사용자별로 저장';
COMMENT ON COLUMN user_storage.store_name IS '스토어 이름 (quest, chat 등)';
COMMENT ON COLUMN user_storage.key IS 'localStorage 키';
COMMENT ON COLUMN user_storage.value IS 'JSON 직렬화된 상태 데이터';
