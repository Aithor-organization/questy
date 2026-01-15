/**
 * Progress Queries
 * 진도 관리 함수
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
