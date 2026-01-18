/**
 * QuestList
 * 오늘의 퀘스트 목록 컴포넌트
 */

import { NotebookPage, SubjectAccordion } from '../../../components/notebook';
import type { QuestWithPlan } from '../../../stores/questStore';

interface QuestListProps {
  quests: QuestWithPlan[];
  selectedDate: string;
  isToday: boolean;
  onToggleComplete: (planId: string, questId: string) => void;
  onGoToToday: () => void;
}

export function QuestList({
  quests,
  selectedDate,
  isToday,
  onToggleComplete,
  onGoToToday,
}: QuestListProps) {
  const title = isToday
    ? "📝 오늘의 퀘스트"
    : `📝 ${selectedDate.slice(5).replace('-', '/')} 퀘스트`;

  return (
    <NotebookPage title={title} decoration="holes">
      {quests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[var(--pencil-gray)]">
            이 날짜에 예정된 퀘스트가 없어요
          </p>
          {!isToday && (
            <button
              onClick={onGoToToday}
              className="text-[var(--ink-blue)] text-sm mt-2 hover:underline"
            >
              오늘로 돌아가기
            </button>
          )}
        </div>
      ) : (
        <SubjectAccordion
          quests={quests}
          onToggle={onToggleComplete}
          groupBy="planName"
        />
      )}
    </NotebookPage>
  );
}
