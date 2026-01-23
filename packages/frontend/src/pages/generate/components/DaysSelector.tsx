/**
 * DaysSelector Component
 * 요일 선택 및 목표 일수 설정
 * - 공부할 요일 선택 (월~일)
 * - 목표 일수 직접 입력 또는 AI 추천
 */

import { ALL_DAYS, DAY_LABELS, WEEKDAYS, type DayOfWeek } from '@questybook/shared';

interface DaysSelectorProps {
  totalDays: number;
  selectedDays: DayOfWeek[];
  scheduleMode: 'manual' | 'ai';
  onTotalDaysChange: (days: number) => void;
  onSelectedDaysChange: (days: DayOfWeek[]) => void;
  onScheduleModeChange: (mode: 'manual' | 'ai') => void;
  /** 직접 만들기 모드에서 일정 설정 숨김 */
  hideScheduleMode?: boolean;
}

export function DaysSelector({
  totalDays,
  selectedDays,
  scheduleMode,
  onTotalDaysChange,
  onSelectedDaysChange,
  onScheduleModeChange,
  hideScheduleMode = false,
}: DaysSelectorProps) {
  // 요일 토글
  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      // 선택 해제
      onSelectedDaysChange(selectedDays.filter(d => d !== day));
    } else {
      // 선택
      onSelectedDaysChange([...selectedDays, day]);
    }
  };

  // 평일만 선택
  const selectWeekdaysOnly = () => {
    onSelectedDaysChange([...WEEKDAYS]);
  };

  // 전체 선택
  const selectAllDays = () => {
    onSelectedDaysChange([...ALL_DAYS]);
  };

  // 선택된 요일 수에 따른 예상 기간 계산
  const daysPerWeek = selectedDays.length;
  const estimatedWeeks = daysPerWeek > 0 ? Math.ceil(totalDays / daysPerWeek) : 0;

  return (
    <div className="mb-6 space-y-6">
      {/* 요일 선택 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-[var(--pencil-gray)]">
            공부할 요일 선택
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWeekdaysOnly}
              className="text-xs text-[var(--ink-blue)] hover:underline"
            >
              평일만
            </button>
            <span className="text-xs text-[var(--paper-lines)]">|</span>
            <button
              type="button"
              onClick={selectAllDays}
              className="text-xs text-[var(--ink-blue)] hover:underline"
            >
              전체
            </button>
          </div>
        </div>

        <div className="flex gap-1 sm:gap-2">
          {ALL_DAYS.map((day) => {
            const isSelected = selectedDays.includes(day);
            const isWeekend = day === 'sat' || day === 'sun';

            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex-1 min-w-0 h-10 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? isWeekend
                      ? 'bg-[var(--sticker-coral)] text-white'
                      : 'bg-[var(--ink-blue)] text-white'
                    : 'bg-[var(--paper-cream)] text-[var(--pencil-gray)] border border-[var(--paper-lines)] hover:border-[var(--ink-blue)]'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-[var(--pencil-gray)]">
          {daysPerWeek > 0
            ? `주 ${daysPerWeek}일 학습 (약 ${estimatedWeeks}주 소요 예상)`
            : '공부할 요일을 선택해주세요'}
        </p>
      </div>

      {/* 일정 설정 모드 (직접 만들기 모드에서는 숨김) */}
      {!hideScheduleMode && (
        <>
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-2">
              일정 설정
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onScheduleModeChange('ai')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm transition-all ${
                  scheduleMode === 'ai'
                    ? 'bg-[var(--sticker-mint)] text-white'
                    : 'bg-[var(--paper-cream)] text-[var(--pencil-gray)] border border-[var(--paper-lines)]'
                }`}
              >
                ✨ AI 추천
              </button>
              <button
                type="button"
                onClick={() => onScheduleModeChange('manual')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm transition-all ${
                  scheduleMode === 'manual'
                    ? 'bg-[var(--ink-blue)] text-white'
                    : 'bg-[var(--paper-cream)] text-[var(--pencil-gray)] border border-[var(--paper-lines)]'
                }`}
              >
                📅 직접 입력
              </button>
            </div>
          </div>

          {/* 직접 입력 모드 */}
          {scheduleMode === 'manual' && (
            <div>
              <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                목표 퀘스트 수
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="7"
                  max="90"
                  value={totalDays}
                  onChange={(e) => onTotalDaysChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-[var(--paper-lines)] rounded-lg appearance-none cursor-pointer"
                />
                <div className="sticker sticker-gold">{totalDays}개</div>
              </div>
              <div className="flex justify-between text-xs text-[var(--pencil-gray)] mt-1">
                <span>빠르게 (7개)</span>
                <span>여유롭게 (90개)</span>
              </div>
            </div>
          )}

          {/* AI 추천 모드 안내 */}
          {scheduleMode === 'ai' && (
            <div className="p-4 bg-[var(--highlight-green)] rounded-lg">
              <p className="text-sm text-[var(--ink-black)]">
                ✨ AI가 교재 분량과 선택한 요일을 분석하여 최적의 학습 일정을 추천해 드립니다.
              </p>
              <p className="text-xs text-[var(--pencil-gray)] mt-2">
                생성 후 일정을 조정할 수 있습니다.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
