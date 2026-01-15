/**
 * Quest Queries
 * 퀘스트 CRUD 함수
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
