-- 사용자 프로필 테이블 (온보딩 정보)
-- 회원가입 후 온보딩 완료 시 저장

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기본 정보
  age INTEGER,
  exam_year INTEGER DEFAULT 0,  -- 0=현역, 1=재수, 2=삼수, 3=그 이상

  -- 목표 정보
  target_university TEXT,
  target_grades JSONB DEFAULT '{}',  -- {"국어": 1, "수학": 1, "영어": 2, ...}
  current_grades JSONB DEFAULT '{}', -- {"국어": 3, "수학": 2, "영어": 3, ...}

  -- 학습 환경
  subscribed_platforms TEXT[] DEFAULT '{}',  -- ['megastudy', 'etoos', 'daesung', ...]
  daily_study_hours INTEGER DEFAULT 8,

  -- 온보딩 상태
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 정책: 사용자는 자신의 프로필만 조회/수정 가능
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding
  ON public.user_profiles(onboarding_completed);

-- 트리거: updated_at 자동 갱신
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트
COMMENT ON TABLE public.user_profiles IS '사용자 프로필 (온보딩 정보)';
COMMENT ON COLUMN public.user_profiles.exam_year IS 'N수생 여부: 0=현역, 1=재수, 2=삼수, 3=그 이상';
COMMENT ON COLUMN public.user_profiles.target_grades IS '과목별 목표 등급 (JSON)';
COMMENT ON COLUMN public.user_profiles.current_grades IS '과목별 현재 등급 (JSON)';
COMMENT ON COLUMN public.user_profiles.subscribed_platforms IS '구독 중인 인강 사이트 목록';
