/**
 * Admin Users Routes
 * 사용자 및 멤버십 관리 API
 *
 * 관리자 전용 라우트는 adminOnly 미들웨어 적용
 * membership/status는 일반 사용자 접근 허용 (인증만 필요)
 */

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { sendEmail, getMembershipApprovalEmail } from '../lib/email.js';
import { adminOnly, authenticate } from '../middleware/auth.js';

export const adminUsersRoutes = new Hono();

// 멤버십 유형
type MembershipType = 'pending' | 'regular' | 'beta_tester' | 'lab_member';
type MembershipStatus = 'pending' | 'active' | 'expired' | 'revoked';

// 사용자 정보 인터페이스
interface UserWithMembership {
  id: string;
  email: string;
  createdAt: string;
  membership: {
    type: MembershipType;
    status: MembershipStatus;
    approvedAt: string | null;
    expiresAt: string | null;
    adminNote: string | null;
  } | null;
}

/**
 * 베타테스터 만료 시간 계산 (승인 후 7일 자정)
 */
function calculateBetaTesterExpiry(): string {
  const now = new Date();
  // 7일 후 계산
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + 7);
  // 해당 날짜 자정으로 설정 (00:00:00)
  expiry.setHours(0, 0, 0, 0);
  return expiry.toISOString();
}

// 관리자 권한 확인은 이제 middleware/auth.ts의 adminOnly 미들웨어로 처리

/**
 * 모든 사용자 목록 조회 (관리자용) - P2 페이지네이션 적용
 * GET /api/admin/users
 *
 * Query params:
 * - page: 페이지 번호 (기본 1)
 * - limit: 페이지당 항목 수 (기본 50, 최대 100)
 * - status: 멤버십 상태 필터 (optional: pending, active, expired, revoked)
 * - type: 멤버십 유형 필터 (optional: pending, regular, beta_tester, lab_member)
 */
adminUsersRoutes.get('/users', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // 쿼리 파라미터 파싱
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const statusFilter = c.req.query('status') as MembershipStatus | undefined;
    const typeFilter = c.req.query('type') as MembershipType | undefined;

    const offset = (page - 1) * limit;

    // 필터가 적용된 쿼리 빌더
    let queryBuilder = supabase
      .from('user_memberships')
      .select(`
        id,
        user_id,
        membership_type,
        status,
        approved_at,
        expires_at,
        admin_note,
        created_at,
        updated_at
      `, { count: 'exact' });

    // 필터 적용
    if (statusFilter) {
      queryBuilder = queryBuilder.eq('status', statusFilter);
    }
    if (typeFilter) {
      queryBuilder = queryBuilder.eq('membership_type', typeFilter);
    }

    // 페이지네이션 및 정렬
    const { data: memberships, error, count } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[AdminUsers] Get users error:', error);
      return c.json({ success: false, error: '사용자 목록 조회 실패' }, 500);
    }

    // 현재 페이지의 사용자 ID만 추출
    const userIds = memberships?.map(m => m.user_id) || [];

    if (userIds.length === 0) {
      return c.json({
        success: true,
        data: {
          users: [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      });
    }

    // 현재 페이지 사용자들의 auth 정보만 조회 (최적화)
    const userInfo: Record<string, { email: string; name: string; lastSignInAt: string | null }> = {};

    // 현재 페이지 사용자들만 개별 조회 (N개만 조회하므로 효율적)
    const userPromises = userIds.map(async (userId) => {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user) {
          const email = userData.user.email || '';
          const name = userData.user.user_metadata?.name || email.split('@')[0] || '이름 없음';
          const lastSignInAt = userData.user.last_sign_in_at || null;
          userInfo[userId] = { email, name, lastSignInAt };
        }
      } catch (e) {
        // 개별 사용자 조회 실패는 무시
      }
    });

    await Promise.all(userPromises);

    // 데이터 병합
    const users = memberships?.map(m => {
      const info = userInfo[m.user_id];
      return {
        id: m.user_id,
        name: info?.name || '이름 없음',
        email: info?.email || '',
        createdAt: m.created_at,
        lastLoginAt: info?.lastSignInAt || null,  // 마지막 로그인 시간 추가
        membership: {
          type: m.membership_type,
          status: m.status,
          approvedAt: m.approved_at,
          expiresAt: m.expires_at,
          adminNote: m.admin_note,
        },
      };
    }) || [];

    return c.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Get users error:', error);
    return c.json({ success: false, error: error.message || '사용자 목록 조회 실패' }, 500);
  }
});

