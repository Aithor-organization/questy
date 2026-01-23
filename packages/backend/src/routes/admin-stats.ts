/**
 * Admin Stats Routes
 * 예비창업패키지용 통계 대시보드 API
 */

import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { adminOnly } from '../middleware/auth.js';

export const adminStatsRoutes = new Hono();

/**
 * 전체 통계 조회
 * GET /api/admin/stats
 */
adminStatsRoutes.get('/stats', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 병렬로 모든 통계 조회
    const [
      totalUsersResult,
      dauResult,
      wauResult,
      mauResult,
      membershipResult,
      signupTrendResult,
      d7RetentionResult,
    ] = await Promise.all([
      // 1. 총 가입자 수
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true }),

      // 2. DAU (오늘 활성 사용자)
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', today.toISOString()),

      // 3. WAU (최근 7일 활성 사용자)
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', sevenDaysAgo.toISOString()),

      // 4. MAU (최근 30일 활성 사용자)
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_active_at', thirtyDaysAgo.toISOString()),

      // 5. 멤버십 현황
      supabase
        .from('user_memberships')
        .select('membership_type, status'),

      // 6. 일별 가입자 추이 (최근 30일)
      supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true }),

      // 7. D7 리텐션 계산용 데이터
      supabase
        .from('user_profiles')
        .select('created_at, last_active_at')
        .lte('created_at', sevenDaysAgo.toISOString()),
    ]);

    // 결과 처리
    const totalUsers = totalUsersResult.count || 0;
    const dau = dauResult.count || 0;
    const wau = wauResult.count || 0;
    const mau = mauResult.count || 0;

    // 멤버십 현황 집계
    const membershipStats = {
      pending: 0,
      regular: 0,
      beta_tester: 0,
      lab_member: 0,
      active: 0,
      expired: 0,
      revoked: 0,
    };

    if (membershipResult.data) {
      for (const m of membershipResult.data) {
        // 타입별 집계
        if (m.membership_type in membershipStats) {
          membershipStats[m.membership_type as keyof typeof membershipStats]++;
        }
        // 상태별 집계
        if (m.status === 'active') membershipStats.active++;
        else if (m.status === 'expired') membershipStats.expired++;
        else if (m.status === 'revoked') membershipStats.revoked++;
      }
    }

    // 일별 가입자 추이 집계
    const signupTrend: Record<string, number> = {};
    if (signupTrendResult.data) {
      for (const profile of signupTrendResult.data) {
        const date = profile.created_at.split('T')[0];
        signupTrend[date] = (signupTrend[date] || 0) + 1;
      }
    }

    // 최근 30일 날짜 배열 생성 (빈 날짜도 포함)
    const signupTrendArray: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      signupTrendArray.push({
        date: dateStr,
        count: signupTrend[dateStr] || 0,
      });
    }

    // D7 리텐션 계산 (가입 7일 후에도 활동한 비율)
    let d7RetentionRate = 0;
    if (d7RetentionResult.data && d7RetentionResult.data.length > 0) {
      const eligibleUsers = d7RetentionResult.data;
      let retained = 0;
      for (const user of eligibleUsers) {
        if (user.last_active_at) {
          const createdAt = new Date(user.created_at);
          const lastActiveAt = new Date(user.last_active_at);
          const daysSinceCreated = (lastActiveAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated >= 7) {
            retained++;
          }
        }
      }
      d7RetentionRate = eligibleUsers.length > 0
        ? Math.round((retained / eligibleUsers.length) * 100 * 10) / 10
        : 0;
    }

    // 활성 사용자 비율 (MAU / 총 가입자)
    const activeRate = totalUsers > 0
      ? Math.round((mau / totalUsers) * 100 * 10) / 10
      : 0;

    return c.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          dau,
          wau,
          mau,
          activeRate,
          d7RetentionRate,
        },
        membership: membershipStats,
        signupTrend: signupTrendArray,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[AdminStats] Get stats error:', error);
    return c.json({ success: false, error: error.message || '통계 조회 실패' }, 500);
  }
});

/**
 * 유입경로별 통계
 * GET /api/admin/stats/referral
 */
