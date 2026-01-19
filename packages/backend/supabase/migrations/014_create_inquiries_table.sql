-- 014_create_inquiries_table.sql
-- 1:1 문의 테이블 생성

-- 문의 테이블 생성
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_inquiries_user_email ON inquiries(user_email);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);

-- RLS 활성화
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 정책: Service Role은 모든 작업 가능
CREATE POLICY "Service role can do all" ON inquiries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 정책: 인증된 사용자는 자신의 문의만 조회 가능
CREATE POLICY "Users can view own inquiries" ON inquiries
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- 정책: 인증된 사용자는 문의 생성 가능
CREATE POLICY "Users can create inquiries" ON inquiries
  FOR INSERT
  WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE inquiries IS '1:1 문의 테이블';
COMMENT ON COLUMN inquiries.category IS '문의 유형: general, bug, suggestion, account, payment, other';
COMMENT ON COLUMN inquiries.status IS '처리 상태: pending, in_progress, resolved, closed';
