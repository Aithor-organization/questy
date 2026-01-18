/**
 * Users View - 사용자 및 멤버십 관리
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { UserMembership, MembershipType, MembershipStatus } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [approving, setApproving] = useState<string | null>(null);

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '사용자 목록 조회 실패');
      }

      setUsers(data.data || []);
    } catch (err: any) {
      setError(err.message || '사용자 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 멤버십 변경 (대기자/베타테스터/실험단)
  const approveUser = async (userId: string, membershipType: MembershipType) => {
    setApproving(userId);

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/membership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
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

  // 필터링된 사용자 목록
  const filteredUsers = users.filter(user => {
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!user.name?.toLowerCase().includes(query) &&
          !user.email?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // 상태 필터
    if (filter === 'pending') {
      return user.membership?.status === 'pending';
    }
    if (filter === 'active') {
      return user.membership?.status === 'active';
    }

    return true;
  });

  // 대기 중인 사용자 수
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

      {/* 필터 및 검색 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체 ({users.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            대기 ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('active')}
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
            />
          ))}
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
}: {
  user: UserMembership;
  onApprove: (userId: string, type: MembershipType) => void;
  isLoading: boolean;
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
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex flex-col gap-3">
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

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
              {membership?.approvedAt && (
                <span>승인: {new Date(membership.approvedAt).toLocaleDateString('ko-KR')}</span>
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
  );
}
