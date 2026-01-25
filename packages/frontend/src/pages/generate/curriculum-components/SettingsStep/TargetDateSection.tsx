/**
 * TargetDateSection
 * 목표일 선택 섹션
 */

import { TARGET_DATE_PRESETS } from './types';

interface TargetDateSectionProps {
  targetDate: string;
  onTargetDateChange: (date: string) => void;
}

export function TargetDateSection({ targetDate, onTargetDateChange }: TargetDateSectionProps) {
  const defaultTargetDate = () => new Date().toISOString().split('T')[0];

  return (
    <div className="notebook-card p-4">
      <label className="block text-sm font-medium mb-2">🎯 목표일</label>

      {/* 프리셋 버튼 */}
      <div className="flex gap-2 mb-3">
        {TARGET_DATE_PRESETS.map(({ label, date, variant }) => (
          <button
            key={date}
            type="button"
            onClick={() => onTargetDateChange(date)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              targetDate === date
                ? variant === 'highlight'
                  ? 'bg-[var(--sticker-coral)] text-white'
                  : 'bg-[var(--ink-blue)] text-white'
                : variant === 'highlight'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 날짜 선택 */}
      <input
        type="date"
        value={targetDate || defaultTargetDate()}
        onChange={(e) => onTargetDateChange(e.target.value)}
        min={new Date().toISOString().split('T')[0]}
        className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
      />
    </div>
  );
}
