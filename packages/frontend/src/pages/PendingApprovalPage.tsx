/**
 * PendingApprovalPage - 승인 대기 페이지
 * 회원가입 후 관리자 승인을 기다리는 사용자에게 표시
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Mail, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface MembershipStatus {
  type: 'pending' | 'beta_tester' | 'lab_member';
  status: 'pending' | 'active' | 'expired' | 'revoked';
  approvedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  isExpired: boolean;
}

export function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const [_membership, setMembership] = useState<MembershipStatus | null>(null);

  // 멤버십 상태 확인
  const checkMembershipStatus = async () => {
    if (!supabase) return;

    setChecking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setChecking(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/membership/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setMembership(data.data);

        // 승인됨 → 대시보드로 이동
        if (data.data.status === 'active') {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (error) {
      console.error('Failed to check membership:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkMembershipStatus();

    // 30초마다 자동 확인
    const interval = setInterval(checkMembershipStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // 로그아웃
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* 아이콘 */}
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} className="text-yellow-600" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          승인 대기 중
        </h1>

        {/* 설명 */}
        <p className="text-gray-600 mb-6">
          회원가입이 완료되었습니다!<br />
          관리자가 가입을 승인하면 서비스를 이용할 수 있습니다.
        </p>

        {/* 사용자 정보 */}
        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={16} />
              <span>{user.email}</span>
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-blue-700">
            승인이 완료되면 등록된 이메일로 안내가 발송됩니다.
            승인 후에는 자동으로 메인 화면으로 이동합니다.
          </p>
        </div>

        {/* 상태 확인 버튼 */}
        <button
          onClick={checkMembershipStatus}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 mb-3"
        >
          {checking ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              확인 중...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              승인 상태 확인
            </>
          )}
        </button>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>

        {/* 마지막 확인 시간 */}
        <p className="text-xs text-gray-400 mt-4">
          30초마다 자동으로 상태를 확인합니다
        </p>
      </div>
    </div>
  );
}

export default PendingApprovalPage;
