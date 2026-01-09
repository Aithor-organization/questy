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
    <div className={`flex-shrink-0 ${headerColor} px-4 py-3 border-b border-[var(--paper-lines)]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            ←
          </button>

          {/* 프로필 */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
            {room.emoji}
          </div>

          <div>
            <h2 className="font-bold text-white">{room.name}</h2>
            <p className="text-xs text-white/80">
              {room.description || (room.isDefault ? '언제든 물어보세요!' : '')}
            </p>
          </div>
        </div>

        {/* 네비게이션 버튼 (기본 채팅방만) */}
        {room.isDefault && (
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('/planner')}
              className="px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors"
            >
              📋 플래너
            </button>
            <button
              onClick={() => onNavigate('/report')}
              className="px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors"
            >
              📊 리포트
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
