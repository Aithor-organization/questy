/**
 * DaysSelector Component
 * 목표 일수 및 주말 미포함 설정
 */

interface DaysSelectorProps {
  totalDays: number;
  excludeWeekends: boolean;
  onTotalDaysChange: (days: number) => void;
  onExcludeWeekendsChange: (exclude: boolean) => void;
}

export function DaysSelector({
  totalDays,
  excludeWeekends,
  onTotalDaysChange,
  onExcludeWeekendsChange,
}: DaysSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm text-[var(--pencil-gray)] mb-2">
        목표 일수
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
        <div className="sticker sticker-gold">{totalDays}일</div>
      </div>
      <div className="flex justify-between text-xs text-[var(--pencil-gray)] mt-1">
        <span>빠르게 (7일)</span>
        <span>여유롭게 (90일)</span>
      </div>

      {/* 주말 미포함 체크박스 */}
      <div className="mt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={excludeWeekends}
            onChange={(e) => onExcludeWeekendsChange(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--paper-lines)] text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
          />
          <span className="text-sm text-[var(--ink-black)]">📅 주말 미포함</span>
        </label>

        {excludeWeekends && (
          <div className="mt-2 p-3 bg-[var(--highlight-yellow)] rounded-lg">
            <p className="text-xs text-[var(--ink-black)]">
              ⚠️ <strong>주의:</strong> 스케줄을 못 끝내고 하루가 지나갈 경우에 주말에도 퀘스트가 생성될 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
