/**
 * AdmissionChat Component
 * 입학 상담 채팅 메시지 영역
 */

import { useRef, useEffect } from 'react';
import type { Message } from './types';

interface AdmissionChatProps {
  messages: Message[];
  isTyping: boolean;
}

export function AdmissionChat({ messages, isTyping }: AdmissionChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '50vh' }}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2 flex-shrink-0">
              🤖
            </div>
          )}
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[var(--highlight-yellow)] text-[var(--ink-black)]'
                : 'bg-white border border-[var(--paper-lines)] text-[var(--ink-black)]'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex justify-start">
          <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2">
            🤖
          </div>
          <div className="bg-white border border-[var(--paper-lines)] rounded-2xl px-4 py-2">
            <span className="animate-pulse">입력 중...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
