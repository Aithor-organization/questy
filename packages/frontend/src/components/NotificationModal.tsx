/**
 * NotificationModal
 * 알림 모달 컴포넌트
 * - 미완료 퀘스트 알림 (보기만)
 * - 코치 메시지 알림 (클릭 시 채팅방 이동)
 */

import { useNavigate } from 'react-router-dom';
import { useChatStore, type ChatNotification } from '../stores/chatStore';
import { useQuestStore, getTodayDateString, type QuestWithPlan } from '../stores/questStore';
import { Bell, X, MessageCircle, CheckSquare } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const navigate = useNavigate();

  // 채팅 알림
  const notifications = useChatStore((state) => state.notifications);
  const markNotificationAsRead = useChatStore((state) => state.markNotificationAsRead);
  const unreadChatCount = useChatStore((state) => state.getTotalUnreadCount());

  // 미완료 퀘스트
  const getIncompleteQuests = useQuestStore((state) => state.getIncompleteQuests);
  const todayStr = getTodayDateString();
  const incompleteQuests = getIncompleteQuests(todayStr);

  // 채팅 알림 클릭 핸들러
  const handleChatNotificationClick = (notification: ChatNotification) => {
    markNotificationAsRead(notification.id);
    onClose();
    navigate(`/chat/${notification.roomId}`);
  };

  // 퀘스트 알림 클릭 핸들러 - 해당 플랜 페이지로 이동
  const handleQuestClick = (quest: QuestWithPlan) => {
    onClose();
    navigate(`/plan/${quest.planId}`);
  };

  // 총 알림 개수
  const totalNotifications = notifications.filter(n => !n.isRead).length + incompleteQuests.length + unreadChatCount;

  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />

      {/* 모달 - 모바일 반응형 */}
      <div className="fixed top-14 right-2 left-2 sm:left-auto sm:right-4 sm:w-80 max-h-[calc(100vh-80px)] sm:max-h-[70vh] bg-white rounded-xl shadow-xl border border-[var(--paper-lines)] z-50 overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--paper-lines)] bg-[var(--paper-cream)]">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-[var(--ink-blue)]" />
            <span className="font-semibold text-sm text-[var(--ink-black)]">알림</span>
            {totalNotifications > 0 && (
              <span className="min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {totalNotifications > 99 ? '99+' : totalNotifications}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--highlight-yellow)] rounded-lg transition-colors"
          >
            <X size={18} className="text-[var(--pencil-gray)]" />
          </button>
        </div>

        {/* 알림 목록 - 유연한 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* 미완료 퀘스트 섹션 */}
          {incompleteQuests.length > 0 && (
            <div className="border-b border-[var(--paper-lines)]">
              <div className="px-4 py-2 bg-amber-50">
                <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  <CheckSquare size={14} />
                  오늘 미완료 퀘스트 ({incompleteQuests.length})
                </span>
              </div>
              <div className="divide-y divide-[var(--paper-lines)]">
                {incompleteQuests.map((quest) => (
                  <QuestNotificationItem
                    key={quest.id}
                    quest={quest}
                    onClick={() => handleQuestClick(quest)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 코치 메시지 섹션 */}
          {(notifications.length > 0 || unreadChatCount > 0) && (
            <div>
              <div className="px-4 py-2 bg-blue-50">
                <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <MessageCircle size={14} />
                  코치 메시지
                </span>
              </div>
              <div className="divide-y divide-[var(--paper-lines)]">
                {/* 읽지 않은 채팅 알림 표시 */}
                {unreadChatCount > 0 && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/chat');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-[var(--highlight-blue)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[var(--ink-blue)] rounded-full flex items-center justify-center flex-shrink-0">
                        <MessageCircle size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ink-black)]">
                          읽지 않은 메시지가 있어요
                        </p>
                        <p className="text-xs text-[var(--pencil-gray)] mt-0.5">
                          {unreadChatCount}개의 새 메시지
                        </p>
                      </div>
                    </div>
                  </button>
                )}
                {/* 알림 목록 */}
                {notifications.filter(n => !n.isRead).slice(0, 5).map((notification) => (
                  <ChatNotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleChatNotificationClick(notification)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 빈 상태 */}
          {incompleteQuests.length === 0 && notifications.filter(n => !n.isRead).length === 0 && unreadChatCount === 0 && (
            <div className="py-12 text-center">
              <Bell size={32} className="text-[var(--pencil-gray)] mx-auto mb-2 opacity-50" />
              <p className="text-sm text-[var(--pencil-gray)]">
                새로운 알림이 없어요
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// 퀘스트 알림 아이템 (클릭 시 플랜 페이지로 이동)
function QuestNotificationItem({
  quest,
  onClick
}: {
  quest: QuestWithPlan;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 bg-white text-left hover:bg-amber-50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-amber-600 text-xs font-bold">{quest.unitNumber}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--ink-black)] line-clamp-1">
            {quest.unitTitle}
          </p>
          <p className="text-xs text-[var(--pencil-gray)] mt-0.5">
            {quest.planName} · {quest.estimatedMinutes}분
          </p>
        </div>
        <div className="flex-shrink-0 text-[var(--pencil-gray)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// 채팅 알림 아이템 (클릭 시 이동)
function ChatNotificationItem({
  notification,
  onClick
}: {
  notification: ChatNotification;
  onClick: () => void;
}) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left hover:bg-[var(--highlight-blue)] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[var(--ink-blue)] rounded-full flex items-center justify-center flex-shrink-0">
          <MessageCircle size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ink-black)]">
              {notification.title}
            </p>
            <span className="text-xs text-[var(--pencil-gray)] flex-shrink-0">
              {formatTime(notification.timestamp)}
            </span>
          </div>
          <p className="text-xs text-[var(--pencil-gray)] mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        </div>
      </div>
    </button>
  );
}

export default NotificationModal;
