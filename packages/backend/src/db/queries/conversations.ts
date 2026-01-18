/**
 * Conversation Queries
 * 대화 기록 함수
 * - Bun: SQLite (Drizzle ORM)
 * - Node.js: Supabase
 */

import { eq, desc } from 'drizzle-orm';
import { db, useSupabase } from '../connection.js';
import { supabase } from '../supabase.js';
import * as schema from '../schema.js';

export function getConversations(studentId: string, limit = 50) {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    console.log('[DB/Conversations] Supabase mode - returning empty (use getConversationsAsync)');
    return [];
  }

  // SQLite 사용 (Bun)
  if (!db) {
    console.warn('[DB/Conversations] No database available');
    return [];
  }

  return db.select().from(schema.conversations)
    .where(eq(schema.conversations.studentId, studentId))
    .orderBy(desc(schema.conversations.createdAt))
    .limit(limit)
    .all();
}

// Supabase용 async 버전
export async function getConversationsAsync(studentId: string, limit = 50): Promise<schema.Conversation[]> {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[DB/Conversations] Supabase getConversations error:', error.message);
      return [];
    }

    // Supabase 컬럼명 -> JS 프로퍼티명 변환
    return (data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      role: row.role,
      agentRole: row.agent_role,
      content: row.content,
      createdAt: new Date(row.created_at),
    })) as schema.Conversation[];
  }

  // SQLite 사용 (Bun)
  return getConversations(studentId, limit);
}

export function addConversation(data: schema.NewConversation) {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    // 비동기 저장을 백그라운드에서 수행
    addConversationAsync(data).catch(err => {
      console.warn('[DB/Conversations] Background save failed:', err);
    });
    // 즉시 반환 (백그라운드 저장)
    return { ...data, createdAt: new Date() } as schema.Conversation;
  }

  // SQLite 사용 (Bun)
  if (!db) {
    console.warn('[DB/Conversations] No database available');
    return { ...data, createdAt: new Date() } as schema.Conversation;
  }

  const result = db.insert(schema.conversations).values(data).returning().all();
  return result[0];
}

// Supabase용 async 버전
export async function addConversationAsync(data: schema.NewConversation): Promise<schema.Conversation> {
  // Supabase 사용 (Node.js/Railway)
  if (useSupabase && supabase) {
    const { data: result, error } = await supabase
      .from('conversations')
      .insert({
        id: data.id,
        student_id: data.studentId,
        role: data.role,
        agent_role: data.agentRole || null,
        content: data.content,
      })
      .select()
      .single();

    if (error) {
      console.warn('[DB/Conversations] Supabase addConversation error:', error.message);
      // 에러 시에도 입력값 반환
      return { ...data, createdAt: new Date() } as schema.Conversation;
    }

    return {
      id: result.id,
      studentId: result.student_id,
      role: result.role,
      agentRole: result.agent_role,
      content: result.content,
      createdAt: new Date(result.created_at),
    } as schema.Conversation;
  }

  // SQLite 사용 (Bun)
  return addConversation(data);
}
