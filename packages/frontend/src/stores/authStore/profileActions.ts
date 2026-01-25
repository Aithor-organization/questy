/**
 * Profile Actions
 * 프로필 업데이트 액션
 */

import { supabase } from '../../lib/supabase';
import type { SetState, GetState } from './types';

/**
 * 프로필 업데이트 (이름, 비밀번호)
 */
export async function updateProfile(
  updates: { name?: string; password?: string },
  get: GetState,
  set: SetState
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase가 설정되지 않았습니다' };
  }

  try {
    const currentUser = get().user;
    if (!currentUser) {
      return { success: false, error: '로그인이 필요합니다' };
    }

    // 비밀번호 변경
    if (updates.password) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: updates.password,
      });

      if (passwordError) {
        console.error('[Auth] Password update error:', passwordError);
        return { success: false, error: '비밀번호 변경에 실패했습니다' };
      }
    }

    // 이름 변경
    if (updates.name && updates.name !== currentUser.name) {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: updates.name },
      });

      if (metaError) {
        console.error('[Auth] Metadata update error:', metaError);
        return { success: false, error: '이름 변경에 실패했습니다' };
      }

      // students 테이블 업데이트
      if (currentUser.studentId) {
        const { error: studentError } = await supabase
          .from('students')
          .update({ name: updates.name })
          .eq('id', currentUser.studentId);

        if (studentError) {
          console.error('[Auth] Student name update error:', studentError);
        }
      }

      // 로컬 상태 업데이트
      const updatedUser = { ...currentUser, name: updates.name };
      set({ user: updatedUser });
      localStorage.setItem('questybook_student_name', updates.name);
    }

    return { success: true };
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    return { success: false, error: '프로필 업데이트에 실패했습니다' };
  }
}
