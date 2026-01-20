/**
 * Users View - 사용자 및 멤버십 관리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Square,
  CheckSquare,
  Trash2,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { UserMembership, MembershipType, MembershipStatus } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 액세스 토큰 가져오기
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// 멤버십 상태 라벨
const membershipStatusLabels: Record<MembershipStatus, string> = {
  pending: '대기',
  active: '활성',
  expired: '만료',
  revoked: '철회',
};

// 멤버십 상태 색상
const statusColors: Record<MembershipStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-700',
  revoked: 'bg-red-100 text-red-700',
};

export function UsersView() {
  const [users, setUsers] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  // 다중 선택 관련 상태
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  // 사용자 목록 조회 (서버사이드 페이지네이션 + 검색)
  const fetchUsers = useCallback(async () => {
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
      if (filter === 'pending') {
        params.append('status', 'pending');
      } else if (filter === 'active') {
        params.append('status', 'active');
      }
      // 서버사이드 검색
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '사용자 목록 조회 실패');
      }

      // P2 페이지네이션 응답 구조: data.data = { users: [], pagination: {} }
      const usersArray = Array.isArray(data.data) ? data.data : (data.data?.users || []);
      setUsers(usersArray);

      // 페이지네이션 정보 업데이트
      if (data.data?.pagination) {
        setTotalPages(data.data.pagination.totalPages || 1);
        setTotal(data.data.pagination.total || usersArray.length);
      } else {
        setTotalPages(1);
        setTotal(usersArray.length);
      }
    } catch (err: any) {
      setError(err.message || '사용자 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filter, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 멤버십 변경 (대기자/베타테스터/실험단)
  const approveUser = async (userId: string, membershipType: MembershipType) => {
    setApproving(userId);

    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ membershipType }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '멤버십 변경 실패');
      }

      // 목록 새로고침
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '멤버십 변경에 실패했습니다');
    } finally {
      setApproving(null);
    }
  };

  // 사용자 선택 토글
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // 선택 초기화
  const clearSelection = () => {
    setSelectedUsers(new Set());
    setShowDeleteConfirm(false);
  };

  // 일괄 멤버십 변경
  const bulkUpdateMembership = async (membershipType: MembershipType) => {
    if (selectedUsers.size === 0) return;

    setBulkActionLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/api/admin/users/bulk/membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          membershipType,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        // 상세 에러 정보 포함
        const errorMsg = data.details
          ? `${data.error} (코드: ${data.details})`
          : data.error || '일괄 멤버십 변경 실패';
        throw new Error(errorMsg);
      }

      clearSelection();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '일괄 멤버십 변경에 실패했습니다');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 일괄 사용자 삭제
  const bulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;

    setBulkActionLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/api/admin/users/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '일괄 사용자 삭제 실패');
      }

      clearSelection();
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '일괄 사용자 삭제에 실패했습니다');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 필터 또는 검색 변경 시 첫 페이지로 리셋
  const handleFilterChange = (newFilter: 'all' | 'pending' | 'active') => {
    setFilter(newFilter);
    setPage(1);
    setSelectedUsers(new Set());
  };

  // 서버사이드 필터링이므로 클라이언트 필터 제거
  // users 배열을 그대로 사용
  const filteredUsers = users;

  // 대기 중인 사용자 수 (전체 기준으로 표시하려면 별도 API 필요, 현재는 로드된 데이터 기준)
  const pendingCount = users.filter(u => u.membership?.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <UserCheck size={20} className="text-blue-500" />
          사용자 관리
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-sm">
              {pendingCount}명 대기 중
            </span>
          )}
        </h2>
        <button
          onClick={fetchUsers}
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

      {/* 일괄 작업 툴바 */}
      {selectedUsers.size > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                {selectedUsers.size}명 선택됨
              </span>
              <button
                onClick={clearSelection}
                className="p-1 hover:bg-blue-100 rounded"
              >
                <X size={14} className="text-blue-600" />
              </button>
            </div>

            {!showDeleteConfirm ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-blue-600">멤버십 변경:</span>
                <button
                  onClick={() => bulkUpdateMembership('pending')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 disabled:opacity-50"
                >
                  대기자
                </button>
                <button
                  onClick={() => bulkUpdateMembership('regular')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 disabled:opacity-50"
                >
                  일반인
                </button>
                <button
                  onClick={() => bulkUpdateMembership('beta_tester')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  베타테스터
                </button>
                <button
                  onClick={() => bulkUpdateMembership('lab_member')}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium hover:bg-purple-600 disabled:opacity-50"
                >
                  실험단
                </button>
                <div className="w-px h-6 bg-blue-200 mx-1" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkActionLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  삭제
                </button>
                {bulkActionLoading && (
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-medium">
                  정말 {selectedUsers.size}명의 사용자를 삭제하시겠습니까?
                </span>
                <button
                  onClick={bulkDeleteUsers}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkActionLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    '확인'
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 필터 및 검색 */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* 전체 선택 체크박스 */}
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          {selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? (
            <CheckSquare size={16} className="text-blue-600" />
          ) : (
            <Square size={16} />
          )}
          전체
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <div className="flex gap-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체 ({total})
          </button>
          <button
            onClick={() => handleFilterChange('pending')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            대기
          </button>
          <button
            onClick={() => handleFilterChange('active')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            활성
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="이름 또는 이메일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 사용자 목록 */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <UserX size={48} className="mx-auto mb-4 opacity-30" />
          <p>표시할 사용자가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onApprove={approveUser}
              isLoading={approving === user.id}
              isSelected={selectedUsers.has(user.id)}
              onToggleSelect={() => toggleUserSelection(user.id)}
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

// 사용자 카드 컴포넌트
function UserCard({
  user,
  onApprove,
  isLoading,
  isSelected,
  onToggleSelect,
}: {
  user: UserMembership;
  onApprove: (userId: string, type: MembershipType) => void;
  isLoading: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const membership = user.membership;
  const status = membership?.status || 'pending';
  const currentType = membership?.type || 'pending';

  // 선택된 멤버십 타입 (현재 상태로 초기화)
  const [selectedType, setSelectedType] = useState<MembershipType>(currentType);
  // 변경 여부 확인
  const hasChanges = selectedType !== currentType;

  // 남은 일수 계산
  const getRemainingDays = () => {
    if (!membership?.expiresAt) return null;
    const expiresAt = new Date(membership.expiresAt);
    const now = new Date();
    if (now > expiresAt) return 0;
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const remainingDays = getRemainingDays();

  // 멤버십 타입 버튼 스타일
  const getMembershipButtonStyle = (type: MembershipType) => {
    const isSelected = selectedType === type;
    const baseStyle = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-2';

    if (type === 'pending') {
      return `${baseStyle} ${isSelected
        ? 'bg-yellow-500 text-white border-yellow-500'
        : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400'}`;
    }
    if (type === 'regular') {
      return `${baseStyle} ${isSelected
        ? 'bg-gray-500 text-white border-gray-500'
        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`;
    }
    if (type === 'beta_tester') {
      return `${baseStyle} ${isSelected
        ? 'bg-blue-500 text-white border-blue-500'
        : 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400'}`;
    }
    if (type === 'lab_member') {
      return `${baseStyle} ${isSelected
        ? 'bg-purple-500 text-white border-purple-500'
        : 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400'}`;
    }
    return baseStyle;
  };

  return (
    <div className={`p-4 bg-white border rounded-xl shadow-sm transition-all ${
      isSelected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'
    }`}>
      <div className="flex gap-3">
        {/* 체크박스 */}
        <button
          onClick={onToggleSelect}
          className="flex-shrink-0 mt-0.5"
        >
          {isSelected ? (
            <CheckSquare size={20} className="text-blue-600" />
          ) : (
            <Square size={20} className="text-gray-400 hover:text-gray-600" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-3">
          {/* 사용자 정보 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-800 truncate">{user.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
                {membershipStatusLabels[status]}
              </span>
            </div>

            {user.email && (
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span>가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
              {membership?.approvedAt && (
                <span>승인: {new Date(membership.approvedAt).toLocaleDateString('ko-KR')}</span>
              )}
              {user.lastLoginAt && (
                <span className="text-blue-500">
                  <Clock size={12} className="inline mr-1" />
                  최근 로그인: {new Date(user.lastLoginAt).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
              {!user.lastLoginAt && (
                <span className="text-gray-300">로그인 기록 없음</span>
              )}
              {remainingDays !== null && currentType === 'beta_tester' && (
                <span className={remainingDays <= 2 ? 'text-red-500' : ''}>
                  <Clock size={12} className="inline mr-1" />
                  {remainingDays > 0 ? `${remainingDays}일 남음` : '만료됨'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 멤버십 선택 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">멤버십:</span>
          <button
            onClick={() => setSelectedType('pending')}
            className={getMembershipButtonStyle('pending')}
            disabled={isLoading}
          >
            대기자
          </button>
          <button
            onClick={() => setSelectedType('regular')}
            className={getMembershipButtonStyle('regular')}
            disabled={isLoading}
          >
            일반인
          </button>
          <button
            onClick={() => setSelectedType('beta_tester')}
            className={getMembershipButtonStyle('beta_tester')}
            disabled={isLoading}
          >
            베타테스터 (7일)
          </button>
          <button
            onClick={() => setSelectedType('lab_member')}
            className={getMembershipButtonStyle('lab_member')}
            disabled={isLoading}
          >
            실험단
          </button>

          {/* 적용 버튼 */}
          {hasChanges && (
            <button
              onClick={() => onApprove(user.id, selectedType)}
              disabled={isLoading}
              className="ml-auto flex items-center gap-1 px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle size={14} />
              )}
              적용
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
