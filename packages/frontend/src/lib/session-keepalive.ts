/**
 * Session Keep-Alive (DISABLED)
 *
 * Supabase SDK (autoRefreshToken: true)가 세션 관리를 완전히 처리합니다.
 * 수동 세션 갱신은 Web Locks API 충돌을 일으킬 수 있어 비활성화되었습니다.
 *
 * 참고: https://supabase.com/docs/guides/auth/sessions
 * - autoRefreshToken: true 설정 시 SDK가 토큰 만료 전 자동 갱신
 * - 탭 활성화 시에도 SDK가 내부적으로 처리
 */

/**
 * 세션 유지 훅 (현재 비활성화됨)
 *
 * Supabase SDK가 모든 세션 관리를 담당하므로 이 훅은 아무 동작도 하지 않습니다.
 * Web Locks API 충돌 방지를 위해 수동 세션 갱신이 제거되었습니다.
 */
export function useSessionKeepAlive(
  _enabled: boolean = true,
  _intervalMs: number = 5 * 60 * 1000
): void {
  // Supabase SDK (autoRefreshToken: true)가 세션을 자동 관리합니다.
  // 수동 갱신은 Web Locks API 충돌을 일으킬 수 있어 비활성화되었습니다.
}

/**
 * 수동 세션 갱신 (DEPRECATED)
 *
 * 이 함수는 Web Locks API 충돌 문제로 더 이상 사용되지 않습니다.
 * Supabase SDK의 autoRefreshToken이 자동으로 토큰을 갱신합니다.
 *
 * @deprecated Supabase SDK가 자동으로 처리합니다
 */
export async function refreshSession(_maxRetries: number = 3): Promise<boolean> {
  console.log('[SessionKeepAlive] ℹ️ 수동 갱신 비활성화됨 - Supabase SDK가 자동 처리');
  return true;
}
