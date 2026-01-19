/**
 * Admin Page - Main Entry Point
 * 관리자 페이지 통합 진입점
 *
 * 세션 관리:
 * - sessionStorage에 30분 TTL로 세션 유지
 * - 새로고침해도 30분 내에는 로그인 유지
 * - Supabase 세션과 함께 관리자 정보도 저장
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { AdminLoginForm } from './AdminLoginForm';
import { AdminContent } from './AdminContent';
import type { AdminInfo } from './types';

// 세션 저장 키 및 TTL (30분)
const ADMIN_SESSION_KEY = 'admin_session';
const SESSION_TTL = 30 * 60 * 1000; // 30분

// 세션 저장
function saveAdminSession(user: SupabaseUser, adminInfo: AdminInfo) {
  const session = {
    user,
    adminInfo,
    expiresAt: Date.now() + SESSION_TTL,
  };
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

// 세션 로드 (만료 체크 포함)
function loadAdminSession(): { user: SupabaseUser; adminInfo: AdminInfo } | null {
  try {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return { user: session.user, adminInfo: session.adminInfo };
  } catch {
    return null;
  }
}

// 세션 삭제
function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

// 세션 갱신 (활동 시 TTL 연장)
function refreshAdminSession() {
  try {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) return;

    const session = JSON.parse(stored);
    session.expiresAt = Date.now() + SESSION_TTL;
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } catch {
    // 무시
  }
}

export function AdminPage() {
  // 세션 복원 시도
  const savedSession = loadAdminSession();

  // 인증 상태
  const [user, setUser] = useState<SupabaseUser | null>(savedSession?.user || null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(savedSession?.adminInfo || null);
  const [authLoading, setAuthLoading] = useState(!savedSession); // 세션 있으면 로딩 안 함
  const [authError, setAuthError] = useState<string | null>(null);

  // 컴포넌트 마운트 시 Supabase 세션 확인
  useEffect(() => {
    if (savedSession) {
      // 세션이 있으면 Supabase 세션도 확인
      supabase?.auth.getSession().then(({ data }) => {
        if (!data.session) {
          // Supabase 세션이 없으면 로컬 세션도 삭제
          clearAdminSession();
          setUser(null);
          setAdminInfo(null);
        }
        setAuthLoading(false);
      });
    } else {
      setAuthLoading(false);
    }
  }, []);

  // 활동 시 세션 갱신 (클릭, 키 입력)
  useEffect(() => {
    if (!user || !adminInfo) return;

    const handleActivity = () => refreshAdminSession();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [user, adminInfo]);

  // 관리자 권한 확인 (타임아웃 추가)
  const checkAdminStatus = useCallback(async (userId: string): Promise<AdminInfo | null> => {
    if (!supabase) return null;

    try {
      // 10초 타임아웃 (네트워크 지연 또는 DB cold start 대비)
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 10000)
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
        saveAdminSession(data.user, admin); // 세션 저장
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
    clearAdminSession(); // 세션 삭제
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
