/**
 * Session Keep-Alive
 * 세션을 주기적으로 갱신하여 만료 방지
 * - AbortError 자동 재시도
 * - 디바운스로 중복 호출 방지
 */

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// 기본 갱신 주기: 5분 (토큰 만료 전 충분한 여유)
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000;

// 디바운스 시간: 2초 (연속 호출 방지)
const DEBOUNCE_MS = 2000;

// 마지막 갱신 시도 시간 (전역 - 중복 호출 방지)
let lastRefreshAttempt = 0;

// 갱신 진행 중 플래그 (동시 호출 방지)
let isRefreshing = false;

/**
 * 세션 강제 갱신 (AbortError 재시도 포함)
 * @param maxRetries - 최대 재시도 횟수
 * @returns 성공 여부
 */
export async function refreshSession(maxRetries: number = 3): Promise<boolean> {
  if (!supabase) {
    console.warn('%c[SessionKeepAlive] ⚠️ Supabase 클라이언트 없음', 'color: #f59e0b;');
    return false;
  }

  // 이미 갱신 중이면 스킵
  if (isRefreshing) {
    console.log('[SessionKeepAlive] 이미 갱신 중 - 스킵');
    return false;
  }

  // 디바운스: 최근 갱신 시도가 있으면 스킵
  const now = Date.now();
  if (now - lastRefreshAttempt < DEBOUNCE_MS) {
    console.log('[SessionKeepAlive] 디바운스 - 스킵');
    return false;
  }

  lastRefreshAttempt = now;
  isRefreshing = true;

  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(`%c[SessionKeepAlive] 🔄 세션 갱신 시도 (${timestamp})`, 'color: #3b82f6; font-weight: bold;');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        // AbortError인 경우 재시도
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) {
          console.warn(`[SessionKeepAlive] ⚠️ AbortError 발생 (${attempt}/${maxRetries}), 재시도...`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
        }
        console.warn(`%c[SessionKeepAlive] ❌ 세션 갱신 실패: ${error.message}`, 'color: #ef4444;');
        isRefreshing = false;
        return false;
      }

      if (data.session) {
        const expiresAt = data.session.expires_at
          ? new Date(data.session.expires_at * 1000).toLocaleTimeString('ko-KR')
          : '알 수 없음';
        console.log(
          `%c[SessionKeepAlive] ✅ 세션 갱신 성공 (만료: ${expiresAt})`,
          'color: #22c55e; font-weight: bold;'
        );
        isRefreshing = false;
        return true;
      }

      console.warn('%c[SessionKeepAlive] ⚠️ 활성 세션 없음 - 갱신 불가', 'color: #f59e0b;');
      isRefreshing = false;
      return false;
    } catch (err: any) {
      // AbortError 예외 처리
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        console.warn(`[SessionKeepAlive] AbortError 예외 (${attempt}/${maxRetries}), 재시도...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }
      }
      console.error('[SessionKeepAlive] 세션 갱신 오류:', err);
      isRefreshing = false;
      return false;
    }
  }

  isRefreshing = false;
  return false;
}

/**
 * 세션 유지 훅
 * - 마운트 시 세션 갱신 (약간의 딜레이 후)
 * - 지정된 주기로 자동 갱신 (기본 10분)
 *
 * 참고: 탭 활성화 시 갱신은 Supabase SDK가 내부적으로 처리하므로
 * 여기서는 주기적 갱신만 담당 (Web Locks API 충돌 방지)
 *
 * @param enabled - 활성화 여부 (기본 true, 로그인 상태에 따라 조절)
 * @param intervalMs - 갱신 주기 (밀리초), 기본 10분
 */
export function useSessionKeepAlive(
  enabled: boolean = true,
  intervalMs: number = DEFAULT_REFRESH_INTERVAL
): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    console.log(`%c[SessionKeepAlive] 훅 실행 (enabled: ${enabled})`, 'color: #6b7280;');

    // 비활성화 상태면 아무것도 하지 않음
    if (!enabled) {
      console.log('%c[SessionKeepAlive] ⏸️ 비활성화 상태 - 세션 갱신 중지', 'color: #6b7280;');
      return;
    }

    console.log(`%c[SessionKeepAlive] ▶️ 세션 갱신 활성화 (주기: ${intervalMs / 1000}초)`, 'color: #22c55e;');

    // 마운트 시 약간의 딜레이 후 세션 갱신 (다른 초기화와 충돌 방지)
    const mountTimeout = setTimeout(() => {
      console.log('%c[SessionKeepAlive] 🚀 초기 세션 갱신 실행', 'color: #8b5cf6;');
      refreshSession();
    }, 2000);

    // 주기적 갱신 시작
    intervalRef.current = setInterval(() => {
      // 탭이 활성 상태일 때만 갱신 (백그라운드에서는 스킵)
      if (document.visibilityState === 'visible') {
        console.log('%c[SessionKeepAlive] ⏰ 주기적 세션 갱신 실행', 'color: #8b5cf6;');
        refreshSession();
      }
    }, intervalMs);

    // 탭 활성화 시 세션 갱신 (백그라운드에서 돌아올 때)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('%c[SessionKeepAlive] 👁️ 탭 활성화 감지 - 세션 갱신', 'color: #8b5cf6;');
        refreshSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 클린업
    return () => {
      clearTimeout(mountTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
