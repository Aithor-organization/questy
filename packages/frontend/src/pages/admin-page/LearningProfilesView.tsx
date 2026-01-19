/**
 * Learning Profiles View - 사용자 학습 프로필 조회
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  BookOpen,
  Search,
  RefreshCw,
  GraduationCap,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { UserLearningProfile, MembershipType } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 액세스 토큰 가져오기
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// 수험 년도 라벨
const examYearLabels: Record<number, string> = {
  0: '현역',
  1: '재수',
  2: '삼수',
  3: '그 이상',
};

// 멤버십 타입 라벨
const membershipTypeLabels: Record<MembershipType, string> = {
  pending: '대기',
  regular: '일반',
  beta_tester: '베타',
  lab_member: '실험단',
};

// 멤버십 색상
const membershipColors: Record<MembershipType, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  regular: 'bg-gray-100 text-gray-700',
  beta_tester: 'bg-blue-100 text-blue-700',
  lab_member: 'bg-purple-100 text-purple-700',
};

export function LearningProfilesView() {
  const [profiles, setProfiles] = useState<UserLearningProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  // 페이지네이션 상태
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 검색어 디바운싱 (300ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // 검색 시 첫 페이지로
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // 학습 프로필 목록 조회 (서버사이드 페이지네이션 + 검색)
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      // 서버사이드 페이지네이션 및 검색 파라미터
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      // 상태 필터
      if (filter === 'completed') {
        params.append('onboarding', 'completed');
      } else if (filter === 'incomplete') {
        params.append('onboarding', 'incomplete');
      }
      // 서버사이드 검색
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(`${API_URL}/api/admin/users/learning-profiles?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '학습 프로필 조회 실패');
      }

      // P2 페이지네이션 응답 구조: data.data = { profiles: [], pagination: {} }
      const profilesArray = Array.isArray(data.data) ? data.data : (data.data?.profiles || []);
      setProfiles(profilesArray);

      // 페이지네이션 정보 업데이트
      if (data.data?.pagination) {
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotal(data.data.pagination.total || profilesArray.length);
      } else {
        setTotalPages(1);
        setTotal(profilesArray.length);
      }
    } catch (err: any) {
      setError(err.message || '학습 프로필을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filter, debouncedSearch]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // 필터 또는 검색 변경 시 첫 페이지로 리셋
  const handleFilterChange = (newFilter: 'all' | 'completed' | 'incomplete') => {
    setFilter(newFilter);
    setPage(1);
  };

  // 서버사이드 필터링이므로 클라이언트 필터 제거
  // profiles 배열을 그대로 사용
  const filteredProfiles = profiles;

  // 온보딩 완료 사용자 수 (현재 로드된 데이터 기준)
  const completedCount = profiles.filter(u => u.profile?.onboardingCompleted).length;

  // 확장 토글
  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <GraduationCap size={20} className="text-teal-500" />
          학습 프로필
          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-sm">
            {completedCount}명 설정 완료
          </span>
        </h2>
        <button
          onClick={fetchProfiles}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 필터 및 검색 */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체 ({total})
          </button>
          <button
            onClick={() => handleFilterChange('completed')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            설정 완료
          </button>
          <button
            onClick={() => handleFilterChange('incomplete')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'incomplete'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            미설정
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 이메일, 목표 대학 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 프로필 목록 */}
      {filteredProfiles.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <User size={48} className="mx-auto mb-4 opacity-30" />
          <p>표시할 학습 프로필이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((user) => (
            <ProfileCard
              key={user.id}
              user={user}
              isExpanded={expandedUsers.has(user.id)}
              onToggle={() => toggleExpand(user.id)}
            />
          ))}
        </div>
      )}

      {/* 페이지네이션 UI */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-200 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            이전
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{page}</span>
              {' / '}
              {totalPages} 페이지
            </span>
            <span className="text-xs text-gray-400">
              (총 {total}명)
            </span>
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            다음
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 단일 페이지일 때도 전체 수 표시 */}
      {totalPages === 1 && total > 0 && (
        <div className="text-center py-2 text-xs text-gray-400">
          총 {total}명
        </div>
      )}
    </div>
  );
}

