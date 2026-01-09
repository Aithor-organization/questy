/**
 * MessageList
 * 채팅 메시지 목록 컴포넌트
 */

import type { RefObject } from 'react';
import type { ChatMessage } from '../../../stores/chatStore';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  roomId: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  isTyping,
  roomId,
  messagesEndRef,
}: MessageListProps) {
  return (
    <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto bg-[var(--paper-cream)]">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} roomId={roomId} />
      ))}

      {/* 타이핑 인디케이터 */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2">
            🤖
          </div>
          <div className="bg-white border border-[var(--paper-lines)] rounded-2xl px-4 py-2">
            <span className="animate-pulse">답변을 준비 중이에요...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
