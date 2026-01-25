/**
 * Auth State Listener
 * Supabase 인증 상태 변경 리스너
 */

import { supabase } from '../../lib/supabase';
import type { SetState } from './types';
import {
  log,
  mapSupabaseUser,
  checkAdminStatus,
  isListenerRegistered,
  setListenerRegistered,
  saveRememberMe,
} from './utils';

/**
 * 인증 상태 변경 리스너 설정 (중복 등록 방지)
 */
export function setupAuthStateListener(set: SetState): void {
  if (!supabase) return;

  if (isListenerRegistered) {
    log.log(' Listener already registered, skipping');
    return;
  }
  setListenerRegistered(true);
  log.log(' Setting up auth state listener');

  const client = supabase;

  client.auth.onAuthStateChange((event, newSession) => {
    log.log(' State changed:', event);

    if (event === 'SIGNED_IN' && newSession?.user) {
      handleSignedIn(client, newSession, set);
    } else if (event === 'SIGNED_OUT') {
      handleSignedOut(set);
    } else if (event === 'TOKEN_REFRESHED' && newSession) {
      set({ session: newSession });
    }
  });
}

/**
 * SIGNED_IN 이벤트 처리
 */
function handleSignedIn(
  client: typeof supabase,
  newSession: NonNullable<Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[1]>,
  set: SetState
): void {
  const cachedStudentId = localStorage.getItem('questybook_student_id');
  const basicUser = mapSupabaseUser(newSession.user, cachedStudentId || undefined, false);
  set({
    user: basicUser,
    session: newSession,
    isAuthenticated: true,
    isLoading: false,
  });

  // 비동기 작업은 setTimeout으로 지연 (데드락 방지)
  setTimeout(async () => {
    let studentId: string | null = cachedStudentId;
    let isNewUser = false;

    try {
      const { data: student } = await client!
        .from('students')
        .select('id')
        .eq('user_id', newSession.user.id)
        .single();

      if (!student) {
        isNewUser = true;
        const userName =
          newSession.user.user_metadata?.name ||
          newSession.user.email?.split('@')[0] ||
          '학생';
        const { data: newStudent } = await client!
          .from('students')
          .insert({ user_id: newSession.user.id, name: userName })
          .select('id')
          .single();
        studentId = newStudent?.id || null;

        if (studentId) {
          await Promise.all([
            client!.from('student_progress').insert({ student_id: studentId }),
            client!.from('user_memberships').insert({
              user_id: newSession.user.id,
              membership_type: 'pending',
              status: 'pending',
            }),
          ]);
          log.log(' New OAuth user: records created');
        }
      } else {
        studentId = student.id;
      }
    } catch (e) {
      console.warn('[Auth] Student handling error:', e);
    }

    const isAdmin = isNewUser ? false : await checkAdminStatus(newSession.user.id);
    const updatedUser = mapSupabaseUser(newSession.user, studentId || undefined, isAdmin);
    if (isNewUser) {
      updatedUser.onboardingCompleted = false;
    }

    set({
      user: updatedUser,
      ...(isNewUser && { needsOnboarding: true }),
    });

    if (studentId) {
      localStorage.setItem('questybook_student_id', studentId);
    }
    localStorage.setItem('questybook_student_name', updatedUser.name);
  }, 0);

  // OAuth 로그인 시 자동로그인 설정 처리
  const pendingRememberMe = localStorage.getItem('questybook_pending_remember_me');
  if (pendingRememberMe === 'true') {
    saveRememberMe(true);
    localStorage.removeItem('questybook_pending_remember_me');
    log.log(' OAuth 자동로그인 설정됨');
  } else {
    saveRememberMe(false);
    localStorage.removeItem('questybook_pending_remember_me');
  }
}

/**
 * SIGNED_OUT 이벤트 처리
 */
function handleSignedOut(set: SetState): void {
  set({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,
  });
  localStorage.removeItem('questybook_student_id');
  localStorage.removeItem('questybook_student_name');
}
