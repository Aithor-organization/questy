/**
 * ChatHeader
 * 채팅방 헤더 컴포넌트
 */

import type { ChatRoom } from '../../../stores/chatStore';

interface ChatHeaderProps {
  room: ChatRoom;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function ChatHeader({ room, onBack, onNavigate }: ChatHeaderProps) {
  const headerColor = room.isDefault
    ? 'bg-[var(--sticker-mint)]'
    : 'bg-[var(--ink-blue)]';

  return (
    <div className={`flex-shrink-0 ${headerColor} px-3 sm:px-4 py-3 border-b border-[var(--paper-lines)]`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={onBack}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            ←
          </button>

          {/* 프로필 */}
          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
            {room.emoji}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white truncate">{room.name}</h2>
            <p className="text-xs text-white/80 truncate hidden sm:block">
              {room.description || (room.isDefault ? '언제든 물어보세요!' : '')}
            </p>
          </div>
        </div>

        {/* 네비게이션 버튼 (기본 채팅방만) */}
        {room.isDefault && (
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => onNavigate('/planner')}
              className="px-2 sm:px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">📋</span>
              <span className="hidden sm:inline">📋 플래너</span>
            </button>
            <button
              onClick={() => onNavigate('/report')}
              className="px-2 sm:px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">📊</span>
              <span className="hidden sm:inline">📊 리포트</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
