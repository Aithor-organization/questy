/**
 * TodayHeader
 * 날짜별 헤더 및 과거/미래 날짜 요약 컴포넌트
 */

import { DailyHeader } from '../../../components/notebook';
import type { QuestWithPlan } from '../../../stores/questStore';

interface TodayHeaderProps {
  selectedDate: string;
  quests: QuestWithPlan[];
  todayStr: string;
  isToday: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToToday: () => void;
}

export function TodayHeader({
  selectedDate,
  quests,
  todayStr,
  isToday,
  onPrevDay,
  onNextDay,
  onGoToToday,
}: TodayHeaderProps) {
  return (
    <>
      {/* 일별 헤더 */}
      <DailyHeader
        date={selectedDate}
        quests={quests}
        onPrevDay={onPrevDay}
        onNextDay={onNextDay}
        onToday={onGoToToday}
        isToday={isToday}
      />

      {/* 과거 날짜 요약 (오늘이 아닐 때만 표시) */}
      {!isToday && quests.length > 0 && (
        <div className="notebook-page-lined p-4 bg-gray-50 mb-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--ink-black)]">
                {selectedDate < todayStr ? '이 날의 학습 기록' : '예정된 학습'}
              </h3>
              <p className="text-sm text-[var(--pencil-gray)]">
                {selectedDate < todayStr
                  ? '과거 기록은 수정할 수 없어요 (읽기 전용)'
                  : '미래 퀘스트는 해당 날짜가 되면 시작할 수 있어요'}
              </p>
            </div>
          </div>
          {/* 완료 통계 */}
          {selectedDate < todayStr && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-[var(--sticker-mint)] font-bold text-lg">
                  {quests.filter(q => q.completed).length}
                </span>
                <span className="text-sm text-[var(--pencil-gray)]">완료</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-bold text-lg">
                  {quests.filter(q => !q.completed).length}
                </span>
                <span className="text-sm text-[var(--pencil-gray)]">미완료</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={onGoToToday}
                className="text-[var(--ink-blue)] text-sm hover:underline"
              >
                오늘로 돌아가기 →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
