/**
 * Conversation Queries
 * 대화 기록 함수
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

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
