/**
 * Supabase Client for Backend
 * Service Role Key 사용 - RLS 우회하여 모든 데이터 접근 가능
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - Supabase features disabled');
}

// Service Role Client (RLS 우회)
export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// 연결 테스트
export async function testSupabaseConnection(): Promise<boolean> {
  if (!supabase) {
    console.log('[Supabase] Client not initialized');
    return false;
  }

  try {
    const { error } = await supabase.from('students').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = 테이블 없음 (아직 생성 안 됨)
      console.error('[Supabase] Connection test failed:', error.message);
      return false;
    }
    console.log('[Supabase] Connected successfully');
    return true;
  } catch (err) {
    console.error('[Supabase] Connection error:', err);
    return false;
  }
}

// Supabase 활성화 여부
export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}
