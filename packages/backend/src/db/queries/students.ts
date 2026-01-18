/**
 * Student Queries
 * 학생 CRUD 함수
 * - Bun: SQLite (Drizzle ORM)
 * - Node.js: Supabase
 */

import { eq } from 'drizzle-orm';
import { db, useSupabase } from '../connection.js';
import { supabase } from '../supabase.js';
import * as schema from '../schema.js';

export function getStudent(id: string) {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    // Supabase는 async이지만, 기존 API 호환을 위해 null 반환
    // 실제로는 chat.ts에서 async로 처리하거나, 인메모리 캐시 사용
    console.log('[DB/Students] Supabase mode - returning null (use getStudentAsync)');
    return null;
  }

  // SQLite 사용 (Bun)
  if (!db) {
    console.warn('[DB/Students] No database available');
    return null;
  }

  const result = db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1).all();
  return result[0] || null;
}

// Supabase용 async 버전
export async function getStudentAsync(id: string): Promise<schema.Student | null> {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('[DB/Students] Supabase getStudent error:', error.message);
    }
    return data || null;
  }

  // SQLite 사용 (Bun)
  return getStudent(id);
}

export function createStudent(data: schema.NewStudent) {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    console.log('[DB/Students] Supabase mode - returning mock (use createStudentAsync)');
    // 임시로 입력값 반환
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as schema.Student;
  }

  // SQLite 사용 (Bun)
  if (!db) {
    console.warn('[DB/Students] No database available');
    return { ...data, createdAt: new Date(), updatedAt: new Date() } as schema.Student;
  }

  const result = db.insert(schema.students).values(data).returning().all();
  return result[0];
}

// Supabase용 async 버전
export async function createStudentAsync(data: schema.NewStudent): Promise<schema.Student> {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    const { data: result, error } = await supabase
      .from('students')
      .insert({
        id: data.id,
        name: data.name,
        grade: data.grade || null,
        subjects: data.subjects || null,
        goals: data.goals || null,
      })
      .select()
      .single();

    if (error) {
      console.warn('[DB/Students] Supabase createStudent error:', error.message);
      // 에러 시에도 입력값 반환 (인메모리 처리용)
      return { ...data, createdAt: new Date(), updatedAt: new Date() } as schema.Student;
    }
    return result as schema.Student;
  }

  // SQLite 사용 (Bun)
  return createStudent(data);
}

export function updateStudent(id: string, data: Partial<schema.NewStudent>) {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    console.log('[DB/Students] Supabase mode - returning null (use updateStudentAsync)');
    return null;
  }

  // SQLite 사용 (Bun)
  if (!db) {
    console.warn('[DB/Students] No database available');
    return null;
  }

  const result = db.update(schema.students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.students.id, id))
    .returning()
    .all();
  return result[0];
}

// Supabase용 async 버전
export async function updateStudentAsync(id: string, data: Partial<schema.NewStudent>): Promise<schema.Student | null> {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    const { data: result, error } = await supabase
      .from('students')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn('[DB/Students] Supabase updateStudent error:', error.message);
      return null;
    }
    return result as schema.Student;
  }

  // SQLite 사용 (Bun)
  return updateStudent(id, data);
}
