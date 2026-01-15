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
  streamingContent?: string;
  streamingAgentRole?: string | null;
}

export function MessageList({
  messages,
  isTyping,
  roomId,
  messagesEndRef,
  streamingContent,
  streamingAgentRole,
}: MessageListProps) {
  // 메시지가 적을 때 팁 표시 (환영 메시지만 있을 때)
  const showTips = messages.length <= 1;

  return (
    <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto bg-[var(--paper-cream)]">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} roomId={roomId} />
      ))}

      {/* 채팅 사용 팁 (처음 사용 시) */}
      {showTips && !isTyping && (
        <div className="mx-auto max-w-sm mt-4 p-4 bg-[var(--highlight-yellow)] rounded-lg border border-yellow-300">
          <p className="font-medium text-[var(--ink-black)] mb-2 text-center">💡 이렇게 대화해보세요</p>
          <ul className="text-sm space-y-2 text-[var(--pencil-gray)]">
            <li className="flex items-start gap-2">
              <span>📸</span>
              <span>"교재 목차 사진 보내면 학습 플랜 만들어줘"</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📅</span>
              <span>"이번 주 학습 일정 어떻게 돼?"</span>
            </li>
            <li className="flex items-start gap-2">
              <span>😰</span>
              <span>"공부하기 싫을 때 어떻게 해?"</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📖</span>
              <span>"수학 기출 3일 안에 끝내고 싶어"</span>
            </li>
          </ul>
        </div>
      )}

      {/* 스트리밍 응답 표시 */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2 flex-shrink-0">
            {streamingAgentRole === 'PLANNER' ? '📋' :
             streamingAgentRole === 'ANALYST' ? '📊' :
             streamingAgentRole === 'ADMISSION' ? '🎓' : '🤖'}
          </div>
          <div className="bg-white border border-[var(--paper-lines)] rounded-2xl px-4 py-3 max-w-[85%]">
            {streamingContent ? (
              <div className="whitespace-pre-wrap text-[var(--ink-black)]">
                {streamingContent}
                <span className="inline-block w-1 h-4 bg-[var(--pencil-gray)] ml-1 animate-pulse" />
              </div>
            ) : (
              <span className="animate-pulse text-[var(--pencil-gray)]">답변을 준비 중이에요...</span>
            )}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
