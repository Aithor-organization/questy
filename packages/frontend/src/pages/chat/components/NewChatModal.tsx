/**
 * NewChatModal
 * 새 채팅방 생성 모달
 */

import { useState } from 'react';

interface NewChatModalProps {
  onClose: () => void;
  onCreate: (name: string, emoji: string, description?: string) => void;
}

const EMOJI_OPTIONS = ['📚', '📖', '✏️', '🎯', '💡', '🧠', '📝', '🎓', '⭐', '🌟'];

export function NewChatModal({ onClose, onCreate }: NewChatModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), emoji, description.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* 헤더 */}
        <div className="p-4 border-b border-[var(--paper-lines)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--ink-black)]">
              새 채팅 만들기
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[var(--paper-cream)] flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 이모지 선택 */}
          <div>
            <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
              아이콘 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                    emoji === e
                      ? 'bg-[var(--sticker-mint)] ring-2 ring-[var(--ink-blue)]'
                      : 'bg-[var(--paper-cream)] hover:bg-[var(--highlight-yellow)]'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 채팅방 이름 */}
          <div>
            <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
              채팅방 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 수학 공부방"
              className="w-full px-4 py-3 rounded-xl border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)] bg-[var(--paper-cream)]"
              autoFocus
            />
          </div>

          {/* 설명 (선택) */}
          <div>
            <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
              설명 (선택)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="예: 수학 질문하는 방"
              className="w-full px-4 py-3 rounded-xl border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)] bg-[var(--paper-cream)]"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[var(--paper-lines)] text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--sticker-mint)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
            >
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
