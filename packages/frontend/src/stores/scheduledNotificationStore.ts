/**
 * ScheduledNotificationStore
 * 예약된 알림을 관리하는 스토어
 * - 코치가 특정 시간에 메시지를 보내는 기능
 * - "내일 오후 2시에 알려줘" → 해당 시간에 채팅 메시지 전송
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ScheduledNotification {
  id: string;
  scheduledAt: string; // ISO 8601 timestamp
  message: string;
  roomId: string;
  type: 'REMINDER' | 'MOTIVATION' | 'QUEST_START' | 'CUSTOM';
  questId?: string; // 관련 퀘스트 ID (선택)
  createdAt: string;
  delivered: boolean;
}

interface ScheduledNotificationStore {
  notifications: ScheduledNotification[];

  // 알림 추가
  addNotification: (notification: Omit<ScheduledNotification, 'id' | 'createdAt' | 'delivered'>) => string;

  // 알림 제거
  removeNotification: (id: string) => void;

  // 알림 전달 완료 표시
  markAsDelivered: (id: string) => void;

  // 전달해야 할 알림 조회 (현재 시간 기준 만료된 것)
  getDueNotifications: () => ScheduledNotification[];

  // 특정 시간 범위의 알림 조회
  getNotificationsByDateRange: (start: Date, end: Date) => ScheduledNotification[];

  // 미전달 알림 조회
  getPendingNotifications: () => ScheduledNotification[];

  // 만료된 전달 완료 알림 정리 (7일 이상 지난 것)
  cleanupOldNotifications: () => void;
}

export const useScheduledNotificationStore = create<ScheduledNotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notification) => {
        const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: ScheduledNotification = {
          ...notification,
          id,
          createdAt: new Date().toISOString(),
          delivered: false,
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));

        console.log('[ScheduledNotification] 알림 예약됨:', {
          id,
          scheduledAt: notification.scheduledAt,
          message: notification.message.substring(0, 50) + '...',
        });

        return id;
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      markAsDelivered: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, delivered: true } : n
          ),
        }));
      },

      getDueNotifications: () => {
        const now = new Date();
        return get().notifications.filter(
          (n) => !n.delivered && new Date(n.scheduledAt) <= now
        );
      },

      getNotificationsByDateRange: (start, end) => {
        return get().notifications.filter((n) => {
          const scheduledDate = new Date(n.scheduledAt);
          return scheduledDate >= start && scheduledDate <= end;
        });
      },

      getPendingNotifications: () => {
        return get().notifications.filter((n) => !n.delivered);
      },

      cleanupOldNotifications: () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        set((state) => ({
          notifications: state.notifications.filter(
            (n) => !n.delivered || new Date(n.createdAt) > sevenDaysAgo
          ),
        }));
      },
    }),
    {
      name: 'questybook-scheduled-notifications',
    }
  )
);

/**
 * 자연어에서 시간을 파싱하는 유틸리티 함수
 * "내일 오후 2시" → Date 객체
 * "모레 아침 9시" → Date 객체
 */
export function parseScheduleTime(text: string): Date | null {
  const now = new Date();
  let targetDate = new Date(now);
  let hour = 9; // 기본 시간
  let minute = 0;

  // 날짜 파싱
  if (text.includes('오늘')) {
    // 오늘 그대로
  } else if (text.includes('내일')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (text.includes('모레')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (text.includes('다음주') || text.includes('다음 주')) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  // 요일 파싱
  const dayMap: Record<string, number> = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6,
  };
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (text.includes(dayName)) {
      const currentDay = targetDate.getDay();
      let diff = dayNum - currentDay;
      if (diff <= 0) diff += 7; // 다음 주 해당 요일로
      targetDate.setDate(targetDate.getDate() + diff);
      break;
    }
  }

  // 오전/오후 파싱
  const isPM = text.includes('오후') || text.includes('저녁') || text.includes('밤');
  const isAM = text.includes('오전') || text.includes('아침');

  // 시간 파싱 (숫자 추출)
  const timeMatch = text.match(/(\d{1,2})\s*시/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    if (isPM && hour < 12) {
      hour += 12;
    } else if (isAM && hour === 12) {
      hour = 0;
    }
  } else {
    // 시간 명시 안된 경우 기본값
    if (text.includes('아침')) hour = 8;
    else if (text.includes('점심')) hour = 12;
    else if (text.includes('저녁')) hour = 18;
    else if (text.includes('밤')) hour = 21;
  }

  // 분 파싱
  const minuteMatch = text.match(/(\d{1,2})\s*분/);
  if (minuteMatch) {
    minute = parseInt(minuteMatch[1], 10);
  } else if (text.includes('반')) {
    minute = 30;
  }

  targetDate.setHours(hour, minute, 0, 0);

  // 과거 시간이면 null 반환
  if (targetDate <= now) {
    // 오늘이고 이미 지난 시간이면 내일로
    if (text.includes('오늘') || (!text.includes('내일') && !text.includes('모레'))) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      return null;
    }
  }

  return targetDate;
}

/**
 * Date를 사용자 친화적 문자열로 변환
 */
export function formatScheduleTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(now);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  let dayStr = '';
  if (date.toDateString() === now.toDateString()) {
    dayStr = '오늘';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    dayStr = '내일';
  } else if (date.toDateString() === dayAfterTomorrow.toDateString()) {
    dayStr = '모레';
  } else {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    dayStr = `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  }

  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const minuteStr = minute > 0 ? ` ${minute}분` : '';

  return `${dayStr} ${period} ${displayHour}시${minuteStr}`;
}
