-- QuestyBook 관리자 테이블
-- Supabase SQL Editor에서 실행

-- admins 테이블 생성
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS 활성화
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자 본인만 자신의 정보 조회 가능
CREATE POLICY "Admins can view own record"
  ON public.admins
  FOR SELECT
  USING (auth.uid() = user_id);

-- 정책: 서비스 역할만 관리자 추가/수정 가능 (Supabase 대시보드에서 관리)
CREATE POLICY "Service role can manage admins"
  ON public.admins
  FOR ALL
  USING (auth.role() = 'service_role');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON public.admins(user_id);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION update_admins_updated_at();

-- 관리자 확인 함수 (RPC로 호출 가능)
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 첫 번째 관리자 추가 예시 (실제 user_id로 교체 필요)
-- INSERT INTO public.admins (user_id, name, role)
-- VALUES ('your-supabase-user-uuid', '관리자', 'super_admin');

COMMENT ON TABLE public.admins IS 'QuestyBook 관리자 테이블';
COMMENT ON COLUMN public.admins.role IS 'admin: 일반 관리자, super_admin: 슈퍼 관리자';
