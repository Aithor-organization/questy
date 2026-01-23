-- 온보딩 완료 시 베타테스터로 자동 활성화
-- pending 상태인 사용자가 온보딩을 완료하면 beta_tester로 변경

-- 베타테스터 활성화 함수 (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION activate_beta_membership()
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  current_membership RECORD;
  new_expires_at TIMESTAMPTZ;
  result JSON;
BEGIN
  -- 현재 로그인한 사용자 ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '로그인이 필요합니다');
  END IF;

  -- 현재 멤버십 확인
  SELECT * INTO current_membership
  FROM user_memberships
  WHERE user_id = current_user_id;

  -- 멤버십이 없으면 에러
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '멤버십 정보가 없습니다');
  END IF;

  -- 이미 활성화된 멤버십이면 무시 (lab_member, 이미 active인 beta_tester 등)
  IF current_membership.status = 'active' AND current_membership.membership_type != 'pending' THEN
    RETURN json_build_object(
      'success', true,
      'message', '이미 활성화된 멤버십입니다',
      'membership_type', current_membership.membership_type,
      'status', current_membership.status
    );
  END IF;

  -- pending 상태가 아니면 에러 (이미 다른 상태로 처리됨)
  IF current_membership.membership_type != 'pending' THEN
    RETURN json_build_object(
      'success', true,
      'message', '이미 처리된 멤버십입니다',
      'membership_type', current_membership.membership_type,
      'status', current_membership.status
    );
  END IF;

  -- 만료일 계산: 7일 후 자정 (KST 기준)
  -- KST = UTC + 9시간이므로, 현재 KST 날짜의 자정 + 7일
  new_expires_at := (
    DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul') + INTERVAL '7 days'
  ) AT TIME ZONE 'Asia/Seoul';

  -- 멤버십 업데이트: pending → beta_tester (active)
  UPDATE user_memberships
  SET
    membership_type = 'beta_tester',
    status = 'active',
    approved_at = NOW(),
    expires_at = new_expires_at,
    updated_at = NOW()
  WHERE user_id = current_user_id;

  RETURN json_build_object(
    'success', true,
    'message', '베타테스터로 활성화되었습니다',
    'membership_type', 'beta_tester',
    'status', 'active',
    'expires_at', new_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION activate_beta_membership() TO authenticated;

-- 코멘트
COMMENT ON FUNCTION activate_beta_membership() IS '온보딩 완료 시 pending 멤버십을 beta_tester로 활성화 (7일 체험)';
