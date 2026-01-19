-- 015: Add 'regular' membership type
-- pending: 대기자 (신규 가입 시 기본값, 승인 대기)
-- regular: 일반인 (체험판 만료 후 강등, AI 기능 사용 불가)
-- beta_tester: 베타테스터 (7일 체험판, AI 기능 사용 가능)
-- lab_member: 실험단 (무기한, AI 기능 사용 가능)

-- 1. 기존 CHECK 제약조건 삭제
ALTER TABLE user_memberships
DROP CONSTRAINT IF EXISTS user_memberships_membership_type_check;

-- 2. 새로운 CHECK 제약조건 추가 (regular 포함)
ALTER TABLE user_memberships
ADD CONSTRAINT user_memberships_membership_type_check
CHECK (membership_type IN ('pending', 'regular', 'beta_tester', 'lab_member'));

-- 코멘트 추가
COMMENT ON COLUMN user_memberships.membership_type IS
'pending: 대기자(신규가입), regular: 일반인(만료후강등), beta_tester: 베타테스터(7일), lab_member: 실험단(무기한)';
