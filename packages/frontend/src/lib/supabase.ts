/**
 * Supabase Client for Frontend
 * Anon Key 사용 - RLS 정책에 따라 접근 제한됨
 */

import { createClient } from '@supabase/supabase-js';

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
    })
  : null;

// Supabase 활성화 여부
export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}
