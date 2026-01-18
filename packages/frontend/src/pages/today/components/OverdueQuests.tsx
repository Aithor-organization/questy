/**
 * OverdueQuests
 * 미완료 퀘스트 섹션 컴포넌트
 */

import { DEFAULT_ROOM_ID } from '../../../stores/chatStore';
import type { QuestWithPlan } from '../../../stores/questStore';
import type { OverduePlanGroup } from '../types';

interface OverdueQuestsProps {
  overdueQuests: QuestWithPlan[];
  overdueByPlan: OverduePlanGroup[];
  onRescheduleToToday: (quest: QuestWithPlan) => void;
  onOpenRescheduleModal: (quest: QuestWithPlan) => void;
  onOpenBulkRescheduleModal: (planId: string) => void;
  onNavigate: (path: string, options?: { state?: Record<string, unknown> }) => void;
}

export function OverdueQuests({
  overdueQuests,
  overdueByPlan,
  onRescheduleToToday,
  onOpenRescheduleModal,
  onOpenBulkRescheduleModal,
  onNavigate,
}: OverdueQuestsProps) {
  if (overdueQuests.length === 0) return null;

  return (
    <div className="notebook-page-lined p-4 bg-[var(--highlight-pink)] mb-4 rounded-lg border-l-4 border-[var(--sticker-coral)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏰</span>
          <h3 className="font-semibold text-[var(--ink-black)]">
            미완료 퀘스트 ({overdueQuests.length}개)
          </h3>
        </div>
        {overdueByPlan.length === 1 && (
          <button
            onClick={() => onOpenBulkRescheduleModal(overdueByPlan[0].planId)}
            className="text-xs px-3 py-1 bg-[var(--ink-blue)] text-white rounded-full hover:bg-blue-600 transition-colors"
          >
            🧠 전체 재조정
          </button>
        )}
      </div>

      <div className="space-y-3">
        {overdueByPlan.map((planGroup) => (
          <div key={planGroup.planId} className="bg-white/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--ink-black)]">
                📚 {planGroup.planName}
              </span>
              {overdueByPlan.length > 1 && (
                <button
                  onClick={() => onOpenBulkRescheduleModal(planGroup.planId)}
                  className="text-xs px-2 py-1 bg-[var(--sticker-mint)] text-white rounded hover:bg-emerald-500"
                >
                  재조정
                </button>
              )}
            </div>
            <div className="space-y-2">
              {planGroup.quests.slice(0, 3).map((quest) => (
                <div
                  key={quest.id}
                  className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0 flex items-center">
                    <span className="text-[var(--pencil-gray)] mr-2 flex-shrink-0">
                      {quest.date.slice(5).replace('-', '/')}
                    </span>
                    <span className="text-[var(--ink-black)] truncate block">
                      {quest.unitTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => onRescheduleToToday(quest)}
                      className="text-xs px-2 py-1 bg-[var(--ink-blue)] text-white rounded hover:bg-blue-600"
                    >
                      오늘
                    </button>
                    <button
                      onClick={() => onOpenRescheduleModal(quest)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                    >
                      📅
                    </button>
                  </div>
                </div>
              ))}
              {planGroup.quests.length > 3 && (
                <p className="text-xs text-[var(--pencil-gray)] text-center py-1">
                  +{planGroup.quests.length - 3}개 더...
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--sticker-coral)]/30">
        <button
          onClick={() => {
            const message = `밀린 퀘스트 ${overdueQuests.length}개를 어떻게 처리하면 좋을까요?`;
            // navigate 시 state로 메시지 전달 → ChatRoomPage에서 자동 전송
            onNavigate('/chat/' + DEFAULT_ROOM_ID, { state: { autoSendMessage: message } });
          }}
          className="w-full py-2 text-sm text-[var(--ink-blue)] hover:underline"
        >
          💬 AI 코치에게 일정 조언 받기
        </button>
      </div>
    </div>
  );
}
