/**
 * Chat Store
 * 여러 채팅방 지원 + 백그라운드 응답 + 알림 시스템
 * - 카카오톡 스타일 채팅 목록
 * - localStorage에 메시지 영구 저장
 * - 백그라운드에서 AI 응답 생성 유지
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  type: 'POSTPONE_TODAY' | 'RESCHEDULE_QUEST' | 'NAVIGATE' | 'CUSTOM';
  label: string;
  icon?: string;
  // 액션별 데이터
  data?: {
    daysToAdd?: number;       // POSTPONE_TODAY용
    planId?: string;          // RESCHEDULE_QUEST용
    questDay?: number;        // RESCHEDULE_QUEST용
    newDate?: string;         // RESCHEDULE_QUEST용
    navigateTo?: string;      // NAVIGATE용
    customHandler?: string;   // CUSTOM용
  };
}

// 메시지 인터페이스
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  agentRole?: string;
  isRead: boolean;
  rescheduleOptions?: RescheduleOption[];
  actions?: MessageAction[];  // 액션 버튼
}

// 채팅방 인터페이스
export interface ChatRoom {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  createdAt: string;
  messages: ChatMessage[];
  isDefault?: boolean; // 기본 AI 코치 채팅방
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
  // 채팅방
  rooms: ChatRoom[];

  // 알림
  notifications: ChatNotification[];

  // 백그라운드 응답 대기열
  pendingResponses: PendingResponse[];

  // 채팅방 액션
  createRoom: (name: string, emoji: string, description?: string) => string;
  deleteRoom: (roomId: string) => void;
  getRoomById: (roomId: string) => ChatRoom | undefined;
  getDefaultRoom: () => ChatRoom;

  // 메시지 액션
  addMessage: (roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => string;
  markRoomAsRead: (roomId: string) => void;
  clearRoomMessages: (roomId: string) => void;

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

// 기본 AI 코치 채팅방 ID
export const DEFAULT_ROOM_ID = 'ai-coach-default';

// 이전 버전 localStorage 키
const OLD_STORAGE_KEY = 'questybook-chat-storage';
const NEW_STORAGE_KEY = 'questybook-chat-storage-v2';

// 기존 v1 데이터를 v2로 마이그레이션
function migrateFromOldStorage(): void {
  try {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    const newData = localStorage.getItem(NEW_STORAGE_KEY);

    // 이미 새 데이터가 있거나 기존 데이터가 없으면 스킵
    if (!oldData) return;

    const parsed = JSON.parse(oldData);
    const oldState = parsed?.state;

    // 기존 메시지가 있는 경우만 마이그레이션
    if (oldState?.messages && oldState.messages.length > 0) {
      // 새 데이터가 없거나 기본 채팅방에 메시지가 없으면 마이그레이션
      let shouldMigrate = false;

      if (!newData) {
        shouldMigrate = true;
      } else {
        const newParsed = JSON.parse(newData);
        const newRooms = newParsed?.state?.rooms || [];
        const defaultRoom = newRooms.find((r: ChatRoom) => r.isDefault);
        // 새 기본 채팅방이 비어있으면 마이그레이션
        if (!defaultRoom || defaultRoom.messages.length === 0) {
          shouldMigrate = true;
        }
      }

      if (shouldMigrate) {
        const migratedRoom: ChatRoom = {
          id: DEFAULT_ROOM_ID,
          name: 'AI 학습 코치',
          emoji: '🤖',
          description: '언제든 물어보세요!',
          createdAt: new Date().toISOString(),
          messages: oldState.messages,
          isDefault: true,
        };

        const newState = {
          state: {
            rooms: [migratedRoom],
            notifications: [],
            pendingResponses: [],
          },
          version: 2,
        };

        localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(newState));
        console.log(`[ChatStore] 기존 대화 ${oldState.messages.length}개 마이그레이션 완료`);
      }
    }

    // 마이그레이션 후 기존 데이터 삭제
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch (error) {
    console.error('[ChatStore] 마이그레이션 실패:', error);
  }
}

// 앱 시작 시 마이그레이션 실행
migrateFromOldStorage();

// 기본 채팅방 생성
const createDefaultRoom = (): ChatRoom => ({
  id: DEFAULT_ROOM_ID,
  name: 'AI 학습 코치',
  emoji: '🤖',
  description: '언제든 물어보세요!',
  createdAt: new Date().toISOString(),
  messages: [],
  isDefault: true,
});

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      rooms: [createDefaultRoom()],
      notifications: [],
      pendingResponses: [],

      // 채팅방 생성
      createRoom: (name, emoji, description) => {
        const newRoom: ChatRoom = {
          id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          emoji,
          description,
          createdAt: new Date().toISOString(),
          messages: [],
        };

        set((state) => ({
          rooms: [...state.rooms, newRoom],
        }));

        return newRoom.id;
      },

      // 채팅방 삭제 (기본 채팅방은 삭제 불가)
      deleteRoom: (roomId) => {
        set((state) => ({
          rooms: state.rooms.filter((r) => r.id !== roomId || r.isDefault),
        }));
      },

      // 채팅방 조회
      getRoomById: (roomId) => {
        return get().rooms.find((r) => r.id === roomId);
      },

      // 기본 채팅방 조회 (없으면 생성)
      getDefaultRoom: () => {
        const { rooms } = get();
        let defaultRoom = rooms.find((r) => r.isDefault);

        if (!defaultRoom) {
          defaultRoom = createDefaultRoom();
          set((state) => ({
            rooms: [defaultRoom!, ...state.rooms],
          }));
        }

        return defaultRoom;
      },

      // 메시지 추가
      addMessage: (roomId, message) => {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newMessage: ChatMessage = {
          ...message,
          id: messageId,
          timestamp: new Date().toISOString(),
          isRead: message.role === 'user',
        };

        set((state) => ({
          rooms: state.rooms.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  messages: [...room.messages, newMessage].slice(-100),
                }
              : room
          ),
        }));

        return messageId;
      },

      // 채팅방 읽음 처리
      markRoomAsRead: (roomId) => {
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
      clearRoomMessages: (roomId) => {
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
    }),
    {
      name: NEW_STORAGE_KEY,
      // 마이그레이션: 기존 데이터가 있으면 기본 채팅방으로 이관
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as Partial<ChatStore> & { messages?: ChatMessage[] };

        // v1에서 v2로 마이그레이션 (단일 messages → rooms 구조)
        if (state.messages && !state.rooms) {
          const defaultRoom = createDefaultRoom();
          defaultRoom.messages = state.messages;
          return {
            ...state,
            rooms: [defaultRoom],
            messages: undefined,
          };
        }

        return state;
      },
      version: 2,
    }
  )
);

// 총 읽지 않은 개수 (메시지 + 알림) - 하위 호환성
export function getTotalUnreadCount(): number {
  const store = useChatStore.getState();
  return store.getTotalUnreadCount() + store.getUnreadNotificationCount();
}