/**
 * 일괄 멤버십 변경
 * POST /api/admin/users/bulk/membership
 *
 * NOTE: 이 라우트는 /users/:userId/membership보다 먼저 정의되어야 함
 * 그렇지 않으면 'bulk'가 :userId 파라미터로 매칭됨
 */
adminUsersRoutes.post('/users/bulk/membership', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const body = await c.req.json();
    const { userIds, membershipType, adminNote } = body as {
      userIds: string[];
      membershipType: MembershipType;
      adminNote?: string;
    };

    // 유효성 검사
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ success: false, error: '선택된 사용자가 없습니다' }, 400);
    }

    if (!['pending', 'regular', 'beta_tester', 'lab_member'].includes(membershipType)) {
      return c.json({ success: false, error: '유효하지 않은 멤버십 유형입니다' }, 400);
    }

    const now = new Date().toISOString();

    // 멤버십 타입에 따른 설정
    let status: MembershipStatus;
    let expiresAt: string | null = null;
    let approvedAt: string | null = null;

    if (membershipType === 'pending') {
      status = 'pending';
    } else if (membershipType === 'regular') {
      // 일반인 (체험판 만료 강등)
      status = 'expired';
    } else if (membershipType === 'beta_tester') {
      status = 'active';
      expiresAt = calculateBetaTesterExpiry();
      approvedAt = now;
    } else {
      status = 'active';
      approvedAt = now;
    }

    // 일괄 멤버십 업데이트 (개별 업데이트로 안정성 확보)
    const updatePromises = userIds.map((userId) =>
      supabase
        .from('user_memberships')
        .update({
          membership_type: membershipType,
          status,
          approved_at: approvedAt,
          expires_at: expiresAt,
          admin_note: adminNote || null,
          updated_at: now,
        })
        .eq('user_id', userId)
        .select()
        .single()
    );

    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.data).length;
    const failures = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));

    if (failures.length === userIds.length) {
      // 모든 업데이트 실패
      const firstError = failures[0];
      const errorMsg = firstError.status === 'rejected'
        ? firstError.reason?.message
        : (firstError as PromiseFulfilledResult<any>).value?.error?.message;
      console.error('[AdminUsers] Bulk membership update all failed:', errorMsg);
      return c.json({
        success: false,
        error: `일괄 멤버십 변경 실패: ${errorMsg || '알 수 없는 오류'}`,
      }, 500);
    }

    // 부분 성공도 성공으로 처리 (일부 실패 시 로그)
    if (failures.length > 0) {
      console.warn(`[AdminUsers] Bulk update partial failure: ${successCount}/${userIds.length} succeeded`);
    }

    console.log(`[AdminUsers] Bulk membership changed: ${userIds.length} users -> ${membershipType}`);

    // 승인 시 이메일 발송 (beta_tester, lab_member인 경우만)
    let emailsSent = 0;
    if (membershipType === 'beta_tester' || membershipType === 'lab_member') {
      for (const userId of userIds) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (userData?.user?.email) {
            const userName = userData.user.user_metadata?.name || userData.user.email.split('@')[0];
            const { subject, html } = getMembershipApprovalEmail(userName, membershipType);

            const emailResult = await sendEmail({
              to: userData.user.email,
              subject,
              html,
            });

            if (emailResult.success) {
              emailsSent++;
            }
          }
        } catch (emailError) {
          console.warn(`[AdminUsers] Bulk email failed for ${userId}:`, emailError);
        }
      }
      console.log(`[AdminUsers] Bulk approval emails sent: ${emailsSent}/${userIds.length}`);
    }

    return c.json({
      success: true,
      data: {
        updatedCount: successCount,
        membershipType,
        status,
        emailsSent,
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Bulk membership error:', error);
    return c.json({
      success: false,
      error: error.message || '일괄 멤버십 변경 실패',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, 500);
  }
});

/**
 * 일괄 사용자 삭제
 * DELETE /api/admin/users/bulk
 *
 * NOTE: 이 라우트도 /users/:userId 패턴보다 먼저 정의되어야 함
 */
adminUsersRoutes.delete('/users/bulk', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const body = await c.req.json();
    const { userIds } = body as { userIds: string[] };

    // 유효성 검사
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ success: false, error: '선택된 사용자가 없습니다' }, 400);
    }

    // 1. user_memberships 삭제
    const { error: membershipError } = await supabase
      .from('user_memberships')
      .delete()
      .in('user_id', userIds);

    if (membershipError) {
      console.error('[AdminUsers] Delete memberships error:', membershipError);
    }

    // 2. user_profiles 삭제
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .in('user_id', userIds);

    if (profileError) {
      console.error('[AdminUsers] Delete profiles error:', profileError);
    }

    // 3. students 테이블 삭제 (관련 데이터 포함)
    const { error: studentError } = await supabase
      .from('students')
      .delete()
      .in('user_id', userIds);

    if (studentError) {
      console.error('[AdminUsers] Delete students error:', studentError);
    }

    // 4. auth.users 삭제 (Admin API 사용)
    let deletedCount = 0;
    const failedDeletes: string[] = [];

    for (const userId of userIds) {
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
          console.error(`[AdminUsers] Delete auth user ${userId} error:`, authError);
          failedDeletes.push(userId);
        } else {
          deletedCount++;
        }
      } catch (e) {
        console.error(`[AdminUsers] Delete auth user ${userId} exception:`, e);
        failedDeletes.push(userId);
      }
    }

    console.log(`[AdminUsers] Bulk delete: ${deletedCount}/${userIds.length} users deleted`);

    return c.json({
      success: true,
      data: {
        deletedCount,
        totalRequested: userIds.length,
        failedDeletes: failedDeletes.length > 0 ? failedDeletes : undefined,
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Bulk delete error:', error);
    return c.json({ success: false, error: error.message || '일괄 사용자 삭제 실패' }, 500);
  }
});

