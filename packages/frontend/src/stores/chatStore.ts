/**
 * Chat Store
 * Supabase chat_rooms, chat_messages 테이블과 직접 연동
 * - 정규화된 테이블 구조 사용
 * - 새로고침 후에도 데이터 유지
 */

import { create } from 'zustand';
import * as chatApi from '../lib/chat-api';
import { clearStudentIdCache } from '../lib/chat-api';
import type { DbChatRoom, DbChatMessage } from '../lib/chat-api';

// 일정 재조정 옵션
export interface RescheduleOption {
  id: string;
  planName: string;
  description: string;
  impactSummary: string;
  strategy: 'COMPRESS' | 'EXTEND' | 'SKIP' | 'REDUCE_LOAD';
  isRecommended: boolean;
  feasibility: 'HIGH' | 'MEDIUM' | 'LOW';
  warningMessage?: string;
}

// 메시지 액션 버튼
export interface MessageAction {
  id: string;
  type: 'POSTPONE_TODAY' | 'RESCHEDULE_QUEST' | 'NAVIGATE' | 'CUSTOM' | 'SMART_RESCHEDULE' | 'GENERATE_CURRICULUM' | 'COMPLETE_QUEST' | 'DELETE_PLAN';
  label: string;
  icon?: string;
  data?: {
    daysToAdd?: number;
    planId?: string;
    questId?: string;
    newDate?: string;
    navigateTo?: string;
    customHandler?: string;
    targetDate?: string;
    strategy?: 'smart' | 'spread' | 'front_load' | 'back_load' | 'priority_first';
    materialName?: string;
    targetDays?: number;
    dailyStudyHours?: number;
    units?: Array<{ unitNumber: number; unitTitle: string; estimatedMinutes?: number }>;
    completed?: boolean;
  };
}

// 메시지 인터페이스 (프론트엔드용)
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  agentRole?: string;
  isRead: boolean;
  rescheduleOptions?: RescheduleOption[];
  actions?: MessageAction[];
}

// 채팅방 인터페이스 (프론트엔드용)
export interface ChatRoom {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  createdAt: string;
  messages: ChatMessage[];
  isDefault?: boolean;
}

// 알림 인터페이스
export interface ChatNotification {
  id: string;
  roomId: string;
  type: 'message' | 'delay' | 'reminder' | 'achievement';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  data?: Record<string, unknown>;
}

// 대기 중인 응답 (백그라운드 처리용)
export interface PendingResponse {
  roomId: string;
  userMessageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: string;
}

interface ChatStore {
  // 상태
  rooms: ChatRoom[];
  notifications: ChatNotification[];
  pendingResponses: PendingResponse[];
  isLoading: boolean;
  isInitialized: boolean;
  loadedRoomIds: Set<string>; // 메시지가 로드된 채팅방 ID들

  // 초기화
  initializeChat: () => Promise<void>;
  resetChat: () => void;

  // 채팅방 액션
  createRoom: (name: string, emoji: string, description?: string) => Promise<string | null>;
  deleteRoom: (roomId: string) => Promise<void>;
  getRoomById: (roomId: string) => ChatRoom | undefined;
  getDefaultRoom: () => ChatRoom | undefined;
  loadRoomMessages: (roomId: string) => Promise<void>; // 지연 로딩

