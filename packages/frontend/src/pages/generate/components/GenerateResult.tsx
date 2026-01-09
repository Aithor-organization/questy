/**
 * GenerateResult Component
 * 퀘스트 생성 결과 화면
 */

import { NotebookPage } from '../../../components/notebook';
import type { GeneratedPlan, GenerateResult as GenerateResultType } from '../../../hooks/useQuestGeneration';

interface GenerateResultProps {
  result: GenerateResultType;
  onViewPlan: (plan: GeneratedPlan) => void;
  onReset: () => void;
}

export function GenerateResult({ result, onViewPlan, onReset }: GenerateResultProps) {
  return (
    <NotebookPage title="🎉 퀘스트 완성!" decoration="tape">
      {/* AI 메시지 */}
      {result.aiMessage && (
        <div className="postit mb-6">
          <p className="text-sm">💬 {result.aiMessage}</p>
        </div>
      )}

      {/* 생성된 플랜들 */}
      <div className="space-y-4">
        {result.plans.map((plan, index) => {
          const endDate = plan.dailyQuests.length > 0
            ? plan.dailyQuests[plan.dailyQuests.length - 1].date
            : null;
          const endDateFormatted = endDate
            ? new Date(endDate).toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })
            : null;

          return (
            <div
              key={index}
              className="notebook-page p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onViewPlan(plan)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="handwrite text-xl text-[var(--ink-black)]">
                  {plan.planName}
                </h3>
                <span className="sticker sticker-mint">{plan.totalDays}일</span>
              </div>
              <p className="text-sm text-[var(--pencil-gray)] mb-3">
                {plan.description}
              </p>

              {endDateFormatted && (
                <div className="mb-3 p-2 bg-[var(--highlight-blue)] rounded-lg">
                  <p className="text-sm text-[var(--ink-blue)] font-medium">
                    🏁 완료 예정: {endDateFormatted}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[var(--pencil-gray)]">
                <span>📚 {plan.dailyQuests.length}개 퀘스트</span>
                <span>⏱ 약 {plan.totalEstimatedHours}시간</span>
              </div>

              {/* 미리보기 */}
              <div className="mt-4 p-3 bg-[var(--paper-cream)] rounded-lg">
                <p className="text-xs text-[var(--pencil-gray)] mb-2">미리보기</p>
                {plan.dailyQuests.slice(0, 3).map((quest, qIndex) => (
                  <div key={qIndex} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded border border-[var(--paper-lines)] flex-shrink-0" />
                    <span className="truncate">
                      Day {quest.day}: {quest.unitTitle}
                    </span>
                  </div>
                ))}
                {plan.dailyQuests.length > 3 && (
                  <p className="text-xs text-[var(--pencil-gray)] mt-1">
                    +{plan.dailyQuests.length - 3}개 더...
                  </p>
                )}
              </div>

              <button className="w-full mt-4 py-2 bg-[var(--ink-blue)] text-white rounded-lg text-sm hover:bg-opacity-90 transition-colors">
                자세히 보기
              </button>
            </div>
          );
        })}
      </div>

      {/* 다시 만들기 */}
      <button
        onClick={onReset}
        className="w-full mt-4 py-3 text-[var(--ink-blue)] hover:underline text-sm"
      >
        ← 다시 만들기
      </button>
    </NotebookPage>
  );
}
