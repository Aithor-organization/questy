/**
 * Stats Queries
 * 통계 조회 함수
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
