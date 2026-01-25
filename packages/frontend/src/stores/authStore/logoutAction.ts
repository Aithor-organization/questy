/**
 * Logout Action
 * 로그아웃 액션
 */

import { supabase } from '../../lib/supabase';
import { clearStudentIdCache } from '../../lib/chat-api';
import type { SetState } from './types';
import { log, clearAuthStorage } from './utils';

/**
 * 로그아웃
 */
export async function logout(set: SetState): Promise<void> {
  log.log(' 로그아웃 시작 - 모든 데이터 정리');

  // chat-api 캐시 정리
  clearStudentIdCache();

  // localStorage/sessionStorage 정리
  clearAuthStorage();

  // Zustand 상태 초기화
  set({
    user: null,
    session: null,
    userProfile: null,
    membershipData: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Supabase 세션 종료
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[Auth] signOut error (ignored):', e);
    }
  }

  log.log(' 로그아웃 완료');
}
