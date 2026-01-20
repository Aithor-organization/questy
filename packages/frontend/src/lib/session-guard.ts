/**
 * Session Guard
 * 중요한 작업(저장, 추가, 삭제) 전에 세션 유효성을 확인
 * 세션이 만료되면 사용자에게 알림 후 재로그인 유도
 */

import { supabase } from './supabase';
import { toast } from '../stores/toastStore';

// 마지막 세션 체크 시간
let lastValidationTime = 0;
const VALIDATION_INTERVAL = 30 * 1000; // 30초마다 체크

// 세션 만료 시 표시할 모달/토스트 콜백
let onSessionExpiredCallback: (() => void) | null = null;

/**
 * 세션 만료 콜백 등록
 */
export function setSessionExpiredCallback(callback: () => void): void {
  onSessionExpiredCallback = callback;
}

/**
 * 세션 유효성 확인 (캐시 사용)
 * @param force - true면 캐시 무시하고 무조건 체크
 * @returns true: 유효, false: 만료됨
 */
export async function isSessionValid(force = false): Promise<boolean> {
  if (!supabase) return false;

  const now = Date.now();

  // 최근에 체크했으면 캐시된 결과 사용 (API 호출 최소화)
  if (!force && now - lastValidationTime < VALIDATION_INTERVAL) {
    return true;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.warn('[SessionGuard] 세션 만료됨:', error?.message);
      return false;
    }

    lastValidationTime = now;
    return true;
  } catch (err) {
    console.error('[SessionGuard] 세션 체크 오류:', err);
    return false;
  }
}

/**
 * 중요 작업 전 세션 확인 + 만료 시 알림
 * @returns true: 진행 가능, false: 세션 만료 (작업 중단)
 */
export async function ensureValidSession(): Promise<boolean> {
  const valid = await isSessionValid(true); // 중요 작업 전엔 항상 강제 체크

  if (!valid) {
    // 세션 만료 알림
    if (onSessionExpiredCallback) {
      onSessionExpiredCallback();
    } else {
      // 토스트 알림 (8초 표시)
      toast.error('세션이 만료되었습니다. 페이지를 새로고침해주세요.', 8000);
    }
    return false;
  }

  return true;
}

/**
 * API 호출을 세션 가드로 감싸는 래퍼
 * @param operation - 실행할 API 호출 함수
 * @returns operation의 반환값 또는 세션 만료 시 null
 */
export async function withSessionGuard<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  const valid = await ensureValidSession();
  if (!valid) return null;

  return operation();
}

/**
 * 탭 활성화 시 세션 재확인
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // 탭 활성화 시 캐시 무효화 → 다음 중요 작업에서 재확인
      lastValidationTime = 0;
      console.log('[SessionGuard] 탭 활성화 - 세션 재확인 예약됨');
    }
  });
}
