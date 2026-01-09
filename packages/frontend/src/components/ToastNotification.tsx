/**
 * ToastNotification
 * 토스트 알림 컴포넌트
 * - 새 메시지 알림
 * - 자동 닫기 (5초)
 * - 클릭 시 해당 채팅방으로 이동
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type ChatNotification } from '../stores/chatStore';

export function ToastNotification() {
  const navigate = useNavigate();
  const [visibleNotifications, setVisibleNotifications] = useState<ChatNotification[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());

  const {
    notifications,
    markNotificationAsRead,
    getRoomById,
  } = useChatStore();

  // 새 알림 감지
  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.isRead);
    const newNotifications = unreadNotifications.filter(
      n => !shownIdsRef.current.has(n.id)
    );

    if (newNotifications.length > 0) {
      // 새 알림 ID 기록
      newNotifications.forEach(n => shownIdsRef.current.add(n.id));

      setVisibleNotifications(prev => [...newNotifications, ...prev].slice(0, 3));

      // 5초 후 자동 제거
      newNotifications.forEach(notification => {
        setTimeout(() => {
          setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
      });
    }
  }, [notifications]);

  const handleClick = (notification: ChatNotification) => {
    markNotificationAsRead(notification.id);
    setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id));
    navigate(`/chat/${notification.roomId}`);
  };

  const handleClose = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    markNotificationAsRead(notificationId);
    setVisibleNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[100] space-y-2 max-w-sm">
      {visibleNotifications.map(notification => {
        const room = getRoomById(notification.roomId);

        return (
          <div
            key={notification.id}
            onClick={() => handleClick(notification)}
            className="bg-white rounded-xl shadow-lg border border-[var(--paper-lines)] p-3 cursor-pointer hover:shadow-xl transition-all animate-slide-in"
          >
            <div className="flex items-start gap-3">
              {/* 아이콘 */}
              <div className="w-10 h-10 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-xl flex-shrink-0">
                {room?.emoji || '💬'}
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm text-[var(--ink-black)] truncate">
                    {notification.title}
                  </h4>
                  <button
                    onClick={(e) => handleClose(e, notification.id)}
                    className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)] flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-[var(--pencil-gray)] line-clamp-2">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
