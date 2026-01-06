/**
 * Database Schema
 * SQLite + Drizzle ORM
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ===================== 사용자 테이블 (인증) =====================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  studentId: text('student_id').references(() => students.id),  // 연결된 학생 프로필
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

// ===================== 학생 테이블 =====================

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  grade: text('grade'),  // 예: '고1', '중3'
  subjects: text('subjects'),  // JSON 배열 문자열
  goals: text('goals'),  // JSON 배열 문자열
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ===================== 학습 계획 테이블 =====================

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  studentId: text('student_id').references(() => students.id),
  name: text('name').notNull(),
  materialName: text('material_name'),  // 교재명
  subject: text('subject'),  // MATH, KOREAN, ENGLISH 등
  totalDays: integer('total_days').notNull(),
  totalUnits: integer('total_units'),
  estimatedHours: real('estimated_hours'),
  status: text('status').default('active'),  // active, completed, paused
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ===================== 퀘스트 테이블 =====================

export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id),
  studentId: text('student_id').references(() => students.id),
  day: integer('day').notNull(),  // 플랜 내 일차
  date: text('date'),  // YYYY-MM-DD 형식
  title: text('title').notNull(),
  description: text('description'),
  units: text('units'),  // JSON 배열 문자열 (학습 단원 목록)
  estimatedMinutes: integer('estimated_minutes'),
  actualMinutes: integer('actual_minutes'),
  status: text('status').default('pending'),  // pending, in_progress, completed, skipped
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ===================== 태스크 테이블 (퀘스트 하위) =====================

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  questId: text('quest_id').references(() => quests.id),
  title: text('title').notNull(),
  type: text('type'),  // study, review, exercise, test
  estimatedMinutes: integer('estimated_minutes'),
  completed: integer('completed', { mode: 'boolean' }).default(false),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  order: integer('order').default(0),
});

// ===================== 학습 진도 테이블 =====================

export const progress = sqliteTable('progress', {
  id: text('id').primaryKey(),
  studentId: text('student_id').references(() => students.id),
  planId: text('plan_id').references(() => plans.id),
  date: text('date').notNull(),  // YYYY-MM-DD
  studyMinutes: integer('study_minutes').default(0),
  questsCompleted: integer('quests_completed').default(0),
  tasksCompleted: integer('tasks_completed').default(0),
  streak: integer('streak').default(0),  // 연속 학습 일수
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ===================== 대화 기록 테이블 =====================

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  studentId: text('student_id').references(() => students.id),
  role: text('role').notNull(),  // user, assistant
  agentRole: text('agent_role'),  // COACH, ANALYST, PLANNER, ADMISSION
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ===================== 타입 내보내기 =====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Quest = typeof quests.$inferSelect;
export type NewQuest = typeof quests.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Progress = typeof progress.$inferSelect;
export type NewProgress = typeof progress.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
