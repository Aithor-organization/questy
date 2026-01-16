/**
 * Database Initialization
 * 테이블 생성 및 마이그레이션
 *
 * NOTE: SQLite는 Bun 환경에서만 초기화됩니다.
 */

import { sqlite, DB_PATH } from './connection.js';

// 기존 테이블에 새 컬럼 추가 (이미 있으면 무시)
function addColumnsIfNotExist() {
  if (!sqlite) return;

  try {
    sqlite.exec(`ALTER TABLE courses ADD COLUMN is_completed INTEGER DEFAULT 0`);
  } catch {}
  try {
    sqlite.exec(`ALTER TABLE courses ADD COLUMN last_crawled_at INTEGER`);
  } catch {}
}

// 테이블 생성 SQL
function createTables() {
  if (!sqlite) return;

  addColumnsIfNotExist();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      student_id TEXT REFERENCES students(id),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      last_login_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT,
      subjects TEXT,
      goals TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher TEXT NOT NULL,
      subject TEXT,
      platform TEXT DEFAULT 'megastudy',
      url TEXT,
      lectures TEXT,
      lecture_count INTEGER DEFAULT 0,
      total_duration TEXT,
      category TEXT,
      year INTEGER,
      is_completed INTEGER DEFAULT 0,
      last_crawled_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher);
    CREATE INDEX IF NOT EXISTS idx_courses_subject ON courses(subject);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id),
      name TEXT NOT NULL,
      material_name TEXT,
      subject TEXT,
      total_days INTEGER NOT NULL,
      total_units INTEGER,
      estimated_hours REAL,
      status TEXT DEFAULT 'active',
      start_date INTEGER,
      end_date INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      plan_id TEXT REFERENCES plans(id),
      student_id TEXT REFERENCES students(id),
      day INTEGER NOT NULL,
      date TEXT,
      title TEXT NOT NULL,
      description TEXT,
      units TEXT,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      status TEXT DEFAULT 'pending',
      completed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      quest_id TEXT REFERENCES quests(id),
      title TEXT NOT NULL,
      type TEXT,
      estimated_minutes INTEGER,
      completed INTEGER DEFAULT 0,
      completed_at INTEGER,
      "order" INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id),
      plan_id TEXT REFERENCES plans(id),
      date TEXT NOT NULL,
      study_minutes INTEGER DEFAULT 0,
      quests_completed INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id),
      role TEXT NOT NULL,
      agent_role TEXT,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      resolved_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
    CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);

    CREATE INDEX IF NOT EXISTS idx_plans_student ON plans(student_id);
    CREATE INDEX IF NOT EXISTS idx_quests_student ON quests(student_id);
    CREATE INDEX IF NOT EXISTS idx_quests_plan ON quests(plan_id);
    CREATE INDEX IF NOT EXISTS idx_quests_date ON quests(date);
    CREATE INDEX IF NOT EXISTS idx_progress_student ON progress(student_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_student ON conversations(student_id);
  `);
  console.log('[DB] Tables created/verified');
}

export function initializeDatabase() {
  if (!sqlite) {
    console.log('[DB] SQLite not available - skipping initialization (Node.js runtime)');
    return;
  }

  createTables();
  console.log('[DB] Database initialized at:', DB_PATH);
}
