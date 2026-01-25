/**
 * Auth Store Utilities
 * 공통 유틸리티 함수들
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { createLogger } from '../../lib/logger';
import type { User } from './types';

// 개발 모드에서만 동작하는 로거
export const log = createLogger('[Auth]');

// 세션 검증 타임아웃 (ms)
export const AUTH_TIMEOUT = 3000;

// 백그라운드 세션 검증 상태
export let isVerifyingSession = false;
export const setVerifyingSession = (value: boolean) => { isVerifyingSession = value; };

// 리스너 등록 상태 (중복 등록 방지)
export let isListenerRegistered = false;
export const setListenerRegistered = (value: boolean) => { isListenerRegistered = value; };

/**
 * Supabase User를 앱 User로 변환
 * isAdmin은 별도로 checkAdminStatus()에서 설정됨
 */
export function mapSupabaseUser(
  supabaseUser: SupabaseUser,
  studentId?: string,
  isAdmin?: boolean
): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || '학생',
    studentId: studentId || null,
    isAdmin: isAdmin ?? false,
  };
}

/**
 * 관리자 권한 확인 (admins 테이블 조회)
 */
export async function checkAdminStatus(userId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    return !error && data !== null;
  } catch (err) {
    console.warn('[Auth] Admin check failed:', err);
    return false;
  }
}

/**
 * 자동로그인 만료 체크
 */
export function isRememberMeExpired(): boolean {
  const rememberMe = localStorage.getItem('questybook_remember_me');
  const rememberExpires = localStorage.getItem('questybook_remember_expires');

  if (rememberMe === 'true' && rememberExpires) {
    const expiresAt = parseInt(rememberExpires, 10);
    return Date.now() > expiresAt;
  }
  return false;
}

/**
 * 자동로그인 설정 저장
 */
export function saveRememberMe(remember: boolean): void {
  if (remember) {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30일
    localStorage.setItem('questybook_remember_me', 'true');
    localStorage.setItem('questybook_remember_expires', expiresAt.toString());
  } else {
    localStorage.removeItem('questybook_remember_me');
    localStorage.removeItem('questybook_remember_expires');
    sessionStorage.setItem('questybook_session_active', 'true');
  }
}

/**
 * 로그아웃 시 localStorage 정리
 */
export function clearAuthStorage(): void {
  const keysToRemove = [
    'questybook_student_id',
    'questybook_student_name',
    'questybook_last_user_id',
    'questybook_remember_me',
    'questybook_remember_expires',
    'questybook-chat-storage-v2',
    'questybook-storage',
    'questybook-auth',
    'questybook_session_id',
  ];

  keysToRemove.forEach(key => localStorage.removeItem(key));

  // conversationId 키들도 삭제
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('questybook_conv_')) {
      localStorage.removeItem(key);
    }
  });

  sessionStorage.removeItem('questybook_session_active');
}

/**
 * 사용자 정보 localStorage에 저장
 */
export function saveUserToStorage(user: User): void {
  if (user.studentId) {
    localStorage.setItem('questybook_student_id', user.studentId);
  }
  localStorage.setItem('questybook_student_name', user.name);
}
