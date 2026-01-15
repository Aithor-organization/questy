/**
 * Task Queries
 * 태스크 CRUD 함수
 */

import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
