/**
 * Chat API Service
 * Supabase chat_rooms, chat_messages 테이블과 직접 연동
 * user_storage 대신 정규화된 테이블 사용
 */

import { supabase } from './supabase';

// 타입 정의
export interface DbChatRoom {
  id: string;
  student_id: string;
  name: string;
  emoji: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  room_id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_role: string | null;
  is_read: boolean;
  reschedule_options: unknown[];
  actions: unknown[];
  created_at: string;
}

// 사용자의 student_id 캐시 (세션 내 중복 호출 방지)
let cachedStudentId: string | null = null;
let studentIdPromise: Promise<string | null> | null = null;
let lastSessionCheck: number = 0;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5분마다 세션 재확인

// 탭이 다시 활성화될 때 세션 재확인을 위한 플래그
let needsSessionRevalidation = false;

// visibility change 이벤트 핸들러 등록 (한 번만)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // 탭이 다시 활성화되면 세션 재확인 필요 표시
      needsSessionRevalidation = true;
      console.log('[ChatAPI] 탭 활성화 - 다음 API 호출 시 세션 재확인');
    }
  });
}

// 사용자의 student_id 가져오기 (캐싱, 자동 생성)
async function getStudentId(): Promise<string | null> {
  if (!supabase) return null;

  const now = Date.now();
  const shouldRevalidate = needsSessionRevalidation || (now - lastSessionCheck > SESSION_CHECK_INTERVAL);

  // 캐시가 있지만 세션 재확인이 필요한 경우
  if (cachedStudentId && shouldRevalidate) {
    console.log('[ChatAPI] 세션 재확인 중...');
    needsSessionRevalidation = false;
    lastSessionCheck = now;

    // 세션 유효성 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[ChatAPI] 세션 만료됨 - 캐시 초기화');
      cachedStudentId = null;
      return null;
    }
  }

  // 이미 캐시된 값이 있으면 반환
  if (cachedStudentId) return cachedStudentId;

  // 이미 조회 중이면 같은 Promise 반환 (중복 요청 방지)
  if (studentIdPromise) return studentIdPromise;

  studentIdPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[ChatAPI] 로그인된 사용자 없음');
        return null;
      }

      // students 테이블에서 user_id로 student_id 조회
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (student?.id) {
        cachedStudentId = student.id;
        lastSessionCheck = Date.now();
        console.log('[ChatAPI] student 조회 성공:', student.id);
        return student.id;
      }

      // student 레코드가 없으면 자동 생성 (기존 사용자 지원)
      console.log('[ChatAPI] student 레코드 없음, 자동 생성 중...');
      const userName = user.user_metadata?.name || user.email?.split('@')[0] || '학생';

      const { data: newStudent, error: createError } = await supabase
        .from('students')
        .insert({ user_id: user.id, name: userName })
        .select('id')
        .single();

      if (createError) {
        console.error('[ChatAPI] student 자동 생성 실패:', createError.message);
        return null;
      }

      cachedStudentId = newStudent.id;
      lastSessionCheck = Date.now();
      console.log('[ChatAPI] student 자동 생성 완료:', newStudent.id);
      return newStudent.id;
    } catch (error: any) {
      // AbortError는 React StrictMode 또는 빠른 언마운트로 인한 정상적인 취소
      if (error?.name === 'AbortError') {
        console.log('[ChatAPI] getStudentId cancelled');
        return null;
      }
      console.error('[ChatAPI] getStudentId 에러:', error);
      return null;
    } finally {
      studentIdPromise = null;
    }
  })();

  return studentIdPromise;
}

// 캐시 초기화 (로그아웃 시 호출)
export function clearStudentIdCache(): void {
  cachedStudentId = null;
  studentIdPromise = null;
  lastSessionCheck = 0;
  needsSessionRevalidation = false;
}

/**
 * 모든 채팅방 조회
 */
export async function fetchChatRooms(): Promise<DbChatRoom[]> {
  if (!supabase) {
    console.log('[ChatAPI] Supabase 미설정');
    return [];
  }

  const studentId = await getStudentId();
  if (!studentId) {
    console.log('[ChatAPI] studentId 없음');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatAPI] fetchChatRooms 실패:', error.message);
      return [];
    }

    console.log(`[ChatAPI] 채팅방 ${data?.length || 0}개 조회됨`);
    return data || [];
  } catch (error) {
    console.error('[ChatAPI] fetchChatRooms 에러:', error);
    return [];
  }
}

/**
 * 기본 채팅방 조회 또는 생성
 */