adminStatsRoutes.get('/stats/referral', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('referral_source');

    if (error) {
      console.error('[AdminStats] Get referral stats error:', error);
      return c.json({ success: false, error: '유입경로 통계 조회 실패' }, 500);
    }

    // 유입경로별 집계
    const referralStats: Record<string, number> = {};
    if (data) {
      for (const profile of data) {
        const source = profile.referral_source || '미입력';
        referralStats[source] = (referralStats[source] || 0) + 1;
      }
    }

    // 배열로 변환 및 정렬
    const referralArray = Object.entries(referralStats)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    return c.json({
      success: true,
      data: {
        referralSources: referralArray,
        total: data?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[AdminStats] Get referral stats error:', error);
    return c.json({ success: false, error: error.message || '유입경로 통계 조회 실패' }, 500);
  }
});

/**
 * 주간 성장률
 * GET /api/admin/stats/growth
 */
adminStatsRoutes.get('/stats/growth', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 이번 주와 지난 주 범위 계산
    const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeekResult, lastWeekResult] = await Promise.all([
      // 이번 주 가입자
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thisWeekStart.toISOString()),

      // 지난 주 가입자
      supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', thisWeekStart.toISOString()),
    ]);

    const thisWeekSignups = thisWeekResult.count || 0;
    const lastWeekSignups = lastWeekResult.count || 0;

    // 주간 성장률 계산
    let weeklyGrowthRate = 0;
    if (lastWeekSignups > 0) {
      weeklyGrowthRate = Math.round(((thisWeekSignups - lastWeekSignups) / lastWeekSignups) * 100 * 10) / 10;
    } else if (thisWeekSignups > 0) {
      weeklyGrowthRate = 100; // 지난 주 0명 → 이번 주 N명
    }

    return c.json({
      success: true,
      data: {
        thisWeekSignups,
        lastWeekSignups,
        weeklyGrowthRate,
        period: {
          thisWeek: { start: thisWeekStart.toISOString(), end: today.toISOString() },
          lastWeek: { start: lastWeekStart.toISOString(), end: thisWeekStart.toISOString() },
        },
      },
    });
  } catch (error: any) {
    console.error('[AdminStats] Get growth stats error:', error);
    return c.json({ success: false, error: error.message || '성장률 조회 실패' }, 500);
  }
});

/**
 * 사용자별 커리큘럼(플랜) 생성 현황
 * GET /api/admin/stats/plans
 *
 * NOTE: 플랜 데이터는 user_storage 테이블에 JSON으로 저장됨
 * - store_name: 'quest'
 * - key: 'quest-storage'
 * - value: { state: { plans: [...] }, version: 0 }
 */
adminStatsRoutes.get('/stats/plans', adminOnly, async (c) => {
  try {
    if (!supabase) {
      return c.json({ success: false, error: 'Supabase not available' }, 500);
    }

    // 1. user_storage에서 quest 스토어 데이터 조회
    // store_name: 'quest', key: 'questybook-storage' (Zustand persist name)
    const { data: storageData, error: storageError } = await supabase
      .from('user_storage')
      .select('user_id, value, updated_at')
      .eq('store_name', 'quest')
      .eq('key', 'questybook-storage');

    if (storageError) {
      console.error('[AdminStats] Get user_storage error:', storageError);
      return c.json({ success: false, error: `스토리지 조회 실패: ${storageError.message}` }, 500);
    }

    console.log('[AdminStats] Storage entries found:', storageData?.length || 0);

    if (!storageData || storageData.length === 0) {
      return c.json({
        success: true,
        data: {
          users: [],
          summary: { totalPlans: 0, usersWithPlans: 0, avgPlansPerUser: 0 },
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        },
      });
    }

    // 2. user_id 목록으로 user_profiles 조회
    const userIds = storageData.map(s => s.user_id).filter(Boolean);
    const userInfo: Record<string, { email: string; name: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      if (profiles) {
        for (const p of profiles) {
          userInfo[p.id] = {
            name: p.display_name || '이름 없음',
            email: p.email || '',
          };
        }
      }
    }

    // 3. 각 사용자의 플랜 데이터 파싱
    const result: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      plans: any[];
      planCount: number;
    }> = [];

    let totalPlans = 0;

    for (const storage of storageData) {
      try {
        // JSON 파싱: { state: { plans: [...] }, version: 0 }
        const parsed = JSON.parse(storage.value);
        const plans = parsed?.state?.plans || [];

        if (plans.length > 0) {
          const userPlans = plans.map((plan: any) => ({
            id: plan.id,
            name: plan.materialName || '제목 없음',
            materialName: plan.materialName,
            subject: plan.summary?.subject || null,
            totalDays: plan.summary?.totalDays || plan.dailyQuests?.length || 0,
            status: 'active',
            createdAt: plan.createdAt,
            questCount: plan.dailyQuests?.length || 0,
          }));

          result.push({
            userId: storage.user_id,
            userName: userInfo[storage.user_id]?.name || '이름 없음',
            userEmail: userInfo[storage.user_id]?.email || '',
            plans: userPlans,
            planCount: userPlans.length,
          });

          totalPlans += userPlans.length;
        }
      } catch (parseError) {
        console.warn('[AdminStats] JSON parse error for user:', storage.user_id, parseError);
      }
    }

    // 4. 플랜 수 기준 정렬
    result.sort((a, b) => b.planCount - a.planCount);

    const usersWithPlans = result.length;

    return c.json({
      success: true,
      data: {
        users: result,
        summary: {
          totalPlans,
          usersWithPlans,
          avgPlansPerUser: usersWithPlans > 0 ? Math.round((totalPlans / usersWithPlans) * 10) / 10 : 0,
        },
        pagination: {
          page: 1,
          limit: 100,
          total: totalPlans,
          totalPages: 1,
        },
      },
    });
  } catch (error: any) {
    console.error('[AdminStats] Get plans error:', error);
    return c.json({ success: false, error: error.message || '플랜 조회 실패' }, 500);
  }
});
