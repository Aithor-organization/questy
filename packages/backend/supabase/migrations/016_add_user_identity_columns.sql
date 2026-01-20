-- user_profiles에 email, display_name 컬럼 추가
-- 프론트엔드에서 service_role 없이 사용자 정보 조회 가능하게 함

-- 1. 컬럼 추가
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- 2. 회원가입 시 자동으로 user_profiles 생성하는 트리거
-- (기존에 user_memberships용 트리거가 있지만, user_profiles도 자동 생성)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (기존 트리거가 있으면 교체)
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. 로그인 시 last_sign_in_at 업데이트 트리거
CREATE OR REPLACE FUNCTION public.handle_user_sign_in()
RETURNS TRIGGER AS $$
BEGIN
  -- last_sign_in_at이 변경되었을 때만 업데이트
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
    UPDATE public.user_profiles
    SET
      last_sign_in_at = NEW.last_sign_in_at,
      email = COALESCE(NEW.email, email),
      display_name = COALESCE(NEW.raw_user_meta_data->>'name', display_name),
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_sign_in();

-- 4. 기존 사용자 데이터 백필
-- auth.users에서 user_profiles로 email, name, last_sign_in_at 동기화
INSERT INTO public.user_profiles (id, email, display_name, last_sign_in_at)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1)),
  last_sign_in_at
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  updated_at = NOW();

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON public.user_profiles(display_name);

-- 코멘트
COMMENT ON COLUMN public.user_profiles.email IS '사용자 이메일 (auth.users에서 동기화)';
COMMENT ON COLUMN public.user_profiles.display_name IS '표시 이름 (auth.users에서 동기화)';
COMMENT ON COLUMN public.user_profiles.last_sign_in_at IS '마지막 로그인 시간 (auth.users에서 동기화)';