export async function getOrCreateDefaultRoom(): Promise<DbChatRoom | null> {
  if (!supabase) return null;

  const studentId = await getStudentId();
  if (!studentId) return null;

  try {
    // 기본 채팅방 조회
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_default', true)
      .single();

    if (existingRoom) {
      console.log('[ChatAPI] 기본 채팅방 조회됨:', existingRoom.id);
      return existingRoom;
    }

    // 없으면 생성
    console.log('[ChatAPI] 기본 채팅방 생성 중...');
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({
        student_id: studentId,
        name: 'AI 학습 코치',
        emoji: '🤖',
        description: '언제든 물어보세요!',
        is_default: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('[ChatAPI] 기본 채팅방 생성 실패:', createError.message);
      return null;
    }

    console.log('[ChatAPI] 기본 채팅방 생성됨:', newRoom.id);
    return newRoom;
  } catch (error) {
    console.error('[ChatAPI] getOrCreateDefaultRoom 에러:', error);
    return null;
  }
}

/**
 * 채팅방 생성
 */
export async function createChatRoom(
  name: string,
  emoji: string,
  description?: string
): Promise<DbChatRoom | null> {
  if (!supabase) return null;

  const studentId = await getStudentId();
  if (!studentId) return null;

  try {
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert({
        student_id: studentId,
        name,
        emoji,
        description: description || null,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[ChatAPI] createChatRoom 실패:', error.message);
      return null;
    }

    console.log('[ChatAPI] 채팅방 생성됨:', data.id);
    return data;
  } catch (error) {
    console.error('[ChatAPI] createChatRoom 에러:', error);
    return null;
  }
}

/**
 * 채팅방 삭제
 */
export async function deleteChatRoom(roomId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('chat_rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error('[ChatAPI] deleteChatRoom 실패:', error.message);
      return false;
    }

    console.log('[ChatAPI] 채팅방 삭제됨:', roomId);
    return true;
  } catch (error) {
    console.error('[ChatAPI] deleteChatRoom 에러:', error);
    return false;
  }
}

/**
 * 채팅방의 메시지 조회
 */
export async function fetchMessages(roomId: string): Promise<DbChatMessage[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatAPI] fetchMessages 실패:', error.message);
      return [];
    }

    console.log(`[ChatAPI] 메시지 ${data?.length || 0}개 조회됨 (room: ${roomId})`);
    return data || [];
  } catch (error) {
    console.error('[ChatAPI] fetchMessages 에러:', error);
    return [];
  }
}

/**
 * 메시지 추가
 */
export async function addMessage(
  roomId: string,
  role: 'user' | 'assistant',
  content: string,
  agentRole?: string,
  rescheduleOptions?: unknown[],
  actions?: unknown[]
): Promise<DbChatMessage | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        role,
        content,
        agent_role: agentRole || null,
        is_read: role === 'user', // user 메시지는 자동 읽음 처리
        reschedule_options: rescheduleOptions || [],
        actions: actions || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[ChatAPI] addMessage 실패:', error.message);
      return null;
    }

    console.log(`[ChatAPI] 메시지 추가됨: ${data.id} (${role})`);
    return data;
  } catch (error) {
    console.error('[ChatAPI] addMessage 에러:', error);
    return null;
  }
}

/**
 * 메시지 읽음 처리
 */
export async function markMessagesAsRead(roomId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .eq('is_read', false);

    if (error) {
      console.error('[ChatAPI] markMessagesAsRead 실패:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[ChatAPI] markMessagesAsRead 에러:', error);
    return false;
  }
}

/**
 * 채팅방의 모든 메시지 삭제
 */
export async function clearRoomMessages(roomId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('room_id', roomId);

    if (error) {
      console.error('[ChatAPI] clearRoomMessages 실패:', error.message);
      return false;
    }

    console.log('[ChatAPI] 채팅방 메시지 삭제됨:', roomId);
    return true;
  } catch (error) {
    console.error('[ChatAPI] clearRoomMessages 에러:', error);
    return false;
  }
}

/**
 * 읽지 않은 메시지 개수 조회
 */
export async function getUnreadCount(roomId?: string): Promise<number> {
  if (!supabase) return 0;

  const studentId = await getStudentId();
  if (!studentId) return 0;

  try {
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('role', 'assistant');

    if (roomId) {
      query = query.eq('room_id', roomId);
    } else {
      // 모든 채팅방의 읽지 않은 메시지
      const rooms = await fetchChatRooms();
      const roomIds = rooms.map(r => r.id);
      if (roomIds.length === 0) return 0;
      query = query.in('room_id', roomIds);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[ChatAPI] getUnreadCount 실패:', error.message);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[ChatAPI] getUnreadCount 에러:', error);
    return 0;
  }
}
