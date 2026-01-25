/**
 * Auth Actions
 * 로그인/회원가입 액션
 */

import { supabase } from '../../lib/supabase';
import type { User, SetState, GetState } from './types';
import {
  log,
  mapSupabaseUser,
  checkAdminStatus,
  saveRememberMe,
  saveUserToStorage,
} from './utils';

/**
 * 이메일/비밀번호 로그인
 */
export async function login(
  email: string,
  password: string,
  rememberMe: boolean,
  set: SetState,
  _get: GetState
): Promise<boolean> {
  set({ isLoading: true, error: null });

  // Supabase 미설정 시 테스트 계정
  if (!supabase) {
    if (email === 'test@example.com' && password === 'password') {
      const mockUser: User = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: '테스트 학생',
        studentId: 'test-student-id',
      };

      setTimeout(() => {
        set({ user: mockUser, isAuthenticated: true, isLoading: false });
        saveUserToStorage(mockUser);
      }, 500);

      return true;
    }
    set({ error: '서버 연결에 실패했습니다', isLoading: false });
    return false;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      let errorMessage = '로그인에 실패했습니다';
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = '이메일 인증이 필요합니다. 메일함을 확인해주세요';
      }
      set({ error: errorMessage, isLoading: false });
      return false;
    }

    if (data.user) {
      // students 테이블과 관리자 권한 병렬 조회
      const [studentResult, isAdmin] = await Promise.all([
        supabase.from('students').select('id').eq('user_id', data.user.id).single(),
        checkAdminStatus(data.user.id),
      ]);

      const user = mapSupabaseUser(data.user, studentResult.data?.id, isAdmin);
      set({ user, session: data.session, isAuthenticated: true, isLoading: false });
      saveUserToStorage(user);
      saveRememberMe(rememberMe);

      return true;
    }

    set({ isLoading: false });
    return false;
  } catch (err) {
    console.error('[Auth] Login error:', err);
    set({ error: '서버 연결에 실패했습니다', isLoading: false });
    return false;
  }
}

/**
 * Google OAuth 로그인
 */
export async function loginWithGoogle(set: SetState): Promise<boolean> {
  if (!supabase) {
    set({ error: 'Supabase가 설정되지 않았습니다' });
    return false;
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });

    if (error) {
      set({ error: 'Google 로그인에 실패했습니다' });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Auth] Google login error:', err);
    set({ error: 'Google 로그인에 실패했습니다' });
    return false;
  }
}
