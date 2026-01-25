/**
 * Session Helpers
 * 세션 관리 헬퍼 함수들
 */

import { supabase, retryQuery } from '../../lib/supabase';
import type { SetState, GetState } from './types';
import {
  log,
  mapSupabaseUser,
  checkAdminStatus,
  isVerifyingSession,
  setVerifyingSession,
} from './utils';
import { setupAuthStateListener } from './authStateListener';

export { setupAuthStateListener } from './authStateListener';

/**
 * 백그라운드 studentId 조회
 */
export async function fetchStudentIdInBackground(
  userId: string,
  set: SetState,
  get: GetState
): Promise<void> {
  if (!supabase) return;

  try {
    const { data: student } = await retryQuery<{ id: string }>(() =>
      supabase!.from('students').select('id').eq('user_id', userId).single()
    );

    if (student?.id) {
      const currentUser = get().user;
      if (currentUser) {
        set({ user: { ...currentUser, studentId: student.id } });
        localStorage.setItem('questybook_student_id', student.id);
        log.log(' Background: studentId updated');
      }
    }
  } catch (e) {
    console.warn('[Auth] Background: Student lookup failed:', e);
  }
}

/**
 * 백그라운드 세션 검증 (낙관적 로딩 후 실행)
 */
export async function verifySessionInBackground(
  set: SetState,
  get: GetState
): Promise<void> {
  if (isVerifyingSession || !supabase) return;
  setVerifyingSession(true);

  try {
    log.log(' Background: Verifying session...');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      console.warn('[Auth] Background: Session invalid, logging out');
      set({ user: null, session: null, isAuthenticated: false });
      localStorage.removeItem('questybook_student_id');
      localStorage.removeItem('questybook_student_name');
      return;
    }

    const currentUser = get().user;
    const cachedStudentId = localStorage.getItem('questybook_student_id');
    const isAdmin = await checkAdminStatus(session.user.id);
    const user = mapSupabaseUser(
      session.user,
      currentUser?.studentId || cachedStudentId || undefined,
      isAdmin
    );
    set({ user, session });

    if (!currentUser?.studentId) {
      fetchStudentIdInBackground(session.user.id, set, get);
    }

    setupAuthStateListener(set);
    log.log(' Background: Session verified');
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      log.log(' Background verification cancelled');
      return;
    }
    console.error('[Auth] Background verification error:', err);
  } finally {
    setVerifyingSession(false);
  }
}

/**
 * 세션 재검증 내부 함수
 */
export async function revalidateSessionInternal(
  get: GetState,
  set: SetState
): Promise<void> {
  if (!supabase) return;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      console.warn('[Auth] Session expired on tab return, logging out');
      set({ user: null, session: null, isAuthenticated: false });
      localStorage.removeItem('questybook_student_id');
      localStorage.removeItem('questybook_student_name');
      return;
    }

    const currentUser = get().user;
    if (currentUser) {
      set({ session });
      log.log(' Session revalidated successfully');
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      log.log(' Session revalidation cancelled');
      return;
    }
    console.error('[Auth] Session revalidation error:', err);
  }
}
