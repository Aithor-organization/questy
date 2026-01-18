-- User Memberships Table
-- 사용자 멤버십 관리 (승인 대기, 베타테스터, 실험단)

-- 멤버십 테이블 생성
CREATE TABLE IF NOT EXISTS user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 멤버십 유형: pending (승인대기), beta_tester (7일), lab_member (무기한)
  membership_type TEXT NOT NULL DEFAULT 'pending' CHECK (membership_type IN ('pending', 'beta_tester', 'lab_member')),

  -- 멤버십 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),

  -- 승인 정보
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- 만료 시간 (beta_tester: 승인 후 7일 자정, lab_member: NULL)
  expires_at TIMESTAMPTZ,

  -- 관리자 메모
  admin_note TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- 사용자당 하나의 멤버십만 허용
  UNIQUE(user_id)
);

-- RLS 활성화
ALTER TABLE user_memberships ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 멤버십 정보만 조회 가능
CREATE POLICY "Users can read own membership"
  ON user_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 관리자만 멤버십 생성/수정/삭제 가능
-- (관리자 체크는 admins 테이블에서 수행)
CREATE POLICY "Admins can manage all memberships"
  ON user_memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_status ON user_memberships(status);
CREATE INDEX IF NOT EXISTS idx_user_memberships_type ON user_memberships(membership_type);
CREATE INDEX IF NOT EXISTS idx_user_memberships_expires_at ON user_memberships(expires_at);

-- 자동 updated_at 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_memberships_updated_at
  BEFORE UPDATE ON user_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memberships_updated_at();

-- 회원가입 시 자동으로 pending 멤버십 생성하는 트리거
CREATE OR REPLACE FUNCTION create_pending_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_memberships (user_id, membership_type, status)
  VALUES (NEW.id, 'pending', 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 새 사용자가 생성될 때 트리거 실행
CREATE TRIGGER on_auth_user_created_membership
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_pending_membership();

-- 기존 사용자들에게 lab_member 멤버십 부여 (이미 승인된 사용자로 간주)
-- 주의: 이 쿼리는 한 번만 실행되어야 함
INSERT INTO user_memberships (user_id, membership_type, status, approved_at)
SELECT id, 'lab_member', 'active', NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_memberships)
ON CONFLICT (user_id) DO NOTHING;
