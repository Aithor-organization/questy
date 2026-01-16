/**
 * Inquiry Queries
 * 문의 CRUD 함수
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../connection.js';
import * as schema from '../schema.js';

// 모든 문의 조회 (관리자용)
export function getAllInquiries() {
  return db.select().from(schema.inquiries).orderBy(desc(schema.inquiries.createdAt)).all();
}

// 특정 문의 조회
export function getInquiry(id: string) {
  const result = db.select().from(schema.inquiries).where(eq(schema.inquiries.id, id)).limit(1).all();
  return result[0] || null;
}

// 사용자별 문의 조회
export function getUserInquiries(userId: string) {
  return db.select()
    .from(schema.inquiries)
    .where(eq(schema.inquiries.userId, userId))
    .orderBy(desc(schema.inquiries.createdAt))
    .all();
}

// 문의 생성
export function createInquiry(data: schema.NewInquiry) {
  const result = db.insert(schema.inquiries).values(data).returning().all();
  return result[0];
}

// 문의 상태 업데이트 (관리자용)
export function updateInquiryStatus(
  id: string,
  status: string,
  adminNote?: string
) {
  const updateData: Partial<schema.NewInquiry> & { resolvedAt?: Date; updatedAt: Date } = {
    status,
    updatedAt: new Date(),
  };

  if (adminNote !== undefined) {
    updateData.adminNote = adminNote;
  }

  if (status === 'resolved' || status === 'closed') {
    updateData.resolvedAt = new Date();
  }

  const result = db.update(schema.inquiries)
    .set(updateData)
    .where(eq(schema.inquiries.id, id))
    .returning()
    .all();

  return result[0];
}

// 문의 삭제
export function deleteInquiry(id: string) {
  return db.delete(schema.inquiries).where(eq(schema.inquiries.id, id)).run();
}
