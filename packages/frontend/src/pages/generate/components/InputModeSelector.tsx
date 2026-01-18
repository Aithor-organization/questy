/**
 * InputModeSelector Component
 * 입력 모드 선택 탭 (사진 업로드 / 교재 검색 / 직접 만들기)
 */

import type { InputMode } from '../types';

interface InputModeSelectorProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
}

export function InputModeSelector({ mode, onChange }: InputModeSelectorProps) {
  const buttonClass = (isActive: boolean) =>
    `flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white text-[var(--ink-blue)] shadow-sm'
        : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
    }`;

  return (
    <div className="flex gap-1 p-1 bg-[var(--paper-lines)] rounded-xl mb-6" style={{ wordBreak: 'keep-all' }}>
      <button
        type="button"
        onClick={() => onChange('upload')}
        className={buttonClass(mode === 'upload')}
      >
        📷 사진
      </button>
      <button
        type="button"
        onClick={() => onChange('search')}
        className={buttonClass(mode === 'search')}
      >
        🔍 검색
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={buttonClass(mode === 'manual')}
      >
        ✏️ 직접
      </button>
    </div>
  );
}
