/**
 * Student Queries
 * 학생 CRUD 함수
 */

import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
