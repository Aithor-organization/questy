/**
 * ChatInput
 * 채팅 입력 컴포넌트
 */

import { useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 컴포넌트 마운트 시 포커스
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--paper-lines)] p-4 bg-white">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="메시지를 입력해주세요..."
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-full border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)] bg-[var(--paper-cream)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="px-6 py-3 bg-[var(--sticker-mint)] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
        >
          전송
        </button>
      </form>
    </div>
  );
}
