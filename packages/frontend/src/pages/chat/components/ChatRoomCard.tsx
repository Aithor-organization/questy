/**
 * ChatRoomCard
 * 채팅 목록에서 표시되는 개별 채팅방 카드
 */

import { useChatStore, type ChatRoom } from '../../../stores/chatStore';

interface ChatRoomCardProps {
  room: ChatRoom;
  onClick: () => void;
}

export function ChatRoomCard({ room, onClick }: ChatRoomCardProps) {
  const { getUnreadCountForRoom, getPendingResponseForRoom } = useChatStore();

  const unreadCount = getUnreadCountForRoom(room.id);
  const pendingResponse = getPendingResponseForRoom(room.id);
  const lastMessage = room.messages[room.messages.length - 1];

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const truncateMessage = (content: string, maxLength: number = 40) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--highlight-yellow)] transition-colors text-left"
    >
      {/* 프로필 이모지 */}
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-sm border border-[var(--paper-lines)] flex-shrink-0">
        {room.emoji}
      </div>

      {/* 채팅방 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-[var(--ink-black)] truncate">
            {room.name}
            {room.isDefault && (
              <span className="ml-1 text-xs bg-[var(--sticker-mint)] text-white px-1.5 py-0.5 rounded">
                AI
              </span>
            )}
          </h3>
          {lastMessage && (
            <span className="text-xs text-[var(--pencil-gray)] flex-shrink-0 ml-2">
              {formatTime(lastMessage.timestamp)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--pencil-gray)] truncate">
            {pendingResponse && pendingResponse.status === 'processing' ? (
              <span className="text-[var(--ink-blue)]">
                ✏️ 답변 작성 중...
              </span>
            ) : lastMessage ? (
              <>
                {lastMessage.role === 'user' && '나: '}
                {truncateMessage(lastMessage.content)}
              </>
            ) : (
              room.description || '대화를 시작해보세요!'
            )}
          </p>

          {/* 읽지 않은 메시지 배지 */}
          {unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-[var(--sticker-red)] text-white text-xs font-medium rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
