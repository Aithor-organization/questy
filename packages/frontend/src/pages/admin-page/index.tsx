/**
 * Admin Page - Main Entry Point
 * 관리자 페이지 통합 진입점
 *
 * 모듈화된 구조:
 * - types.ts: 타입 정의 및 유틸리티
 * - AdminLoginForm.tsx: 로그인 폼
 * - AdminContent.tsx: 메인 관리 콘텐츠
 * - CourseCard.tsx: 강좌 카드
 * - modals/: 모달 컴포넌트들
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AdminLoginForm } from './AdminLoginForm';
import { AdminContent } from './AdminContent';
import type { AdminInfo } from './types';

export function AdminPage() {
  // 인증 상태
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 관리자 권한 확인
  const checkAdminStatus = useCallback(async (userId: string) => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id, name, role')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.log('[Admin] User is not an admin:', userId);
        return null;
      }

      return data as AdminInfo;
    } catch (err) {
      console.error('[Admin] Error checking admin status:', err);
      return null;
    }
  }, []);

  // 초기 세션 확인 및 관리자 권한 체크
  useEffect(() => {
    const initAdminAuth = async () => {
      if (!supabase) {
        setAuthLoading(false);
        setAuthError('Supabase가 설정되지 않았습니다');
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Admin] Session error:', sessionError);
          await supabase.auth.signOut();
          setAuthLoading(false);
          return;
        }

        if (session?.user) {
          const admin = await checkAdminStatus(session.user.id);

          if (admin) {
            setUser(session.user);
            setAdminInfo(admin);
          } else {
            console.log('[Admin] User is not admin, signing out');
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('[Admin] Init error:', err);
        try {
          await supabase.auth.signOut();
        } catch {}
      } finally {
        setAuthLoading(false);
      }
    };

    initAdminAuth();

    // Auth 상태 변경 리스너
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Admin] Auth event:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          const admin = await checkAdminStatus(session.user.id);
          if (admin) {
            setUser(session.user);
            setAdminInfo(admin);
          } else {
            await supabase?.auth.signOut();
          }
        } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          setUser(null);
          setAdminInfo(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    ) || { data: { subscription: null } };

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkAdminStatus]);

  // 관리자 로그인
  const adminLogin = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) {
      setAuthError('Supabase가 설정되지 않았습니다');
      return false;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = '로그인에 실패했습니다';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다';
        }
        setAuthError(errorMessage);
        setAuthLoading(false);
        return false;
      }

      if (data.user) {
        setUser(data.user);
        const admin = await checkAdminStatus(data.user.id);

        if (!admin) {
          setAuthError('관리자 권한이 없는 계정입니다');
          await supabase.auth.signOut();
          setUser(null);
          setAuthLoading(false);
          return false;
        }

        setAdminInfo(admin);
        setAuthLoading(false);
        return true;
      }

      setAuthLoading(false);
      return false;
    } catch (err) {
      console.error('[Admin] Login error:', err);
      setAuthError('서버 연결에 실패했습니다');
      setAuthLoading(false);
      return false;
    }
  };

  // 관리자 로그아웃
  const adminLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setAdminInfo(null);
  };

  const clearAuthError = () => setAuthError(null);

  // 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  // 로그인되지 않았거나 관리자가 아닌 경우
  if (!user || !adminInfo) {
    return (
      <AdminLoginForm
        login={adminLogin}
        authLoading={authLoading}
        authError={authError}
        clearAuthError={clearAuthError}
      />
    );
  }

  // 관리자 로그인 완료
  return <AdminContent logout={adminLogout} adminName={adminInfo.name} />;
}

export default AdminPage;
