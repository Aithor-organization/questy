/**
 * MembershipCard - 멤버십 정보 카드
 * 사용자의 멤버십 상태와 남은 기간 표시
 * authStore에 캐시된 데이터를 먼저 사용하고 백그라운드에서 갱신
 */

import { useState, useEffect } from 'react';
import { Shield, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore, type MembershipType } from '../../../stores/authStore';

// 멤버십 타입 라벨
const membershipTypeLabels: Record<MembershipType, string> = {
  pending: '승인 대기',
  beta_tester: '베타테스터',
  lab_member: '실험단',
};

// 멤버십 타입 설명
const membershipDescriptions: Record<MembershipType, string> = {
  pending: '관리자의 승인을 기다리고 있습니다',
  beta_tester: '7일간 서비스를 무료로 체험할 수 있습니다',
  lab_member: '무기한으로 서비스를 이용할 수 있습니다',
};

export function MembershipCard() {
  // authStore에서 캐시된 멤버십 데이터 사용
  const cachedMembership = useAuthStore((state) => state.membershipData);
  const loadMembership = useAuthStore((state) => state.loadMembership);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 마운트 시 백그라운드에서 최신 데이터 갱신
  useEffect(() => {
    const refreshMembership = async () => {
      setIsRefreshing(true);
      await loadMembership();
      setIsRefreshing(false);
    };

    // 캐시된 데이터가 없거나, 있어도 백그라운드에서 갱신
    refreshMembership();
  }, [loadMembership]);

  // 캐시된 데이터가 없고 갱신 중이면 로딩 표시
  if (!cachedMembership && isRefreshing) {
    return (
      <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--pencil-gray)]" />
        </div>
      </div>
    );
  }

  // 멤버십 데이터가 없으면 카드 숨김
  if (!cachedMembership) {
    return null;
  }

  const membership = cachedMembership;

  const { type, status, remainingDays, isExpired } = membership;

  // 상태에 따른 아이콘 및 색상
  const getStatusDisplay = () => {
    if (status === 'pending') {
      return {
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        label: '승인 대기 중',
      };
    }
    if (isExpired || status === 'expired') {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        label: '멤버십 만료',
      };
    }
    if (status === 'revoked') {
      return {
        icon: AlertCircle,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        label: '멤버십 철회됨',
      };
    }
    return {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      label: '활성',
    };
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
      <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5" /> 멤버십 정보
      </h2>

      {/* 멤버십 상태 카드 */}
      <div className={`rounded-lg p-4 ${statusDisplay.bgColor} border ${statusDisplay.borderColor}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon className={`w-5 h-5 ${statusDisplay.color}`} />
              <span className={`font-medium ${statusDisplay.color}`}>
                {membershipTypeLabels[type]}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {membershipDescriptions[type]}
            </p>
          </div>

          {/* 남은 기간 표시 (베타테스터인 경우) */}
          {type === 'beta_tester' && status === 'active' && remainingDays !== null && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${remainingDays <= 2 ? 'text-red-600' : 'text-blue-600'}`}>
                {remainingDays}
              </div>
              <div className="text-xs text-gray-500">일 남음</div>
            </div>
          )}
        </div>

        {/* 만료 경고 */}
        {type === 'beta_tester' && remainingDays !== null && remainingDays <= 2 && remainingDays > 0 && (
          <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            체험 기간이 곧 종료됩니다
          </div>
        )}

        {/* 만료됨 메시지 */}
        {isExpired && (
          <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            멤버십이 만료되었습니다. 관리자에게 문의해주세요.
          </div>
        )}
      </div>
    </div>
  );
}
