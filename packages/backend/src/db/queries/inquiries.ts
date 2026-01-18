/**
 * Inquiry Queries
 * 문의 CRUD 함수
 *
 * SQLite (Bun) 및 Supabase (Node.js) 환경 모두 지원
 */

import { eq, desc } from 'drizzle-orm';
import { db, useSupabase } from '../connection.js';
import { supabase } from '../supabase.js';
import * as schema from '../schema.js';

// Supabase 테이블 이름
const TABLE_NAME = 'inquiries';

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

// ============================================
// Supabase 비동기 버전 (Node.js/Railway 환경용)
// ============================================

// Supabase 응답을 JS 객체로 변환
function mapInquiry(row: any): schema.Inquiry {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  };
}

// 모든 문의 조회 (관리자용) - Supabase 버전
export async function getAllInquiriesAsync(): Promise<schema.Inquiry[]> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Inquiries] getAllInquiriesAsync error:', error);
    throw error;
  }

  return (data || []).map(mapInquiry);
}

// 특정 문의 조회 - Supabase 버전
export async function getInquiryAsync(id: string): Promise<schema.Inquiry | null> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[Inquiries] getInquiryAsync error:', error);
    throw error;
  }

  return data ? mapInquiry(data) : null;
}

// 사용자별 문의 조회 - Supabase 버전
export async function getUserInquiriesAsync(userId: string): Promise<schema.Inquiry[]> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Inquiries] getUserInquiriesAsync error:', error);
    throw error;
  }

  return (data || []).map(mapInquiry);
}

// 문의 생성 - Supabase 버전
export async function createInquiryAsync(data: schema.NewInquiry): Promise<schema.Inquiry> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const insertData = {
    id: data.id,
    user_id: data.userId,
    title: data.title,
    content: data.content,
    status: data.status || 'pending',
    admin_note: data.adminNote || null,
  };

  const { data: result, error } = await supabase
    .from(TABLE_NAME)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[Inquiries] createInquiryAsync error:', error);
    throw error;
  }

  return mapInquiry(result);
}

// 문의 상태 업데이트 - Supabase 버전
export async function updateInquiryStatusAsync(
  id: string,
  status: string,
  adminNote?: string
): Promise<schema.Inquiry | null> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminNote !== undefined) {
    updateData.admin_note = adminNote;
  }

  if (status === 'resolved' || status === 'closed') {
    updateData.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updateData)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[Inquiries] updateInquiryStatusAsync error:', error);
    throw error;
  }

  return data ? mapInquiry(data) : null;
}

// 문의 삭제 - Supabase 버전
export async function deleteInquiryAsync(id: string): Promise<void> {
  if (!useSupabase || !supabase) {
    throw new Error('Supabase not available');
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Inquiries] deleteInquiryAsync error:', error);
    throw error;
  }
}