/**
 * 멤버십 변경 (대기자/베타테스터/실험단)
 * POST /api/admin/users/:userId/membership
 */
adminUsersRoutes.post('/users/:userId/membership', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { membershipType, adminNote } = body as {
      membershipType: MembershipType;
      adminNote?: string;
    };

    // 유효한 멤버십 유형 확인
    if (!['pending', 'regular', 'beta_tester', 'lab_member'].includes(membershipType)) {
      return c.json({ success: false, error: '유효하지 않은 멤버십 유형입니다' }, 400);
    }

    const now = new Date().toISOString();

    // 멤버십 타입에 따른 설정
    let status: MembershipStatus;
    let expiresAt: string | null = null;
    let approvedAt: string | null = null;

    if (membershipType === 'pending') {
      // 대기자로 변경 (신규 가입 대기)
      status = 'pending';
      expiresAt = null;
      approvedAt = null;
    } else if (membershipType === 'regular') {
      // 일반인으로 변경 (체험판 만료 강등)
      status = 'expired';
      expiresAt = null;
      approvedAt = null;
    } else if (membershipType === 'beta_tester') {
      // 베타테스터 (7일)
      status = 'active';
      expiresAt = calculateBetaTesterExpiry();
      approvedAt = now;
    } else {
      // 실험단 (무기한)
      status = 'active';
      expiresAt = null;
      approvedAt = now;
    }

    // 멤버십 업데이트
    const { data, error } = await supabase
      .from('user_memberships')
      .update({
        membership_type: membershipType,
        status,
        approved_at: approvedAt,
        expires_at: expiresAt,
        admin_note: adminNote || null,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AdminUsers] Membership update error:', error);
      return c.json({ success: false, error: '멤버십 변경 실패' }, 500);
    }

    console.log(`[AdminUsers] Membership changed: ${userId} -> ${membershipType} (${status})`);

    // 베타테스터/실험단 승인 시 알림 이메일 발송
    if (membershipType !== 'pending') {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user?.email) {
          const userName = userData.user.user_metadata?.name || userData.user.email.split('@')[0];
          const { subject, html } = getMembershipApprovalEmail(userName, membershipType);

          console.log(`[AdminUsers] Sending approval email to: ${userData.user.email}`);
          const emailResult = await sendEmail({
            to: userData.user.email,
            subject,
            html,
          });

          if (emailResult.success) {
            console.log(`[AdminUsers] Approval email sent: ${emailResult.id}`);
          } else {
            console.warn(`[AdminUsers] Approval email failed: ${emailResult.error}`);
          }
        }
      } catch (emailError) {
        console.warn('[AdminUsers] Email notification failed:', emailError);
      }
    }

    return c.json({
      success: true,
      data: {
        userId,
        membershipType,
        status,
        approvedAt,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Membership change error:', error);
    return c.json({ success: false, error: error.message || '멤버십 변경 실패' }, 500);
  }
});

/**
 * 멤버십 승인 (레거시 호환용)
 * POST /api/admin/users/:userId/approve
 */
