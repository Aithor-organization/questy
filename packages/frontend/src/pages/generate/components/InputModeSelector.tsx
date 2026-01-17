/**
 * InputModeSelector Component
 * 입력 모드 선택 탭 (사진 업로드 / 교재 검색)
 */

import type { InputMode } from '../types';

interface InputModeSelectorProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
}

export function InputModeSelector({ mode, onChange }: InputModeSelectorProps) {
  return (
    <div className="flex gap-2 p-1 bg-[var(--paper-lines)] rounded-xl mb-6" style={{ wordBreak: 'keep-all' }}>
      <button
        type="button"
        onClick={() => onChange('upload')}
        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
          mode === 'upload'
            ? 'bg-white text-[var(--ink-blue)] shadow-sm'
            : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
        }`}
      >
        📷 사진 업로드
      </button>
      <button
        type="button"
        onClick={() => onChange('search')}
        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
          mode === 'search'
            ? 'bg-white text-[var(--ink-blue)] shadow-sm'
            : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
        }`}
      >
        🔍 교재 검색
      </button>
    </div>
  );
}
