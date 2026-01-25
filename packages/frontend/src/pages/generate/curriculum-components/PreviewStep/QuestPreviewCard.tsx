/**
 * QuestPreviewCard
 * 개별 퀘스트 미리보기 카드 컴포넌트
 * 강의/복습/문제풀이 퀘스트를 타입에 따라 다르게 렌더링
 */

import type { QuestPreviewCardProps } from './types';

/**
 * 퀘스트 타입별 스타일 반환
 */
const getQuestTypeStyle = (questType: string) => {
  switch (questType) {
    case 'lecture':
      return 'bg-blue-100 text-blue-700';
    case 'review':
      return 'bg-green-100 text-green-700';
    case 'practice':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

/**
 * 퀘스트 타입별 아이콘 반환
 */
const getQuestTypeIcon = (questType: string) => {
  switch (questType) {
    case 'lecture':
      return '📺';
    case 'review':
      return '📝';
    case 'practice':
      return '✏️';
    default:
      return '📋';
  }
};

/**
 * 문제풀이 퀘스트 전용 카드
 */
function PracticeQuestCard({
  quest,
  editingNoteId,
  editingNoteValue,
  onStartEditingNote,
  onSaveNote,
  onCancelEditingNote,
  onNoteValueChange,
}: QuestPreviewCardProps) {
  const isEditing = editingNoteId === quest.id;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
            ✏️ {quest.subject}
          </span>
          <span className="text-sm font-medium">{quest.title}</span>
        </div>
        <span className="text-xs text-gray-500">{quest.estimatedMinutes}분</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">{quest.description}</div>
      {quest.relatedLectures && quest.relatedLectures.length > 0 && (
        <div className="text-xs text-orange-600 mt-1">
          📚 관련: {quest.relatedLectures.join(', ')}
        </div>
      )}
      {quest.editable && (
        <div className="mt-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingNoteValue}
                onChange={(e) => onNoteValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveNote(quest.id);
                  if (e.key === 'Escape') onCancelEditingNote();
                }}
                placeholder="예: 수특 독서 1강 문제 풀기"
                className="flex-1 text-xs px-2 py-1 border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
                autoFocus
              />
              <button
                onClick={() => onSaveNote(quest.id)}
                className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                저장
              </button>
              <button
                onClick={onCancelEditingNote}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          ) : (
            <div
              onClick={() => onStartEditingNote(quest.id, quest.practiceNote || '')}
              className="flex items-center gap-1 cursor-pointer hover:bg-orange-100 rounded px-1 py-0.5 transition-colors"
            >
              <span className="text-xs text-gray-400">메모:</span>
              <span className={`text-xs flex-1 ${quest.practiceNote ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                {quest.practiceNote || '클릭하여 메모 추가'}
              </span>
              <span className="text-xs text-orange-400">✏️</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 일반 퀘스트 카드 (강의, 복습 등)
 */
function StandardQuestCard({ quest }: { quest: QuestPreviewCardProps['quest'] }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`text-xs px-1.5 py-0.5 rounded ${getQuestTypeStyle(quest.questType)}`}>
        {getQuestTypeIcon(quest.questType)} {quest.subject}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{quest.title}</div>
        <div className="text-xs text-gray-500">{quest.estimatedMinutes}분</div>
      </div>
    </div>
  );
}

/**
 * 퀘스트 미리보기 카드 메인 컴포넌트
 */
export function QuestPreviewCard(props: QuestPreviewCardProps) {
  const { quest } = props;

  if (quest.questType === 'practice') {
    return <PracticeQuestCard {...props} />;
  }

  return <StandardQuestCard quest={quest} />;
}
