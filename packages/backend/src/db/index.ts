/**
 * Database Connection
 * Bun SQLite + Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import path from 'path';

// DB 파일 경로 (프로젝트 루트에 저장)
const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'questybook.db');

// Bun SQLite 연결
const sqlite = new Database(DB_PATH);

// Drizzle 인스턴스
export const db = drizzle(sqlite, { schema });

// ===================== 테이블 생성 (수동) =====================

function createTables() {
  // 기존 테이블에 새 컬럼 추가 (이미 있으면 무시)
  try {
    sqlite.exec(`ALTER TABLE courses ADD COLUMN is_completed INTEGER DEFAULT 0`);
  } catch {}
  try {
    sqlite.exec(`ALTER TABLE courses ADD COLUMN last_crawled_at INTEGER`);
  } catch {}

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

    CREATE INDEX IF NOT EXISTS idx_plans_student ON plans(student_id);
    CREATE INDEX IF NOT EXISTS idx_quests_student ON quests(student_id);
    CREATE INDEX IF NOT EXISTS idx_quests_plan ON quests(plan_id);
    CREATE INDEX IF NOT EXISTS idx_quests_date ON quests(date);
    CREATE INDEX IF NOT EXISTS idx_progress_student ON progress(student_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_student ON conversations(student_id);
  `);
  console.log('[DB] Tables created/verified');
}

// ===================== 사용자(인증) 관련 함수 =====================

export function getUserByEmail(email: string) {
  const result = db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1).all();
  return result[0] || null;
}

export function getUserById(id: string) {
  const result = db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1).all();
  return result[0] || null;
}

export function createUser(data: schema.NewUser) {
  const result = db.insert(schema.users).values(data).returning().all();
  return result[0];
}

export function updateUserLastLogin(id: string) {
  const result = db.update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, id))
    .returning()
    .all();
  return result[0];
}

export function linkUserToStudent(userId: string, studentId: string) {
  const result = db.update(schema.users)
    .set({ studentId, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning()
    .all();
  return result[0];
}

// ===================== 학생 관련 함수 =====================

export function getStudent(id: string) {
  const result = db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1).all();
  return result[0] || null;
}

export function createStudent(data: schema.NewStudent) {
  const result = db.insert(schema.students).values(data).returning().all();
  return result[0];
}

export function updateStudent(id: string, data: Partial<schema.NewStudent>) {
  const result = db.update(schema.students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.students.id, id))
    .returning()
    .all();
  return result[0];
}

// ===================== 플랜 관련 함수 =====================

export function getPlan(id: string) {
  const result = db.select().from(schema.plans).where(eq(schema.plans.id, id)).limit(1).all();
  return result[0] || null;
}

export function getStudentPlans(studentId: string) {
  return db.select().from(schema.plans)
    .where(eq(schema.plans.studentId, studentId))
    .orderBy(desc(schema.plans.createdAt))
    .all();
}

export function getActivePlans(studentId: string) {
  return db.select().from(schema.plans)
    .where(and(
      eq(schema.plans.studentId, studentId),
      eq(schema.plans.status, 'active')
    ))
    .orderBy(desc(schema.plans.createdAt))
    .all();
}

export function createPlan(data: schema.NewPlan) {
  const result = db.insert(schema.plans).values(data).returning().all();
  return result[0];
}

export function updatePlan(id: string, data: Partial<schema.NewPlan>) {
  const result = db.update(schema.plans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.plans.id, id))
    .returning()
    .all();
  return result[0];
}

// ===================== 퀘스트 관련 함수 =====================

export function getQuest(id: string) {
  const result = db.select().from(schema.quests).where(eq(schema.quests.id, id)).limit(1).all();
  return result[0] || null;
}

export function getPlanQuests(planId: string) {
  return db.select().from(schema.quests)
    .where(eq(schema.quests.planId, planId))
    .orderBy(schema.quests.day)
    .all();
}

export function getTodayQuests(studentId: string) {
  const today = new Date().toISOString().split('T')[0];
  return db.select().from(schema.quests)
    .where(and(
      eq(schema.quests.studentId, studentId),
      eq(schema.quests.date, today)
    ))
    .all();
}

export function getStudentQuests(studentId: string, limit = 50) {
  return db.select().from(schema.quests)
    .where(eq(schema.quests.studentId, studentId))
    .orderBy(desc(schema.quests.createdAt))
    .limit(limit)
    .all();
}

export function createQuest(data: schema.NewQuest) {
  const result = db.insert(schema.quests).values(data).returning().all();
  return result[0];
}

export function createQuests(data: schema.NewQuest[]) {
  if (data.length === 0) return [];
  const result = db.insert(schema.quests).values(data).returning().all();
  return result;
}

export function updateQuest(id: string, data: Partial<schema.NewQuest>) {
  const result = db.update(schema.quests)
    .set(data)
    .where(eq(schema.quests.id, id))
    .returning()
    .all();
  return result[0];
}

export function completeQuest(id: string, actualMinutes?: number) {
  return updateQuest(id, {
    status: 'completed',
    completedAt: new Date(),
    actualMinutes,
  });
}

// ===================== 태스크 관련 함수 =====================

export function getQuestTasks(questId: string) {
  return db.select().from(schema.tasks)
    .where(eq(schema.tasks.questId, questId))
    .orderBy(schema.tasks.order)
    .all();
}

export function createTask(data: schema.NewTask) {
  const result = db.insert(schema.tasks).values(data).returning().all();
  return result[0];
}

export function createTasks(data: schema.NewTask[]) {
  if (data.length === 0) return [];
  const result = db.insert(schema.tasks).values(data).returning().all();
  return result;
}

export function toggleTask(id: string) {
  const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1).all();
  if (!task[0]) return null;

  const result = db.update(schema.tasks)
    .set({
      completed: !task[0].completed,
      completedAt: !task[0].completed ? new Date() : null,
    })
    .where(eq(schema.tasks.id, id))
    .returning()
    .all();
  return result[0];
}

// ===================== 진도 관련 함수 =====================

export function getStudentProgress(studentId: string, days = 30) {
  return db.select().from(schema.progress)
    .where(eq(schema.progress.studentId, studentId))
    .orderBy(desc(schema.progress.date))
    .limit(days)
    .all();
}

export function getTodayProgress(studentId: string) {
  const today = new Date().toISOString().split('T')[0];
  const result = db.select().from(schema.progress)
    .where(and(
      eq(schema.progress.studentId, studentId),
      eq(schema.progress.date, today)
    ))
    .limit(1)
    .all();
  return result[0] || null;
}

export function upsertProgress(data: schema.NewProgress) {
  const existing = db.select().from(schema.progress)
    .where(and(
      eq(schema.progress.studentId, data.studentId!),
      eq(schema.progress.date, data.date)
    ))
    .limit(1)
    .all();

  if (existing[0]) {
    const result = db.update(schema.progress)
      .set(data)
      .where(eq(schema.progress.id, existing[0].id))
      .returning()
      .all();
    return result[0];
  }

  const result = db.insert(schema.progress).values(data).returning().all();
  return result[0];
}

// ===================== 대화 기록 함수 =====================

export function getConversations(studentId: string, limit = 50) {
  return db.select().from(schema.conversations)
    .where(eq(schema.conversations.studentId, studentId))
    .orderBy(desc(schema.conversations.createdAt))
    .limit(limit)
    .all();
}

export function addConversation(data: schema.NewConversation) {
  const result = db.insert(schema.conversations).values(data).returning().all();
  return result[0];
}

// ===================== 강좌 관련 함수 =====================

export function searchCourses(options: {
  query?: string;
  subject?: string;
  teacher?: string;
  limit?: number;
}) {
  const { query, subject, teacher, limit = 20 } = options;

  let whereClause = '1=1';
  const params: string[] = [];

  if (teacher) {
    whereClause += ' AND teacher LIKE ?';
    params.push(`%${teacher}%`);
  }

  if (subject) {
    whereClause += ' AND subject = ?';
    params.push(subject);
  }

  if (query && !teacher) {
    whereClause += ' AND (name LIKE ? OR teacher LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }

  const stmt = sqlite.prepare(`
    SELECT * FROM courses
    WHERE ${whereClause}
    ORDER BY teacher, name
    LIMIT ?
  `);

  return stmt.all(...params, limit) as schema.Course[];
}

export function getCourse(id: string) {
  const result = db.select().from(schema.courses).where(eq(schema.courses.id, id)).limit(1).all();
  return result[0] || null;
}

export function getCoursesByTeacher(teacher: string) {
  return db.select().from(schema.courses)
    .where(sql`teacher LIKE ${'%' + teacher + '%'}`)
    .all();
}

export function getAllCourses() {
  return db.select().from(schema.courses).all();
}

export function getCoursesCount() {
  const result = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(schema.courses).all();
  return result[0]?.count || 0;
}

// 미완강 강좌 목록 (업데이트 대상)
export function getIncompleteCourses() {
  const stmt = sqlite.prepare(`
    SELECT * FROM courses
    WHERE is_completed = 0 OR is_completed IS NULL
    ORDER BY updated_at ASC
  `);
  return stmt.all() as schema.Course[];
}

// 강좌 커리큘럼 업데이트
export function updateCourseCurriculum(
  id: string,
  data: {
    lectures: string;
    lectureCount: number;
    totalDuration?: string;
    isCompleted: boolean;
  }
) {
  const stmt = sqlite.prepare(`
    UPDATE courses
    SET lectures = ?,
        lecture_count = ?,
        total_duration = ?,
        is_completed = ?,
        last_crawled_at = unixepoch(),
        updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(
    data.lectures,
    data.lectureCount,
    data.totalDuration || null,
    data.isCompleted ? 1 : 0,
    id
  );
  return getCourse(id);
}

// 강좌 생성 또는 업데이트 (upsert)
export function upsertCourse(data: {
  id: string;
  name: string;
  teacher: string;
  subject?: string;
  platform?: string;
  url?: string;
  lectures?: string;
  lectureCount?: number;
  totalDuration?: string;
  category?: string;
  year?: number;
  isCompleted?: boolean;
}) {
  const existing = getCourse(data.id);

  if (existing) {
    const stmt = sqlite.prepare(`
      UPDATE courses
      SET name = ?,
          teacher = ?,
          subject = COALESCE(?, subject),
          platform = COALESCE(?, platform),
          url = COALESCE(?, url),
          lectures = COALESCE(?, lectures),
          lecture_count = COALESCE(?, lecture_count),
          total_duration = COALESCE(?, total_duration),
          category = COALESCE(?, category),
          year = COALESCE(?, year),
          is_completed = COALESCE(?, is_completed),
          updated_at = unixepoch()
      WHERE id = ?
    `);
    stmt.run(
      data.name,
      data.teacher,
      data.subject || null,
      data.platform || null,
      data.url || null,
      data.lectures || null,
      data.lectureCount ?? null,
      data.totalDuration || null,
      data.category || null,
      data.year ?? null,
      data.isCompleted !== undefined ? (data.isCompleted ? 1 : 0) : null,
      data.id
    );
  } else {
    const stmt = sqlite.prepare(`
      INSERT INTO courses (id, name, teacher, subject, platform, url, lectures, lecture_count, total_duration, category, year, is_completed, last_crawled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `);
    stmt.run(
      data.id,
      data.name,
      data.teacher,
      data.subject || null,
      data.platform || 'megastudy',
      data.url || null,
      data.lectures || null,
      data.lectureCount ?? 0,
      data.totalDuration || null,
      data.category || null,
      data.year ?? null,
      data.isCompleted ? 1 : 0
    );
  }

  return getCourse(data.id);
}

// 강사 정보 업데이트 (해당 강사의 모든 강좌 업데이트)
export function updateTeacherInfo(
  oldName: string,
  newData: {
    name?: string;
    subject?: string;
    platform?: string;
  }
) {
  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (newData.name && newData.name !== oldName) {
    updates.push('teacher = ?');
    params.push(newData.name);
  }
  if (newData.subject !== undefined) {
    updates.push('subject = ?');
    params.push(newData.subject || null);
  }
  if (newData.platform) {
    updates.push('platform = ?');
    params.push(newData.platform);
  }

  if (updates.length === 0) {
    return getCoursesByTeacher(oldName);
  }

  updates.push('updated_at = unixepoch()');
  params.push(oldName);

  const stmt = sqlite.prepare(`
    UPDATE courses
    SET ${updates.join(', ')}
    WHERE teacher = ?
  `);
  stmt.run(...params);

  // 업데이트된 강좌 반환
  const teacherName = newData.name || oldName;
  return getCoursesByTeacher(teacherName);
}

// 강좌 메타데이터 수정 (크롤링 없이)
export function updateCourseMetadata(
  id: string,
  data: {
    name?: string;
    teacher?: string;
    subject?: string;
    platform?: string;
    isCompleted?: boolean;
  }
) {
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.teacher !== undefined) {
    updates.push('teacher = ?');
    params.push(data.teacher);
  }
  if (data.subject !== undefined) {
    updates.push('subject = ?');
    params.push(data.subject || null);
  }
  if (data.platform !== undefined) {
    updates.push('platform = ?');
    params.push(data.platform);
  }
  if (data.isCompleted !== undefined) {
    updates.push('is_completed = ?');
    params.push(data.isCompleted ? 1 : 0);
  }

  if (updates.length === 0) {
    return getCourse(id);
  }

  updates.push('updated_at = unixepoch()');
  params.push(id);

  const stmt = sqlite.prepare(`
    UPDATE courses
    SET ${updates.join(', ')}
    WHERE id = ?
  `);
  stmt.run(...params);

  return getCourse(id);
}

// ===================== 통계 함수 =====================

export function getStudentStats(studentId: string) {
  // 총 학습 시간
  const totalMinutesResult = db.select({
    total: sql<number>`COALESCE(SUM(${schema.progress.studyMinutes}), 0)`,
  }).from(schema.progress).where(eq(schema.progress.studentId, studentId)).all();

  // 완료된 퀘스트 수
  const completedQuestsResult = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(schema.quests).where(and(
    eq(schema.quests.studentId, studentId),
    eq(schema.quests.status, 'completed')
  )).all();

  // 현재 스트릭
  const streakResult = db.select({
    streak: schema.progress.streak,
  }).from(schema.progress)
    .where(eq(schema.progress.studentId, studentId))
    .orderBy(desc(schema.progress.date))
    .limit(1)
    .all();

  // 활성 플랜 수
  const activePlansResult = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(schema.plans).where(and(
    eq(schema.plans.studentId, studentId),
    eq(schema.plans.status, 'active')
  )).all();

  return {
    totalStudyMinutes: totalMinutesResult[0]?.total || 0,
    completedQuests: completedQuestsResult[0]?.count || 0,
    currentStreak: streakResult[0]?.streak || 0,
    activePlans: activePlansResult[0]?.count || 0,
  };
}

// ===================== 초기화 =====================

export function initializeDatabase() {
  createTables();
  console.log('[DB] Database initialized at:', DB_PATH);
}

// 자동 초기화
initializeDatabase();

// Re-export schema
export * from './schema.js';
