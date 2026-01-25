/**
 * Register Action
 * 회원가입 액션
 */

import { supabase } from '../../lib/supabase';
import type { SetState, GetState } from './types';
import { log, mapSupabaseUser, saveUserToStorage } from './utils';

/**
 * 회원가입
 */
export async function register(
  email: string,
  password: string,
  name: string,
  set: SetState,
  _get: GetState
): Promise<boolean> {
  set({ isLoading: true, error: null });

  if (!supabase) {
    set({ error: 'Supabase가 설정되지 않았습니다', isLoading: false });
    return false;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: undefined },
    });

    if (error) {
      let errorMessage = '회원가입에 실패했습니다';
      if (error.message.includes('already registered')) {
        errorMessage = '이미 등록된 이메일입니다';
      } else if (error.message.includes('Password')) {
        errorMessage = '비밀번호는 최소 6자 이상이어야 합니다';
      }
      set({ error: errorMessage, isLoading: false });
      return false;
    }

    if (data.user && data.session) {
      // students 테이블에 프로필 생성
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({ user_id: data.user.id, name })
        .select('id')
        .single();

      if (studentError) {
        console.error('[Auth] Student creation error:', studentError);
      }

      // student_progress와 user_memberships 병렬 생성
      if (student?.id) {
        await Promise.all([
          supabase.from('student_progress').insert({ student_id: student.id }),
          supabase.from('user_memberships').insert({
            user_id: data.user.id,
            membership_type: 'pending',
            status: 'pending',
          }),
        ]);
        log.log(' New user: student_progress & user_memberships created');
      }

      const user = mapSupabaseUser(data.user, student?.id);
      user.onboardingCompleted = false;

      set({
        user,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
        needsOnboarding: true,
      });

      saveUserToStorage(user);
      return true;
    }

    if (data.user && !data.session) {
      set({
        error: '이메일 인증이 필요합니다. Supabase 대시보드에서 이메일 인증을 비활성화해주세요.',
        isLoading: false,
      });
      return false;
    }

    set({ isLoading: false });
    return false;
  } catch (err) {
    console.error('[Auth] Register error:', err);
    set({ error: '서버 연결에 실패했습니다', isLoading: false });
    return false;
  }
}
