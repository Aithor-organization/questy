/**
 * Database Connection
 * Bun SQLite + Drizzle ORM 연결 설정
 *
 * NOTE: SQLite는 Bun 환경에서만 작동합니다.
 * Node.js 환경(Railway 등)에서는 Supabase를 사용합니다.
 */

import * as schema from './schema.js';
import path from 'path';
import { supabase } from './supabase.js';

// Bun 런타임 감지
const isBun = typeof globalThis.Bun !== 'undefined';

// DB 파일 경로 (프로젝트 루트에 저장)
export const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'questybook.db');

// SQLite 및 Drizzle 인스턴스 (Bun 환경에서만 초기화)
export let sqlite: any = null;
export let db: any = null;

// Supabase 사용 여부 (Node.js 환경)
export const useSupabase = !isBun && supabase !== null;

if (isBun) {
  try {
    // 동적 import로 bun:sqlite 로드 (Node.js에서 파싱 에러 방지)
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');

    sqlite = new Database(DB_PATH);
    db = drizzle(sqlite, { schema });

    console.log('[DB] SQLite initialized (Bun runtime)');
  } catch (error) {
    console.warn('[DB] SQLite initialization failed:', error);
  }
} else {
  console.log('[DB] SQLite skipped (Node.js runtime - using Supabase instead)');
  if (supabase) {
    console.log('[DB] Supabase client available for queries');
  } else {
    console.warn('[DB] Supabase not configured - DB operations will fail');
  }
}
