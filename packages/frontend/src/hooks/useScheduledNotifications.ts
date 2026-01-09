/**
 * useScheduledNotifications
 * 예약된 알림을 백그라운드에서 체크하고 전달하는 훅
 * - 1분마다 due 알림 체크
 * - 시간이 되면 코치가 채팅 메시지 전송
 * - 알림 전달 완료 표시
 */

import { useEffect, useCallback, useRef } from 'react';
import { useScheduledNotificationStore } from '../stores/scheduledNotificationStore';
import { useChatStore, DEFAULT_ROOM_ID } from '../stores/chatStore';

const CHECK_INTERVAL = 60 * 1000; // 1분마다 체크

export function useScheduledNotifications() {
  const intervalRef = useRef<number | null>(null);

  const { getDueNotifications, markAsDelivered, cleanupOldNotifications } =
    useScheduledNotificationStore();
  const { addMessage, addNotification } = useChatStore();

  // 예약된 알림 전달
  const deliverNotifications = useCallback(() => {
    const dueNotifications = getDueNotifications();

    for (const notification of dueNotifications) {
      // 채팅방에 코치 메시지로 전송
      addMessage(notification.roomId || DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: notification.message,
        agentRole: 'COACH',
      });

      // 시스템 알림도 표시 (사용자가 다른 화면에 있을 수 있으므로)
      addNotification({
        roomId: notification.roomId || DEFAULT_ROOM_ID,
        type: 'message',
        title: '예약된 알림',
        message: notification.message.slice(0, 50) + (notification.message.length > 50 ? '...' : ''),
      });

      // 전달 완료 표시
      markAsDelivered(notification.id);

      console.log('[ScheduledNotifications] 알림 전달됨:', {
        id: notification.id,
        type: notification.type,
        message: notification.message.slice(0, 30) + '...',
      });
    }

    // 오래된 알림 정리 (7일 이상 지난 전달 완료 알림)
    cleanupOldNotifications();
  }, [getDueNotifications, markAsDelivered, cleanupOldNotifications, addMessage, addNotification]);

  // 백그라운드 체크 시작
  useEffect(() => {
    // 초기 체크
    deliverNotifications();

    // 주기적 체크 시작
    intervalRef.current = window.setInterval(deliverNotifications, CHECK_INTERVAL);

    console.log('[ScheduledNotifications] 백그라운드 체크 시작 (1분 간격)');

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        console.log('[ScheduledNotifications] 백그라운드 체크 중지');
      }
    };
  }, [deliverNotifications]);

  return {
    deliverNotifications, // 수동 트리거용
  };
}
