-- user_profiles에 subscribed_platform_detail 컬럼 추가
-- 인강 사이트 '기타' 선택 시 세부 내용 저장

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS subscribed_platform_detail TEXT;

COMMENT ON COLUMN public.user_profiles.subscribed_platform_detail IS '기타 인강 사이트 세부 내용 (other 선택 시)';
