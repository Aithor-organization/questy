/**
 * Chat Store
 * 채팅 메시지 영구 저장 (카카오톡처럼)
 * - localStorage에 메시지 저장
 * - 탭 이동/앱 재시작 후에도 유지
 * - 읽지 않은 알림 개수 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 메시지 인터페이스
export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string; // ISO string for serialization
  agentRole?: string;
  isRead: boolean;
}

// 알림 인터페이스
export interface ChatNotification {
  id: string;
  type: 'message' | 'delay' | 'reminder' | 'achievement';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  data?: Record<string, unknown>;
}

interface ChatStore {
  // 메시지
  messages: ChatMessage[];
  conversationId: string | null;

  // 알림
  notifications: ChatNotification[];

  // 상태
  lastReadTimestamp: string | null;

  // 메시지 액션
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp' | 'isRead'>) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  markAllAsRead: () => void;

  // 대화 관리
  setConversationId: (id: string) => void;

  // 알림 액션
  addNotification: (notification: Omit<ChatNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;

  // 읽기 상태
  getUnreadCount: () => number;
  getUnreadNotificationCount: () => number;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      conversationId: null,
      notifications: [],
      lastReadTimestamp: null,

      // 메시지 추가
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          isRead: message.role === 'user', // 사용자 메시지는 자동으로 읽음 처리
        };

        set((state) => ({
          messages: [...state.messages, newMessage].slice(-100), // 최근 100개만 유지
        }));
      },

      // 메시지 설정 (복원용)
      setMessages: (messages) => {
        set({ messages });
      },

      // 메시지 삭제
      clearMessages: () => {
        set({ messages: [], conversationId: null });
      },

      // 모든 메시지 읽음 처리
      markAllAsRead: () => {
        set((state) => ({
          messages: state.messages.map((m) => ({ ...m, isRead: true })),
          lastReadTimestamp: new Date().toISOString(),
        }));
      },

      // 대화 ID 설정
      setConversationId: (id) => {
        set({ conversationId: id });
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
          notifications: [newNotification, ...state.notifications].slice(0, 50), // 최근 50개만
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

      // 읽지 않은 메시지 개수
      getUnreadCount: () => {
        const { messages } = get();
        return messages.filter((m) => !m.isRead && m.role === 'assistant').length;
      },

      // 읽지 않은 알림 개수
      getUnreadNotificationCount: () => {
        const { notifications } = get();
        return notifications.filter((n) => !n.isRead).length;
      },
    }),
    {
      name: 'questybook-chat-storage',
    }
  )
);

// 총 읽지 않은 개수 (메시지 + 알림)
export function getTotalUnreadCount(): number {
  const store = useChatStore.getState();
  return store.getUnreadCount() + store.getUnreadNotificationCount();
}
