/**
 * DailyHeader
 * 일별 퀘스트 헤더 - 날짜 네비게이션 + 진행률
 */

import type { QuestWithPlan } from '../../stores/questStore';

interface DailyHeaderProps {
  date: string;
  quests: QuestWithPlan[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  isToday: boolean;
}

export function DailyHeader({
  date,
  quests,
  onPrevDay,
  onNextDay,
  onToday,
  isToday,
}: DailyHeaderProps) {
  const completed = quests.filter(q => q.completed).length;
  const total = quests.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      month: parseInt(month),
      day: parseInt(day),
      weekday: weekdays[d.getDay()],
      year: parseInt(year),
    };
  };

  const formatted = formatDate(date);

  return (
    <div className="notebook-page mb-6" style={{ padding: 0 }}>
      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--paper-lines)]">
        <button
          onClick={onPrevDay}
          className="p-2 hover:bg-[var(--highlight-yellow)] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--pencil-gray)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <span className="handwrite text-3xl text-[var(--ink-black)]">
              {formatted.month}월 {formatted.day}일
            </span>
            <span className="text-sm text-[var(--pencil-gray)] font-medium">
              ({formatted.weekday})
            </span>
          </div>
          {isToday ? (
            <span className="sticker sticker-gold text-xs mt-1 inline-block">
              ⭐ 오늘
            </span>
          ) : (
            <button
              onClick={onToday}
              className="text-xs text-[var(--ink-blue)] hover:underline mt-1"
            >
              오늘로 이동 →
            </button>
          )}
        </div>

        <button
          onClick={onNextDay}
          className="p-2 hover:bg-[var(--highlight-yellow)] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--pencil-gray)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 진행률 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--pencil-gray)]">
            오늘의 진행률
          </span>
          <span className="handwrite text-lg text-[var(--ink-blue)]">
            {completed}/{total} 완료
          </span>
        </div>
        <div className="progress-bar-notebook">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 응원 메시지 */}
        {total > 0 && (
          <p className="text-xs text-[var(--pencil-gray)] mt-2 text-center">
            {progress === 100 ? (
              <span className="text-[var(--sticker-mint)]">🎉 오늘 퀘스트 전부 완료! 대단해요!</span>
            ) : progress >= 50 ? (
              <span>💪 절반 이상 완료! 조금만 더 힘내요!</span>
            ) : completed > 0 ? (
              <span>🌱 좋은 시작이에요! 계속 가보자!</span>
            ) : (
              <span>📚 오늘도 함께 공부해요!</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