adminUsersRoutes.post('/users/:userId/approve', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { membershipType, adminNote } = body as {
      membershipType: MembershipType;
      adminNote?: string;
    };

    // 유효한 멤버십 유형 확인
    if (!['beta_tester', 'lab_member'].includes(membershipType)) {
      return c.json({ success: false, error: '유효하지 않은 멤버십 유형입니다' }, 400);
    }

    const now = new Date().toISOString();
    const expiresAt = membershipType === 'beta_tester' ? calculateBetaTesterExpiry() : null;

    // 멤버십 업데이트
    const { data, error } = await supabase
      .from('user_memberships')
      .update({
        membership_type: membershipType,
        status: 'active',
        approved_at: now,
        expires_at: expiresAt,
        admin_note: adminNote || null,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AdminUsers] Approve error:', error);
      return c.json({ success: false, error: '멤버십 승인 실패' }, 500);
    }

    console.log(`[AdminUsers] Approved: ${userId} as ${membershipType}`);

    return c.json({
      success: true,
      data: {
        userId,
        membershipType,
        status: 'active',
        approvedAt: now,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Approve error:', error);
    return c.json({ success: false, error: error.message || '멤버십 승인 실패' }, 500);
  }
});

/**
 * 멤버십 취소/철회
 * POST /api/admin/users/:userId/revoke
 */
adminUsersRoutes.post('/users/:userId/revoke', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const userId = c.req.param('userId');
    const body = await c.req.json().catch(() => ({}));
    const { adminNote } = body as { adminNote?: string };

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_memberships')
      .update({
        status: 'revoked',
        admin_note: adminNote || null,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AdminUsers] Revoke error:', error);
      return c.json({ success: false, error: '멤버십 취소 실패' }, 500);
    }

    console.log(`[AdminUsers] Revoked: ${userId}`);

    return c.json({
      success: true,
      data: {
        userId,
        status: 'revoked',
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Revoke error:', error);
    return c.json({ success: false, error: error.message || '멤버십 취소 실패' }, 500);
  }
});

/**
 * 멤버십 상태 조회 (사용자용 - 일반 사용자도 자신의 멤버십 조회 가능)
 * GET /api/admin/membership/status
 */
adminUsersRoutes.get('/membership/status', authenticate, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // authenticate 미들웨어에서 인증 완료 - 사용자 정보 가져오기
    const authUser = c.get('user') as { id: string; email: string; role: string };
    const userId = authUser.id;

    // 멤버십 정보 조회
    const { data: membership, error } = await supabase
      .from('user_memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AdminUsers] Get membership error:', error);
      return c.json({ success: false, error: '멤버십 정보 조회 실패' }, 500);
    }

    // 멤버십이 없는 경우 (이상 케이스)
    if (!membership) {
      return c.json({
        success: true,
        data: {
          type: 'pending',
          status: 'pending',
          approvedAt: null,
          expiresAt: null,
          remainingDays: null,
          isExpired: false,
        },
      });
    }

    // 만료 여부 확인 및 남은 일수 계산
    let isExpired = false;
    let remainingDays: number | null = null;
    let currentType = membership.membership_type;
    let currentStatus = membership.status;

    if (membership.expires_at) {
      const expiresAt = new Date(membership.expires_at);
      const now = new Date();
      isExpired = now > expiresAt;

      if (!isExpired) {
        const diffMs = expiresAt.getTime() - now.getTime();
        remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    // 만료된 베타테스터는 일반인으로 강등 (pending은 신규 가입자용)
    if (isExpired && membership.status === 'active' && membership.membership_type === 'beta_tester') {
      await supabase
        .from('user_memberships')
        .update({
          membership_type: 'regular',
          status: 'expired',
          expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      currentType = 'regular';
      currentStatus = 'expired';
      console.log(`[AdminUsers] Beta tester expired, demoted to regular: ${userId}`);
    }

    return c.json({
      success: true,
      data: {
        type: currentType,
        status: currentStatus,
        approvedAt: membership.approved_at,
        expiresAt: membership.expires_at,
        remainingDays: isExpired ? null : remainingDays,
        isExpired,
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Get membership status error:', error);
    return c.json({ success: false, error: error.message || '멤버십 조회 실패' }, 500);
  }
});

/**
 * 사용자 학습 프로필 조회 (관리자용) - P2 페이지네이션 및 Join 최적화
 * GET /api/admin/users/learning-profiles
 *
 * Query params:
 * - page: 페이지 번호 (기본 1)
 * - limit: 페이지당 항목 수 (기본 50, 최대 100)
 * - onboardingCompleted: 온보딩 완료 필터 (optional: true/false)
 */
adminUsersRoutes.get('/users/learning-profiles', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // 쿼리 파라미터 파싱
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
    const onboardingFilter = c.req.query('onboardingCompleted');

    const offset = (page - 1) * limit;

    // 필터가 적용된 쿼리 빌더
    let queryBuilder = supabase
      .from('user_profiles')
      .select(`
        id,
        age,
        exam_year,
        target_university,
        target_grades,
        current_grades,
        selected_tamgu1,
        selected_tamgu2,
        subscribed_platforms,
        daily_study_hours,
        onboarding_completed,
        onboarding_completed_at,
        referral_source,
        referral_source_detail,
        created_at
      `, { count: 'exact' });

    // 온보딩 완료 필터 적용
    if (onboardingFilter === 'true') {
      queryBuilder = queryBuilder.eq('onboarding_completed', true);
    } else if (onboardingFilter === 'false') {
      queryBuilder = queryBuilder.or('onboarding_completed.eq.false,onboarding_completed.is.null');
    }

    // 페이지네이션 및 정렬
    const { data: profiles, error, count } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[AdminUsers] Get learning profiles error:', error);
      return c.json({ success: false, error: '학습 프로필 조회 실패' }, 500);
    }

    // 현재 페이지의 사용자 ID만 추출
    const userIds = profiles?.map(p => p.id) || [];

    if (userIds.length === 0) {
      return c.json({
        success: true,
        data: {
          profiles: [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      });
    }

    // 현재 페이지 사용자들의 auth 정보와 멤버십 정보를 병렬로 조회
    const userInfo: Record<string, { email: string; name: string }> = {};
    const membershipInfo: Record<string, { type: MembershipType; status: MembershipStatus }> = {};

    // 병렬 처리: auth 정보와 멤버십 정보 동시 조회
    const [, membershipResult] = await Promise.all([
      // auth 정보 조회
      Promise.all(userIds.map(async (userId) => {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (userData?.user) {
            const email = userData.user.email || '';
            const name = userData.user.user_metadata?.name || email.split('@')[0] || '이름 없음';
            userInfo[userId] = { email, name };
          }
        } catch (e) {
          // 개별 사용자 조회 실패는 무시
        }
      })),
      // 멤버십 정보 조회 (현재 페이지 사용자들만)
      supabase
        .from('user_memberships')
        .select('user_id, membership_type, status')
        .in('user_id', userIds),
    ]);

    // 멤버십 정보 매핑
    if (membershipResult.data) {
      for (const m of membershipResult.data) {
        membershipInfo[m.user_id] = {
          type: m.membership_type,
          status: m.status,
        };
      }
    }

    // 데이터 병합
    const result = profiles?.map(p => {
      const info = userInfo[p.id];
      const membership = membershipInfo[p.id];
      return {
        id: p.id,
        name: info?.name || '이름 없음',
        email: info?.email || '',
        createdAt: p.created_at,
        profile: {
          age: p.age,
          examYear: p.exam_year || 0,
          targetUniversity: p.target_university,
          targetGrades: p.target_grades,
          currentGrades: p.current_grades,
          selectedTamgu1: p.selected_tamgu1,
          selectedTamgu2: p.selected_tamgu2,
          subscribedPlatforms: p.subscribed_platforms,
          dailyStudyHours: p.daily_study_hours,
          onboardingCompleted: p.onboarding_completed || false,
          onboardingCompletedAt: p.onboarding_completed_at,
          referralSource: p.referral_source,
          referralSourceDetail: p.referral_source_detail,
        },
        membership: membership || null,
      };
    }) || [];

    return c.json({
      success: true,
      data: {
        profiles: result,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[AdminUsers] Get learning profiles error:', error);
    return c.json({ success: false, error: error.message || '학습 프로필 조회 실패' }, 500);
  }
});

/**
 * 대기 중인 사용자 수 조회 (관리자용)
 * GET /api/admin/users/pending/count
 */
adminUsersRoutes.get('/users/pending/count', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const { count, error } = await supabase
      .from('user_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      console.error('[AdminUsers] Get pending count error:', error);
      return c.json({ success: false, error: '조회 실패' }, 500);
    }

    return c.json({ success: true, data: { count: count || 0 } });
  } catch (error: any) {
    console.error('[AdminUsers] Get pending count error:', error);
    return c.json({ success: false, error: error.message || '조회 실패' }, 500);
  }
});
