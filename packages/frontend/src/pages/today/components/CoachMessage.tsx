/**
 * CoachMessage
 * 코치 인사 메시지 컴포넌트
 */

import type { DailyCoachData } from '../types';

interface CoachMessageProps {
  coachData: DailyCoachData;
  isEvening: boolean;
  isLoadingReview: boolean;
  onChat: () => void;
  onEveningReview: () => void;
}

export function CoachMessage({
  coachData,
  isEvening,
  isLoadingReview,
  onChat,
  onEveningReview,
}: CoachMessageProps) {
  return (
    <div className="notebook-page-lined p-4 bg-[var(--highlight-green)] mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
          🤖
        </div>
        <div className="flex-1">
          <p className="text-[var(--ink-black)] font-medium">{coachData.dailyMessage}</p>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">{coachData.coachTip}</p>
        </div>
        {coachData.streak > 0 && (
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-sm shadow-sm">
            🔥 {coachData.streak}일
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onChat}
          className="flex-1 py-2 bg-white/50 rounded-lg text-sm text-[var(--ink-black)] hover:bg-white/70 transition-colors"
        >
          💬 질문하기
        </button>
        {isEvening && (
          <button
            onClick={onEveningReview}
            disabled={isLoadingReview}
            className="flex-1 py-2 bg-white/80 rounded-lg text-sm text-[var(--ink-black)] hover:bg-white transition-colors disabled:opacity-50"
          >
            {isLoadingReview ? '로딩...' : '🌙 저녁 리뷰'}
          </button>
        )}
      </div>
    </div>
  );
}