// 프로필 카드 컴포넌트
function ProfileCard({
  user,
  isExpanded,
  onToggle,
}: {
  user: UserLearningProfile;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const profile = user.profile;
  const hasProfile = profile?.onboardingCompleted;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* 요약 헤더 */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-800">{user.name}</h3>
            {user.membership && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${membershipColors[user.membership.type]}`}>
                {membershipTypeLabels[user.membership.type]}
              </span>
            )}
            {hasProfile ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                프로필 완료
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                미설정
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{user.email}</p>

          {/* 요약 정보 */}
          {hasProfile && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {profile.targetUniversity && (
                <span className="flex items-center gap-1">
                  <Target size={12} />
                  {profile.targetUniversity}
                </span>
              )}
              <span className="flex items-center gap-1">
                <GraduationCap size={12} />
                {examYearLabels[profile.examYear] || '현역'}
              </span>
              {profile.dailyStudyHours && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {profile.dailyStudyHours}시간/일
                </span>
              )}
            </div>
          )}
        </div>

        {isExpanded ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </button>

      {/* 상세 정보 */}
      {isExpanded && hasProfile && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
            {/* 기본 정보 */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 flex items-center gap-1">
                <User size={14} />
                기본 정보
              </h4>
              <div className="space-y-1 text-gray-600">
                {profile.age && <p>나이: {profile.age}세</p>}
                <p>수험 상태: {examYearLabels[profile.examYear] || '현역'}</p>
                {profile.targetUniversity && (
                  <p>목표 대학: {profile.targetUniversity}</p>
                )}
                {profile.dailyStudyHours && (
                  <p>일일 학습: {profile.dailyStudyHours}시간</p>
                )}
              </div>
            </div>

            {/* 탐구과목 */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 flex items-center gap-1">
                <BookOpen size={14} />
                탐구과목
              </h4>
              <div className="space-y-1 text-gray-600">
                {profile.selectedTamgu1 && (
                  <p>탐구1: {profile.selectedTamgu1}</p>
                )}
                {profile.selectedTamgu2 && (
                  <p>탐구2: {profile.selectedTamgu2}</p>
                )}
                {!profile.selectedTamgu1 && !profile.selectedTamgu2 && (
                  <p className="text-gray-400">미설정</p>
                )}
              </div>
            </div>

            {/* 목표 등급 */}
            {profile.targetGrades && Object.keys(profile.targetGrades).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 flex items-center gap-1">
                  <Target size={14} />
                  목표 등급
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(profile.targetGrades).map(([subject, grade]) => (
                    <span
                      key={subject}
                      className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs"
                    >
                      {subject}: {grade}등급
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 현재 등급 */}
            {profile.currentGrades && Object.keys(profile.currentGrades).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">현재 등급</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(profile.currentGrades).map(([subject, grade]) => (
                    <span
                      key={subject}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {subject}: {grade}등급
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 구독 플랫폼 */}
            {profile.subscribedPlatforms && profile.subscribedPlatforms.length > 0 && (
              <div className="col-span-2 space-y-2">
                <h4 className="font-medium text-gray-700">구독 플랫폼</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.subscribedPlatforms.map((platform) => (
                    <span
                      key={platform}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 메타 정보 */}
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-4">
            <span>가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
            {profile.onboardingCompletedAt && (
              <span>
                프로필 설정: {new Date(profile.onboardingCompletedAt).toLocaleDateString('ko-KR')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 미설정 상태 */}
      {isExpanded && !hasProfile && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-4 text-center py-6 text-gray-400">
            <User size={32} className="mx-auto mb-2 opacity-50" />
            <p>아직 학습 프로필을 설정하지 않았습니다</p>
          </div>
        </div>
      )}
    </div>
  );
}
