/**
 * Admin Page - Main Entry Point
 * 관리자 페이지 통합 진입점
 *
 * 중요: Admin 페이지는 독립적인 인증 시스템 사용
 * - 기존 세션 무시, 항상 로그인 폼 표시
 * - 캐시/persist 없음
 * - 직접 로그인만 허용
 */

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AdminLoginForm } from './AdminLoginForm';
import { AdminContent } from './AdminContent';
import type { AdminInfo } from './types';

export function AdminPage() {
  // 인증 상태 (캐시 없이 항상 초기값으로 시작)
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(false); // 초기값 false - 바로 로그인 폼 표시
  const [authError, setAuthError] = useState<string | null>(null);

  // 관리자 권한 확인 (타임아웃 추가)
  const checkAdminStatus = useCallback(async (userId: string): Promise<AdminInfo | null> => {
    if (!supabase) return null;

    try {
      // 5초 타임아웃
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000)
      );

      const queryPromise = supabase
        .from('admins')
        .select('id, name, role')
        .eq('user_id', userId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            console.log('[Admin] User is not an admin:', userId, error?.message);
            return null;
          }
          return data as AdminInfo;
        });

      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result === null) {
        console.log('[Admin] Admin check timeout or not found');
      }

      return result;
    } catch (err) {
      console.error('[Admin] Error checking admin status:', err);
      return null;
    }
  }, []);

  // 관리자 로그인 (직접 로그인만 허용)
  const adminLogin = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) {
      setAuthError('Supabase가 설정되지 않았습니다');
      return false;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      // 기존 세션 먼저 로그아웃 (깨끗한 상태로 시작)
      await supabase.auth.signOut();

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
        console.log('[Admin] Login successful, checking admin status...');

        const admin = await checkAdminStatus(data.user.id);

        if (!admin) {
          setAuthError('관리자 권한이 없는 계정입니다');
          await supabase.auth.signOut();
          setAuthLoading(false);
          return false;
        }

        console.log('[Admin] Admin verified:', admin.name);
        setUser(data.user);
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

  // 로그인되지 않았거나 관리자가 아닌 경우 -> 항상 로그인 폼 표시
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
