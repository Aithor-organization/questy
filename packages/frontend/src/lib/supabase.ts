/**
 * Supabase Client for Frontend
 * Anon Key 사용 - RLS 정책에 따라 접근 제한됨
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Anon Client (RLS 적용)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,  // OAuth 콜백 URL에서 세션 감지
        storageKey: 'questy-auth-token',  // 명시적 storage key
        flowType: 'implicit',  // Web Locks API AbortError 방지 (PKCE 대신 implicit flow 사용)
      },
      global: {
        headers: {
          'x-application-name': 'questy',
        },
      },
      // 실시간 연결 설정 (불필요한 연결 방지)
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    })
  : null;

// Supabase 활성화 여부
export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}

/**
 * AbortError 발생 시 자동 재시도하는 Supabase 쿼리 래퍼
 * 탭 visibility 변경 시 발생하는 Web Locks API 에러를 처리
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // AbortError인 경우에만 재시도
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        console.warn(`[Supabase] AbortError on attempt ${attempt}/${maxRetries}, retrying...`);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
          continue;
        }
      }

      // 다른 에러는 즉시 throw
      throw error;
    }
  }

  throw lastError;
}

/**
 * Supabase 쿼리 빌더를 재시도 가능하게 래핑
 * 사용 예: const { data, error } = await retryQuery(() => supabase.from('table').select('*'));
 */
export async function retryQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    return await withRetry(() => queryFn());
  } catch (error: any) {
    return { data: null, error };
  }
}
