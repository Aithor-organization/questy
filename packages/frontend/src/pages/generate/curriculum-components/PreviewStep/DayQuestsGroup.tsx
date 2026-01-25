/**
 * DayQuestsGroup
 * 날짜별 퀘스트 그룹 컴포넌트
 * 하루 단위로 퀘스트들을 묶어서 표시
 */

import { QuestPreviewCard } from './QuestPreviewCard';
import type { DayQuestsGroupProps } from './types';

/**
 * 날짜별 퀘스트 그룹
 */
export function DayQuestsGroup({
  date,
  quests,
  editingNoteId,
  editingNoteValue,
  onStartEditingNote,
  onSaveNote,
  onCancelEditingNote,
  onNoteValueChange,
}: DayQuestsGroupProps) {
  const totalMinutes = quests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

  return (
    <div className="notebook-card p-3">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-500">{date}</div>
        <div className="text-xs text-gray-400">
          {quests.length}개 · {totalMinutes}분
        </div>
      </div>
      {quests.map((quest) => (
        <div key={quest.id} className="mb-2 last:mb-0">
          <QuestPreviewCard
            quest={quest}
            editingNoteId={editingNoteId}
            editingNoteValue={editingNoteValue}
            onStartEditingNote={onStartEditingNote}
            onSaveNote={onSaveNote}
            onCancelEditingNote={onCancelEditingNote}
            onNoteValueChange={onNoteValueChange}
          />
        </div>
      ))}
    </div>
  );
}
