/**
 * Stats View - 예비창업패키지용 통계 대시보드
 * 핵심 지표: 총 가입자, DAU/WAU/MAU, 멤버십 현황, 리텐션, 성장률
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  UserCheck,
  Clock,
  Download,
  BarChart3,
  PieChart,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 통계 데이터 타입
interface StatsData {
  overview: {
    totalUsers: number;
    dau: number;
    wau: number;
    mau: number;
    activeRate: number;
    d7RetentionRate: number;
  };
  membership: {
    pending: number;
    regular: number;
    beta_tester: number;
    lab_member: number;
    active: number;
    expired: number;
    revoked: number;
  };
  signupTrend: { date: string; count: number }[];
  generatedAt: string;
}

interface GrowthData {
  thisWeekSignups: number;
  lastWeekSignups: number;
  weeklyGrowthRate: number;
}

interface ReferralData {
  referralSources: { source: string; count: number }[];
  total: number;
}

interface UserPlan {
  id: string;
  name: string;
  materialName: string | null;
  subject: string | null;
  totalDays: number;
  status: string;
  createdAt: string;
}

interface UserWithPlans {
  userId: string;
  userName: string;
  userEmail: string;
  plans: UserPlan[];
  planCount: number;
}

interface PlansData {
  users: UserWithPlans[];
  summary: {
    totalPlans: number;
    usersWithPlans: number;
    avgPlansPerUser: number;
  };
}

// 액세스 토큰 가져오기
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// 숫자 포맷팅
function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

// 퍼센트 포맷팅
function formatPercent(num: number): string {
  return `${num >= 0 ? '+' : ''}${num}%`;
}

export function StatsView() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [plans, setPlans] = useState<PlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // 사용자 펼침/접힘 토글
  const toggleUserExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // 통계 데이터 조회
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('인증이 필요합니다');
        return;
      }

      // 병렬로 모든 통계 조회
      const [statsRes, growthRes, referralRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/stats/growth`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/stats/referral`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/stats/plans?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!statsRes.ok || !growthRes.ok || !referralRes.ok) {
        throw new Error('통계 조회 실패');
      }

      const [statsData, growthData, referralData, plansData] = await Promise.all([
        statsRes.json(),
        growthRes.json(),
        referralRes.json(),
        plansRes.json(),
      ]);

      if (statsData.success) setStats(statsData.data);
      if (growthData.success) setGrowth(growthData.data);
      if (referralData.success) setReferral(referralData.data);
      if (plansData.success) setPlans(plansData.data);
    } catch (err: any) {
      console.error('[StatsView] Fetch error:', err);
      setError(err.message || '통계 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // CSV 다운로드
  const downloadCSV = useCallback(() => {
    if (!stats) return;

    const rows = [
      ['지표', '값'],
      ['총 가입자 수', stats.overview.totalUsers.toString()],
      ['DAU (일간 활성)', stats.overview.dau.toString()],
      ['WAU (주간 활성)', stats.overview.wau.toString()],
      ['MAU (월간 활성)', stats.overview.mau.toString()],
      ['활성 사용자 비율', `${stats.overview.activeRate}%`],
      ['D7 리텐션', `${stats.overview.d7RetentionRate}%`],
      [''],
      ['멤버십 현황', ''],
      ['대기자 (pending)', stats.membership.pending.toString()],
      ['일반인 (regular)', stats.membership.regular.toString()],
      ['베타테스터', stats.membership.beta_tester.toString()],
      ['실험단', stats.membership.lab_member.toString()],
      [''],
      ['일별 가입자 추이', ''],
      ...stats.signupTrend.map(t => [t.date, t.count.toString()]),
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `questy_stats_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">통계 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">통계 대시보드</h2>
          <p className="text-sm text-gray-500">
            예비창업패키지 제출용 핵심 지표
            {stats && ` (${new Date(stats.generatedAt).toLocaleString('ko-KR')} 기준)`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Download className="w-4 h-4" />
            CSV 다운로드
          </button>
          <button
            onClick={fetchStats}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 총 가입자 */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Users className="w-4 h-4" />
                총 가입자
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatNumber(stats.overview.totalUsers)}
              </div>
            </div>

            {/* DAU */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Activity className="w-4 h-4" />
                DAU (오늘)
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatNumber(stats.overview.dau)}
              </div>
            </div>

            {/* WAU */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Activity className="w-4 h-4" />
                WAU (7일)
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatNumber(stats.overview.wau)}
              </div>
            </div>

            {/* MAU */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Activity className="w-4 h-4" />
                MAU (30일)
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {formatNumber(stats.overview.mau)}
              </div>
            </div>

            {/* 활성 사용자 비율 */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <UserCheck className="w-4 h-4" />
                활성 비율
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.overview.activeRate}%
              </div>
            </div>

            {/* D7 리텐션 */}
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-pink-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                D7 리텐션
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.overview.d7RetentionRate}%
              </div>
            </div>
          </div>

          {/* 주간 성장률 */}
          {growth && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                주간 성장률
              </h3>
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-sm text-gray-500">이번 주 가입</div>
                  <div className="text-xl font-bold">{formatNumber(growth.thisWeekSignups)}명</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">지난 주 가입</div>
                  <div className="text-xl font-bold">{formatNumber(growth.lastWeekSignups)}명</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">성장률</div>
                  <div className={`text-xl font-bold flex items-center gap-1 ${
                    growth.weeklyGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {growth.weeklyGrowthRate >= 0 ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                    {formatPercent(growth.weeklyGrowthRate)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 멤버십 현황 */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              멤버십 현황
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm text-yellow-700">대기자 (pending)</div>
                <div className="text-xl font-bold text-yellow-800">
                  {formatNumber(stats.membership.pending)}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-700">일반인 (체험만료)</div>
                <div className="text-xl font-bold text-gray-800">
                  {formatNumber(stats.membership.regular)}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700">베타테스터 (7일)</div>
                <div className="text-xl font-bold text-blue-800">
                  {formatNumber(stats.membership.beta_tester)}
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-700">실험단 (무기한)</div>
                <div className="text-xl font-bold text-purple-800">
                  {formatNumber(stats.membership.lab_member)}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t flex gap-4 text-sm">
              <span className="text-green-600">
                활성: {formatNumber(stats.membership.active)}명
              </span>
              <span className="text-gray-600">
                만료: {formatNumber(stats.membership.expired)}명
              </span>
              <span className="text-red-600">
                철회: {formatNumber(stats.membership.revoked)}명
              </span>
            </div>
          </div>

          {/* 유입경로 통계 */}
          {referral && referral.referralSources.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                유입경로별 가입자
              </h3>
              <div className="space-y-2">
                {referral.referralSources.slice(0, 10).map((item) => {
                  const percent = Math.round((item.count / referral.total) * 100);
                  return (
                    <div key={item.source} className="flex items-center gap-2">
                      <div className="w-24 text-sm text-gray-600 truncate" title={item.source}>
                        {item.source}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="w-16 text-sm text-gray-700 text-right">
                        {formatNumber(item.count)}명
                      </div>
                      <div className="w-12 text-sm text-gray-500 text-right">
                        {percent}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 일별 가입자 추이 (최근 30일) */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              일별 가입자 추이 (최근 30일)
            </h3>
            {(() => {
              const maxCount = Math.max(...stats.signupTrend.map(d => d.count), 1);
              return (
                <div className="relative">
                  {/* 차트 영역 */}
                  <div className="h-40 flex items-end gap-0.5 mb-6">
                    {stats.signupTrend.map((day, idx) => {
                      const height = (day.count / maxCount) * 100;
                      const isToday = idx === stats.signupTrend.length - 1;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 flex flex-col items-center justify-end h-full"
                          title={`${day.date}: ${day.count}명`}
                        >
                          {day.count > 0 && (
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              {day.count}
                            </div>
                          )}
                          <div
                            className={`w-full rounded-t transition-all ${
                              isToday ? 'bg-blue-500' : day.count > 0 ? 'bg-blue-400' : 'bg-gray-200'
                            }`}
                            style={{ height: `${day.count > 0 ? Math.max(height, 8) : 2}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* X축 날짜 라벨 */}
                  <div className="flex gap-0.5">
                    {stats.signupTrend.map((day, idx) => (
                      <div key={day.date} className="flex-1 text-center">
                        {idx % 5 === 0 && (
                          <div className="text-xs text-gray-400">
                            {day.date.slice(5)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 사용자별 커리큘럼 생성 현황 */}
          {plans && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                사용자별 커리큘럼 생성 현황
              </h3>

              {/* 요약 */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-blue-700">총 생성 플랜</div>
                  <div className="text-xl font-bold text-blue-800">
                    {formatNumber(plans.summary.totalPlans)}개
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-green-700">플랜 생성 사용자</div>
                  <div className="text-xl font-bold text-green-800">
                    {formatNumber(plans.summary.usersWithPlans)}명
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <div className="text-sm text-purple-700">인당 평균</div>
                  <div className="text-xl font-bold text-purple-800">
                    {plans.summary.avgPlansPerUser}개
                  </div>
                </div>
              </div>

              {/* 사용자 목록 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium text-gray-700 grid grid-cols-12 gap-2">
                  <div className="col-span-4">사용자</div>
                  <div className="col-span-5">이메일</div>
                  <div className="col-span-2 text-center">플랜 수</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {plans.users.map(user => (
                    <div key={user.userId} className="border-b last:border-b-0">
                      <div
                        className="px-4 py-2 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleUserExpand(user.userId)}
                      >
                        <div className="col-span-4 text-sm font-medium truncate">
                          {user.userName}
                        </div>
                        <div className="col-span-5 text-sm text-gray-500 truncate">
                          {user.userEmail}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                            {user.planCount}개
                          </span>
                        </div>
                        <div className="col-span-1 text-center">
                          {expandedUsers.has(user.userId) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {/* 펼쳐진 플랜 목록 */}
                      {expandedUsers.has(user.userId) && (
                        <div className="bg-gray-50 px-4 py-2 border-t">
                          <div className="space-y-2">
                            {user.plans.map(plan => (
                              <div
                                key={plan.id}
                                className="flex items-center justify-between text-sm p-2 bg-white rounded border"
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-gray-800">
                                    {plan.name || plan.materialName || '제목 없음'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {plan.subject && `${plan.subject} · `}
                                    {plan.totalDays}일 과정 ·{' '}
                                    {new Date(plan.createdAt).toLocaleDateString('ko-KR')}
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    plan.status === 'active'
                                      ? 'bg-green-100 text-green-700'
                                      : plan.status === 'completed'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {plan.status === 'active' ? '진행중' : plan.status === 'completed' ? '완료' : '일시정지'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {plans.users.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-500">
                      아직 플랜을 생성한 사용자가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 예비창업패키지 제출 팁 */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              예비창업패키지 제출 시 강조 포인트
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>총 가입자 수</strong>: 베타테스터 모집 성과</li>
              <li>• <strong>MAU/활성 비율</strong>: 서비스 점착도 (높을수록 좋음)</li>
              <li>• <strong>D7 리텐션</strong>: 사용자 유지율 (업계 평균 20~30%)</li>
              <li>• <strong>주간 성장률</strong>: 바이럴/확산 가능성</li>
              <li>• <strong>유입경로</strong>: 마케팅 채널 효율성</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
