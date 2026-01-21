-- Migration: 018_add_last_active_at.sql
-- 사용자 활동 추적을 위한 last_active_at 컬럼 추가
-- Created: 2026-01-21

-- ============================================
-- 1. last_active_at 컬럼 추가
-- ============================================

-- last_sign_in_at: 로그인 시간 (auth.users에서 동기화)
-- last_active_at: API 호출 시 업데이트되는 실제 활동 시간

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ============================================
-- 2. 인덱스 추가 (온라인 사용자 조회 성능 향상)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active_at
ON public.user_profiles(last_active_at DESC NULLS LAST);

-- ============================================
-- 3. 기존 사용자 초기값 설정
-- ============================================

-- 기존 사용자들의 last_active_at을 last_sign_in_at으로 초기화
UPDATE public.user_profiles
SET last_active_at = last_sign_in_at
WHERE last_active_at IS NULL AND last_sign_in_at IS NOT NULL;

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON COLUMN public.user_profiles.last_active_at IS '마지막 활동 시간 (API 호출 시 업데이트, 온라인 상태 판별용)';
