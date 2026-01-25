/**
 * Initialize Auth
 * 앱 시작 시 인증 초기화
 */

import { supabase } from '../../lib/supabase';
import type { SetState, GetState } from './types';
import { log, AUTH_TIMEOUT, checkAdminStatus, mapSupabaseUser, isRememberMeExpired } from './utils';
import {
  verifySessionInBackground,
  fetchStudentIdInBackground,
  setupAuthStateListener,
} from './sessionHelpers';

/**
 * Supabase Auth 초기화 (앱 시작 시 호출)
 */
export async function initializeAuth(set: SetState, get: GetState): Promise<void> {
  const startTime = performance.now();
  log.log(' initializeAuth started');

  if (!supabase) {
    console.warn('[Auth] Supabase not configured');
    set({ isLoading: false });
    return;
  }

  // 자동로그인 만료 체크
  if (isRememberMeExpired()) {
    log.log(' 자동로그인 만료됨');
    await supabase.auth.signOut();
    localStorage.removeItem('questybook_remember_me');
    localStorage.removeItem('questybook_remember_expires');
    set({ isLoading: false, user: null, session: null, isAuthenticated: false });
    return;
  }

  const rememberMe = localStorage.getItem('questybook_remember_me');
  const sessionActive = sessionStorage.getItem('questybook_session_active');

  // 모바일 새로고침 대응
  if (!rememberMe && !sessionActive) {
    const persistedUser = get().user;
    if (persistedUser) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        log.log(' 세션 없음 - 로그아웃');
        await supabase.auth.signOut();
        set({ isLoading: false, user: null, session: null, isAuthenticated: false });
        localStorage.removeItem('questybook-auth');
        return;
      }
      sessionStorage.setItem('questybook_session_active', 'true');
    }
  }

  // 낙관적 로딩
  const persistedUser = get().user;
  if (persistedUser) {
    log.log(' Optimistic:', persistedUser.email);
    set({ isAuthenticated: true, isLoading: false });
    if (!rememberMe) sessionStorage.setItem('questybook_session_active', 'true');
    verifySessionInBackground(set, get);
    return;
  }

  // 세션 체크
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), AUTH_TIMEOUT));
    const result = await Promise.race([sessionPromise, timeoutPromise]);

    if (result === null) {
      set({ isLoading: false, user: null, session: null, isAuthenticated: false });
      return;
    }

    const { data: { session }, error: sessionError } = result;
    if (sessionError || !session?.user) {
      set({ isLoading: false, user: null, session: null, isAuthenticated: false });
      if (!sessionError) setupAuthStateListener(set);
      return;
    }

    const cachedStudentId = localStorage.getItem('questybook_student_id');
    const isAdmin = await checkAdminStatus(session.user.id);
    const user = mapSupabaseUser(session.user, cachedStudentId || undefined, isAdmin);
    set({ user, session, isAuthenticated: true, isLoading: false });
    localStorage.setItem('questybook_student_name', user.name);
    fetchStudentIdInBackground(session.user.id, set, get);
    setupAuthStateListener(set);
    console.log(`[Auth] Init: ${(performance.now() - startTime).toFixed(0)}ms`);
  } catch (err) {
    console.error('[Auth] Init error:', err);
    set({ isLoading: false, user: null, session: null, isAuthenticated: false });
  }
}
