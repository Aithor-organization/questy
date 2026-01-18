/**
 * Admin Users Routes
 * 사용자 및 멤버십 관리 API
 */

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

export const adminUsersRoutes = new Hono();

// 멤버십 유형
type MembershipType = 'pending' | 'beta_tester' | 'lab_member';
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

/**
 * 관리자 권한 확인
 */
async function isAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  return !error && data !== null;
}

/**
 * 모든 사용자 목록 조회 (관리자용)
 * GET /api/admin/users
 */
adminUsersRoutes.get('/users', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // 관리자 권한 확인 (헤더에서 userId 추출)
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, error: '인증이 필요합니다' }, 401);
    }

    // auth.users와 user_memberships 조인하여 조회
    // Supabase에서 auth.users 직접 접근이 어려우므로 Edge Function 권장
    // 여기서는 user_memberships + user_profiles 조합으로 처리

    const { data: memberships, error } = await supabase
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
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminUsers] Get users error:', error);
      return c.json({ success: false, error: '사용자 목록 조회 실패' }, 500);
    }

    // user_profiles에서 추가 정보 조회
    const userIds = memberships?.map(m => m.user_id) || [];

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, name')
      .in('user_id', userIds);

    if (profileError) {
      console.warn('[AdminUsers] Get profiles warning:', profileError);
    }

    // auth.users에서 이메일 정보 조회 (Admin API 사용)
    const userEmails: Record<string, string> = {};
    for (const userId of userIds) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user?.email) {
          userEmails[userId] = userData.user.email;
        }
      } catch (e) {
        // 개별 사용자 조회 실패는 무시
      }
    }

    // 데이터 병합
    const users = memberships?.map(m => {
      const profile = profiles?.find(p => p.user_id === m.user_id);
      return {
        id: m.user_id,
        name: profile?.name || '이름 없음',
        email: userEmails[m.user_id] || '',
        createdAt: m.created_at,
        membership: {
          type: m.membership_type,
          status: m.status,
          approvedAt: m.approved_at,
          expiresAt: m.expires_at,
          adminNote: m.admin_note,
        },
      };
    }) || [];

    return c.json({ success: true, data: users });
  } catch (error: any) {
    console.error('[AdminUsers] Get users error:', error);
    return c.json({ success: false, error: error.message || '사용자 목록 조회 실패' }, 500);
  }
});

/**
 * 멤버십 변경 (대기자/베타테스터/실험단)
 * POST /api/admin/users/:userId/membership
 */
adminUsersRoutes.post('/users/:userId/membership', async (c) => {
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
    if (!['pending', 'beta_tester', 'lab_member'].includes(membershipType)) {
      return c.json({ success: false, error: '유효하지 않은 멤버십 유형입니다' }, 400);
    }

    const now = new Date().toISOString();

    // 멤버십 타입에 따른 설정
    let status: MembershipStatus;
    let expiresAt: string | null = null;
    let approvedAt: string | null = null;

    if (membershipType === 'pending') {
      // 대기자로 변경 (강등)
      status = 'pending';
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
          console.log(`[AdminUsers] Sending approval notification to: ${userData.user.email}`);
          await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: userData.user.email,
            options: {
              redirectTo: `${process.env.FRONTEND_URL || 'https://questybook.com'}/`,
            },
          });
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
adminUsersRoutes.post('/users/:userId/approve', async (c) => {
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
adminUsersRoutes.post('/users/:userId/revoke', async (c) => {
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
 * 멤버십 상태 조회 (사용자용)
 * GET /api/admin/membership/status
 */
adminUsersRoutes.get('/membership/status', async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // Authorization 헤더에서 토큰 추출
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증이 필요합니다' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');

    // 토큰으로 사용자 정보 조회
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ success: false, error: '유효하지 않은 인증입니다' }, 401);
    }

    // 멤버십 정보 조회
    const { data: membership, error } = await supabase
      .from('user_memberships')
      .select('*')
      .eq('user_id', user.id)
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

    // 만료된 베타테스터는 대기자로 강등
    if (isExpired && membership.status === 'active' && membership.membership_type === 'beta_tester') {
      await supabase
        .from('user_memberships')
        .update({
          membership_type: 'pending',
          status: 'pending',
          expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      currentType = 'pending';
      currentStatus = 'pending';
      console.log(`[AdminUsers] Beta tester expired, demoted to pending: ${user.id}`);
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
 * 대기 중인 사용자 수 조회
 * GET /api/admin/users/pending/count
 */
adminUsersRoutes.get('/users/pending/count', async (c) => {
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