  // 메시지 액션
  addMessage: (roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => Promise<string | null>;
  markRoomAsRead: (roomId: string) => Promise<void>;
  clearRoomMessages: (roomId: string) => Promise<void>;

  // 백그라운드 응답 액션
  addPendingResponse: (roomId: string, userMessageId: string) => void;
  updatePendingResponse: (userMessageId: string, status: PendingResponse['status']) => void;
  removePendingResponse: (userMessageId: string) => void;
  getPendingResponseForRoom: (roomId: string) => PendingResponse | undefined;

  // 알림 액션
  addNotification: (notification: Omit<ChatNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;

  // 카운트
  getUnreadCountForRoom: (roomId: string) => number;
  getTotalUnreadCount: () => number;
  getUnreadNotificationCount: () => number;
}

// DB 메시지 → 프론트엔드 메시지 변환
function dbMessageToFrontend(dbMsg: DbChatMessage): ChatMessage {
  return {
    id: dbMsg.id,
    role: dbMsg.role,
    content: dbMsg.content,
    timestamp: dbMsg.created_at,
    agentRole: dbMsg.agent_role || undefined,
    isRead: dbMsg.is_read,
    rescheduleOptions: dbMsg.reschedule_options as RescheduleOption[] | undefined,
    actions: dbMsg.actions as MessageAction[] | undefined,
  };
}

// DB 채팅방 → 프론트엔드 채팅방 변환
function dbRoomToFrontend(dbRoom: DbChatRoom, messages: ChatMessage[]): ChatRoom {
  return {
    id: dbRoom.id,
    name: dbRoom.name,
    emoji: dbRoom.emoji,
    description: dbRoom.description || undefined,
    createdAt: dbRoom.created_at,
    messages,
    isDefault: dbRoom.is_default,
  };
}

// 기본 채팅방 ID (로컬 폴백용)
export const DEFAULT_ROOM_ID = 'ai-coach-default';

// localStorage 캐시 키 접두사
const CACHE_PREFIX = 'chat_messages_';
const ROOMS_CACHE_KEY = 'chat_rooms_list';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

// 캐시용 채팅방 인터페이스 (마지막 메시지 포함)
interface CachedChatRoom {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  createdAt: string;
  isDefault?: boolean;
  lastMessage?: {
    content: string;
    timestamp: string;
    role: 'user' | 'assistant';
  };
}

// 채팅방 목록 캐시 조회
function getCachedRooms(): CachedChatRoom[] | null {
  try {
    const cached = localStorage.getItem(ROOMS_CACHE_KEY);
    if (!cached) return null;

    const { rooms, cachedAt } = JSON.parse(cached);
    // TTL 체크
    if (Date.now() - cachedAt > CACHE_TTL) {
      localStorage.removeItem(ROOMS_CACHE_KEY);
      return null;
    }
    return rooms;
  } catch {
    return null;
  }
}

// 채팅방 목록 캐시 저장
function setCachedRooms(rooms: ChatRoom[]): void {
  try {
    const toCache: CachedChatRoom[] = rooms.map((room) => {
      const lastMsg = room.messages[room.messages.length - 1];
      return {
        id: room.id,
        name: room.name,
        emoji: room.emoji,
        description: room.description,
        createdAt: room.createdAt,
        isDefault: room.isDefault,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              timestamp: lastMsg.timestamp,
              role: lastMsg.role,
            }
          : undefined,
      };
    });
    localStorage.setItem(
      ROOMS_CACHE_KEY,
      JSON.stringify({ rooms: toCache, cachedAt: Date.now() })
    );
  } catch (e) {
    console.warn('[ChatStore] 채팅방 캐시 저장 실패:', e);
  }
}

// 채팅방 캐시 삭제
function clearRoomsCache(): void {
  try {
    localStorage.removeItem(ROOMS_CACHE_KEY);
  } catch {
    // 무시
  }
}

// localStorage 메시지 캐시 헬퍼 함수
function getCachedMessages(roomId: string): ChatMessage[] | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${roomId}`);
    if (!cached) return null;

    const { messages, cachedAt } = JSON.parse(cached);
    // TTL 체크 (24시간 이상 된 캐시는 무효)
    if (Date.now() - cachedAt > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_PREFIX}${roomId}`);
      return null;
    }
    return messages;
  } catch {
    return null;
  }
}

function setCachedMessages(roomId: string, messages: ChatMessage[]): void {
  try {
    // 최근 100개 메시지만 캐시
    const toCache = messages.slice(-100);
    localStorage.setItem(
      `${CACHE_PREFIX}${roomId}`,
      JSON.stringify({ messages: toCache, cachedAt: Date.now() })
    );
  } catch (e) {
    // localStorage 용량 초과 등 에러 시 무시
    console.warn('[ChatStore] 캐시 저장 실패:', e);
  }
}

function clearMessageCache(roomId?: string): void {
  try {
    if (roomId) {
      localStorage.removeItem(`${CACHE_PREFIX}${roomId}`);
    } else {
      // 모든 채팅 캐시 삭제
      Object.keys(localStorage)
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    }
  } catch {
    // 무시
  }
}

