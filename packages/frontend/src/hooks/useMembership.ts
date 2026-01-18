/**
 * useMembership - 멤버십 상태 관리 훅
 * 사용자의 멤버십 상태를 확인하고 관리
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type MembershipType = 'pending' | 'beta_tester' | 'lab_member';
export type MembershipStatus = 'pending' | 'active' | 'expired' | 'revoked';

export interface MembershipData {
  type: MembershipType;
  status: MembershipStatus;
  approvedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  isExpired: boolean;
}

interface UseMembershipReturn {
  membership: MembershipData | null;
  isLoading: boolean;
  error: string | null;
  isApproved: boolean;
  isPending: boolean;
  isExpired: boolean;
  checkMembership: () => Promise<MembershipData | null>;
}

export function useMembership(): UseMembershipReturn {
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkMembership = useCallback(async (): Promise<MembershipData | null> => {
    if (!supabase) {
      setIsLoading(false);
      return null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setIsLoading(false);
        return null;
      }

      const response = await fetch(`${API_URL}/api/admin/membership/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMembership(data.data);
        setError(null);
        return data.data;
      } else {
        setError(data.error || '멤버십 정보를 불러올 수 없습니다');
        return null;
      }
    } catch (err: any) {
      setError(err.message || '멤버십 정보를 불러오는데 실패했습니다');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkMembership();
  }, [checkMembership]);

  // 승인된 상태인지 확인 (active 상태)
  const isApproved = membership?.status === 'active' && !membership.isExpired;

  // 대기 중인지 확인
  const isPending = membership?.status === 'pending';

  // 만료되었는지 확인
  const isExpired = membership?.isExpired || membership?.status === 'expired';

  return {
    membership,
    isLoading,
    error,
    isApproved,
    isPending,
    isExpired,
    checkMembership,
  };
}
