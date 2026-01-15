/**
 * Plan Queries
 * 학습 플랜 CRUD 함수
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