// 스토어 초기화 시 캐시에서 동기적으로 로드 (카카오톡처럼 즉시 표시)
function getInitialRoomsFromCache(): { rooms: ChatRoom[]; hasCache: boolean } {
  const cachedRooms = getCachedRooms();
  if (!cachedRooms || cachedRooms.length === 0) {
    return { rooms: [], hasCache: false };
  }

  const roomsFromCache: ChatRoom[] = cachedRooms.map((cached) => ({
    id: cached.id,
    name: cached.name,
    emoji: cached.emoji,
    description: cached.description,
    createdAt: cached.createdAt,
    isDefault: cached.isDefault,
    messages: cached.lastMessage
      ? [
          {
            id: `cached-${cached.id}`,
            role: cached.lastMessage.role,
            content: cached.lastMessage.content,
            timestamp: cached.lastMessage.timestamp,
            isRead: true,
          },
        ]
      : [],
  }));

  return { rooms: roomsFromCache, hasCache: true };
}

// 스토어 생성 전에 캐시 로드 (동기)
const initialCache = getInitialRoomsFromCache();

export const useChatStore = create<ChatStore>()((set, get) => ({
  // 캐시가 있으면 바로 표시 (카카오톡처럼 즉시 로딩)
  rooms: initialCache.rooms,
  notifications: [],
  pendingResponses: [],
  isLoading: false,
  // 캐시가 있으면 이미 초기화된 것으로 표시 (즉시 렌더링)
  isInitialized: initialCache.hasCache,
  loadedRoomIds: new Set<string>(),

  // Supabase에서 채팅 데이터 로드 (캐시 우선 + 백그라운드 동기화)
  initializeChat: async () => {
    const { isLoading, rooms } = get();
    // 이미 동기화 중이면 중복 호출 방지
    if (isLoading) {
      console.log('[ChatStore] 이미 동기화 진행 중');
      return;
    }

    // 이미 캐시된 데이터가 표시되어 있으면 로딩 표시 없이 백그라운드 동기화만 진행
    // (동기 로드로 이미 채팅방이 있거나, reset 후에는 빈 배열)
    const hasDisplayedRooms = rooms.length > 0;
    if (!hasDisplayedRooms) {
      set({ isLoading: true });
    }
    console.log(`[ChatStore] Supabase 동기화 시작 (표시된 채팅방: ${rooms.length}개)...`);

    // 캐시 데이터 가져오기 (마지막 메시지 정보용)
    const cachedRooms = getCachedRooms();

    // 2. 백그라운드에서 Supabase 최신 데이터 가져오기
    try {
      // 기본 채팅방 가져오기 또는 생성
      const defaultRoom = await chatApi.getOrCreateDefaultRoom();
      if (!defaultRoom) {
        console.log('[ChatStore] 기본 채팅방 생성 실패 (로그인 필요)');
        // 표시된 채팅방이 없으면 로딩 해제
        if (!hasDisplayedRooms) {
          set({ isLoading: false, isInitialized: true });
        }
        return;
      }

      // 모든 채팅방 조회 (메시지 없이 메타데이터만)
      const dbRooms = await chatApi.fetchChatRooms();

      // 채팅방 메타데이터만 저장 (메시지는 빈 배열, 캐시된 마지막 메시지 유지)
      const roomsWithoutMessages: ChatRoom[] = dbRooms.map((dbRoom) => {
        // 캐시에서 마지막 메시지 정보 가져오기
        const cachedRoom = cachedRooms?.find((c) => c.id === dbRoom.id);
        const lastMessage = cachedRoom?.lastMessage;

        return {
          ...dbRoomToFrontend(dbRoom, []),
          // 캐시된 마지막 메시지가 있으면 미리보기용으로 유지
          messages: lastMessage
            ? [
                {
                  id: `cached-${dbRoom.id}`,
                  role: lastMessage.role,
                  content: lastMessage.content,
                  timestamp: lastMessage.timestamp,
                  isRead: true,
                },
              ]
            : [],
        };
      });

      console.log(`[ChatStore] Supabase에서 ${roomsWithoutMessages.length}개 채팅방 동기화 완료`);

      set({
        rooms: roomsWithoutMessages,
        isLoading: false,
        isInitialized: true,
        loadedRoomIds: new Set<string>(),
      });

      // 3. 채팅방 캐시 업데이트 (나중에 메시지 로드 시 다시 업데이트됨)
      setCachedRooms(roomsWithoutMessages);
    } catch (error) {
      console.error('[ChatStore] Supabase 동기화 실패:', error);
      // 표시된 채팅방이 없으면 로딩 해제
      if (!hasDisplayedRooms) {
        set({ isLoading: false, isInitialized: true });
      }
    }
  },

  // 특정 채팅방 메시지 로드 (캐시 우선 + 백그라운드 동기화)
  loadRoomMessages: async (roomId: string) => {
    const { loadedRoomIds } = get();

    // 이미 로드된 경우 스킵
    if (loadedRoomIds.has(roomId)) {
      console.log(`[ChatStore] 채팅방 ${roomId} 메시지 이미 로드됨`);
      return;
    }

    console.log(`[ChatStore] 채팅방 ${roomId} 메시지 로드 중...`);

    // 1. 먼저 localStorage 캐시에서 로드 (즉시 표시)
    const cachedMessages = getCachedMessages(roomId);
    if (cachedMessages && cachedMessages.length > 0) {
      console.log(`[ChatStore] 캐시에서 ${cachedMessages.length}개 메시지 즉시 로드`);
      set((state) => ({
        rooms: state.rooms.map((room) =>
          room.id === roomId ? { ...room, messages: cachedMessages } : room
        ),
      }));
    }

    // 2. Supabase에서 최신 데이터 가져오기 (백그라운드)
    try {
      const dbMessages = await chatApi.fetchMessages(roomId);
      const messages = dbMessages.map(dbMessageToFrontend);

      // 상태 업데이트
      set((state) => {
        const newLoadedIds = new Set(state.loadedRoomIds);
        newLoadedIds.add(roomId);

        return {
          rooms: state.rooms.map((room) =>
            room.id === roomId
              ? { ...room, messages }
              : room
          ),
          loadedRoomIds: newLoadedIds,
        };
      });

      // 3. localStorage 캐시 갱신
      setCachedMessages(roomId, messages);

      // 4. 채팅방 목록 캐시도 갱신 (마지막 메시지 업데이트)
      setCachedRooms(get().rooms);

      console.log(`[ChatStore] 채팅방 ${roomId} 메시지 ${messages.length}개 동기화 완료`);
    } catch (error) {
      // 캐시가 있었으면 캐시로 진행, 없으면 에러
      if (cachedMessages && cachedMessages.length > 0) {
        console.warn(`[ChatStore] Supabase 동기화 실패, 캐시 데이터 사용:`, error);
        set((state) => {
          const newLoadedIds = new Set(state.loadedRoomIds);
          newLoadedIds.add(roomId);
          return { loadedRoomIds: newLoadedIds };
        });
      } else {
        console.error(`[ChatStore] 채팅방 ${roomId} 메시지 로드 실패:`, error);
      }
    }
  },

  // 채팅 상태 초기화 (로그아웃 시)
  resetChat: () => {
    clearStudentIdCache(); // studentId 캐시도 초기화
    clearMessageCache(); // 메시지 캐시 초기화
    clearRoomsCache(); // 채팅방 목록 캐시도 초기화
    set({
      rooms: [],
      notifications: [],
      pendingResponses: [],
      isLoading: false,
      isInitialized: false,
      loadedRoomIds: new Set<string>(),
    });
    console.log('[ChatStore] 상태 초기화됨 (모든 캐시 포함)');
  },

  // 채팅방 생성
  createRoom: async (name, emoji, description) => {
    const dbRoom = await chatApi.createChatRoom(name, emoji, description);
    if (!dbRoom) return null;

    const newRoom = dbRoomToFrontend(dbRoom, []);

    set((state) => {
      const updatedRooms = [...state.rooms, newRoom];
      // 캐시 업데이트
      setCachedRooms(updatedRooms);
      return { rooms: updatedRooms };
    });

    return newRoom.id;
  },

  // 채팅방 삭제 (기본 채팅방은 삭제 불가)
  deleteRoom: async (roomId) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room || room.isDefault) return;

    const success = await chatApi.deleteChatRoom(roomId);
    if (success) {
      set((state) => {
        const updatedRooms = state.rooms.filter((r) => r.id !== roomId);
        // 캐시 업데이트
        setCachedRooms(updatedRooms);
        clearMessageCache(roomId); // 해당 방 메시지 캐시도 삭제
        return { rooms: updatedRooms };
      });
    }
  },

  // 채팅방 조회
  getRoomById: (roomId) => {
    return get().rooms.find((r) => r.id === roomId);
  },

  // 기본 채팅방 조회
  getDefaultRoom: () => {
    return get().rooms.find((r) => r.isDefault);
  },

  // 메시지 추가 (Supabase에 저장 + 캐시 업데이트)
  addMessage: async (roomId, message) => {
    // Supabase에 저장
    const dbMessage = await chatApi.addMessage(
      roomId,
      message.role,
      message.content,
      message.agentRole,
      message.rescheduleOptions,
      message.actions
    );

    if (!dbMessage) {
      console.error('[ChatStore] 메시지 저장 실패');
      return null;
    }

    const newMessage = dbMessageToFrontend(dbMessage);

    // 로컬 상태 업데이트
    set((state) => {
      const updatedRooms = state.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              messages: [...room.messages, newMessage].slice(-100),
            }
          : room
      );

      // localStorage 메시지 캐시 업데이트
      const updatedRoom = updatedRooms.find((r) => r.id === roomId);
      if (updatedRoom) {
        setCachedMessages(roomId, updatedRoom.messages);
      }

      // 채팅방 목록 캐시도 업데이트 (마지막 메시지 반영)
      setCachedRooms(updatedRooms);

      return { rooms: updatedRooms };
    });

    return newMessage.id;
  },

  // 채팅방 읽음 처리
  markRoomAsRead: async (roomId) => {
    await chatApi.markMessagesAsRead(roomId);

    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              messages: room.messages.map((m) => ({ ...m, isRead: true })),
            }
          : room
      ),
    }));
  },

  // 채팅방 메시지 삭제
  clearRoomMessages: async (roomId) => {
    await chatApi.clearRoomMessages(roomId);
    clearMessageCache(roomId); // 해당 방 캐시도 삭제

    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === roomId ? { ...room, messages: [] } : room
      ),
    }));
  },

  // 대기 중인 응답 추가
  addPendingResponse: (roomId, userMessageId) => {
    const pending: PendingResponse = {
      roomId,
      userMessageId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    set((state) => ({
      pendingResponses: [...state.pendingResponses, pending],
    }));
  },

  // 대기 중인 응답 상태 업데이트
  updatePendingResponse: (userMessageId, status) => {
    set((state) => ({
      pendingResponses: state.pendingResponses.map((p) =>
        p.userMessageId === userMessageId ? { ...p, status } : p
      ),
    }));
  },

  // 대기 중인 응답 제거
  removePendingResponse: (userMessageId) => {
    set((state) => ({
      pendingResponses: state.pendingResponses.filter(
        (p) => p.userMessageId !== userMessageId
      ),
    }));
  },

  // 채팅방의 대기 중인 응답 조회
  getPendingResponseForRoom: (roomId) => {
    return get().pendingResponses.find((p) => p.roomId === roomId);
  },

  // 알림 추가
  addNotification: (notification) => {
    const newNotification: ChatNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
    }));
  },

  // 알림 읽음 처리
  markNotificationAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },

  // 알림 전체 삭제
  clearNotifications: () => {
    set({ notifications: [] });
  },

  // 채팅방별 읽지 않은 메시지 개수
  getUnreadCountForRoom: (roomId) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return 0;
    return room.messages.filter((m) => !m.isRead && m.role === 'assistant').length;
  },

  // 전체 읽지 않은 메시지 개수
  getTotalUnreadCount: () => {
    const { rooms } = get();
    return rooms.reduce((total, room) => {
      return total + room.messages.filter((m) => !m.isRead && m.role === 'assistant').length;
    }, 0);
  },

  // 읽지 않은 알림 개수
  getUnreadNotificationCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
}));

// 총 읽지 않은 개수 (메시지 + 알림) - 하위 호환성
export function getTotalUnreadCount(): number {
  const store = useChatStore.getState();
  return store.getTotalUnreadCount() + store.getUnreadNotificationCount();
}
