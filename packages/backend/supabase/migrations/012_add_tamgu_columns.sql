-- 탐구 과목 선택 컬럼 추가
-- 기존 user_profiles 테이블에 탐구 과목 컬럼 추가

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS selected_tamgu1 TEXT,
ADD COLUMN IF NOT EXISTS selected_tamgu2 TEXT;

-- 코멘트
COMMENT ON COLUMN public.user_profiles.selected_tamgu1 IS '탐구1 선택 과목';
COMMENT ON COLUMN public.user_profiles.selected_tamgu2 IS '탐구2 선택 과목';
