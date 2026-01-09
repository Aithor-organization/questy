/**
 * PlanDetailModal Component
 * 플랜 상세 보기 모달
 */

import type { GeneratedPlan } from '../../../hooks/useQuestGeneration';

interface PlanDetailModalProps {
  plan: GeneratedPlan;
  onClose: () => void;
  onSave: (plan: GeneratedPlan) => void;
}

export function PlanDetailModal({ plan, onClose, onSave }: PlanDetailModalProps) {
  const lastQuest = plan.dailyQuests[plan.dailyQuests.length - 1];
  const endDateFormatted = lastQuest
    ? new Date(lastQuest.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-[var(--paper-cream)]">
          <div className="flex items-center justify-between">
            <h2 className="handwrite text-2xl text-[var(--ink-black)]">
              {plan.planName}
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)] text-xl"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">{plan.description}</p>

          {/* 요약 정보 */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="sticker sticker-mint">{plan.totalDays}일</span>
            <span className="sticker sticker-gold">⏱ {plan.totalEstimatedHours}시간</span>
            {endDateFormatted && (
              <span className="sticker sticker-pink">🏁 {endDateFormatted} 완료</span>
            )}
          </div>
        </div>

        {/* 퀘스트 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {plan.dailyQuests.map((quest, index) => {
              const questDate = new Date(quest.date);
              const dayName = questDate.toLocaleDateString('ko-KR', { weekday: 'short' });
              const dateStr = questDate.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
              const isWeekend = questDate.getDay() === 0 || questDate.getDay() === 6;

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    isWeekend
                      ? 'bg-[var(--highlight-pink)] border-pink-200'
                      : 'bg-[var(--paper-cream)] border-[var(--paper-lines)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isWeekend
                            ? 'bg-pink-200 text-pink-700'
                            : 'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
                        }`}
                      >
                        Day {quest.day}
                      </span>
                      <span className="text-xs text-[var(--pencil-gray)]">
                        {dateStr} ({dayName})
                      </span>
                    </div>
                    <span className="text-xs text-[var(--pencil-gray)]">
                      ⏱ {quest.estimatedMinutes}분
                    </span>
                  </div>

                  <h4 className="font-medium text-[var(--ink-black)] text-sm">
                    {quest.unitNumber}단원: {quest.unitTitle}
                  </h4>
                  <p className="text-xs text-[var(--pencil-gray)] mt-1">
                    📖 {quest.range}
                  </p>

                  {quest.topics && quest.topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {quest.topics.slice(0, 3).map((topic, i) => (
                        <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border">
                          {topic}
                        </span>
                      ))}
                      {quest.topics.length > 3 && (
                        <span className="text-xs text-[var(--pencil-gray)]">
                          +{quest.topics.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {quest.tip && (
                    <p className="mt-2 text-xs text-[var(--ink-blue)] bg-[var(--highlight-blue)] p-2 rounded">
                      💡 {quest.tip}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 (버튼) */}
        <div className="p-4 border-t bg-white flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)]"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onSave(plan);
              onClose();
            }}
            className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-opacity-90"
          >
            ✓ 이 플랜 선택하기
          </button>
        </div>
      </div>
    </div>
  );
}
