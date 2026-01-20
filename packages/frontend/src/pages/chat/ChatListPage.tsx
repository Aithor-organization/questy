/**
 * ChatListPage
 * 카카오톡 스타일 채팅 목록 화면
 * - 여러 채팅방 표시
 * - 안읽은 메시지 배지
 * - 새 채팅방 생성
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout } from '../../components/notebook/NotebookLayout';
import { useChatStore } from '../../stores/chatStore';
import { ChatRoomCard } from './components/ChatRoomCard';
import { NewChatModal } from './components/NewChatModal';

export function ChatListPage() {
  const navigate = useNavigate();
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const {
    rooms,
    isInitialized,
    createRoom,
    getTotalUnreadCount,
    getUnreadNotificationCount,
  } = useChatStore();

  const totalUnread = getTotalUnreadCount();
  const notificationCount = getUnreadNotificationCount();

  // 채팅방 정렬: 기본 채팅방 먼저, 나머지는 최근 메시지 순
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    const aLastMsg = a.messages[a.messages.length - 1];
    const bLastMsg = b.messages[b.messages.length - 1];
    if (!aLastMsg && !bLastMsg) return 0;
    if (!aLastMsg) return 1;
    if (!bLastMsg) return -1;
    return new Date(bLastMsg.timestamp).getTime() - new Date(aLastMsg.timestamp).getTime();
  });

  const handleRoomClick = (roomId: string) => {
    navigate(`/chat/${roomId}`);
  };

  const handleCreateRoom = async (name: string, emoji: string, description?: string) => {
    const newRoomId = await createRoom(name, emoji, description);
    setShowNewChatModal(false);
    if (newRoomId) {
      navigate(`/chat/${newRoomId}`);
    }
  };

  return (
    <NotebookLayout>
      <div className="notebook-page p-0 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
        {/* 헤더 */}
        <div className="flex-shrink-0 bg-[var(--sticker-mint)] px-4 py-3 border-b border-[var(--paper-lines)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
                💬
              </div>
              <div>
                <h2 className="font-bold text-white">채팅</h2>
                <p className="text-xs text-white/80">
                  {totalUnread > 0 ? `${totalUnread}개의 새 메시지` : '모든 메시지를 확인했어요'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors"
            >
              + 새 채팅
            </button>
          </div>
        </div>

        {/* 알림 배너 (있는 경우) */}
        {notificationCount > 0 && (
          <div className="flex-shrink-0 px-4 py-2 bg-[var(--highlight-yellow)] border-b border-[var(--paper-lines)]">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="text-sm text-[var(--ink-black)]">
                {notificationCount}개의 새로운 알림이 있어요
              </span>
            </div>
          </div>
        )}

        {/* 채팅 목록 */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--paper-cream)]">
          {/* 초기화 전: 로딩 상태 (캐시 로드 대기) */}
          {!isInitialized ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-pulse text-4xl">💬</div>
            </div>
          ) : sortedRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-medium text-[var(--ink-black)] mb-2">
                아직 채팅이 없어요
              </h3>
              <p className="text-sm text-[var(--pencil-gray)] mb-4">
                새 채팅을 시작해보세요!
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-2 bg-[var(--sticker-mint)] text-white rounded-full hover:bg-emerald-500 transition-colors"
              >
                새 채팅 시작하기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--paper-lines)]">
              {sortedRooms.map(room => (
                <ChatRoomCard
                  key={room.id}
                  room={room}
                  onClick={() => handleRoomClick(room.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 새 채팅 모달 */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </NotebookLayout>
  );
}
