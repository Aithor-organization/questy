/**
 * Database Connection
 * Bun SQLite + Drizzle ORM 연결 설정
 */

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema.js';
import path from 'path';

// DB 파일 경로 (프로젝트 루트에 저장)
const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'questybook.db');

// Bun SQLite 연결
export const sqlite = new Database(DB_PATH);

// Drizzle 인스턴스
export const db = drizzle(sqlite, { schema });

export { DB_PATH };
