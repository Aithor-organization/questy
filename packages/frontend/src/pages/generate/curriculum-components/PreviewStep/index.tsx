/**
 * PreviewStep
 * 커리큘럼 미리보기 단계 메인 컴포넌트
 * 생성된 퀘스트를 날짜별로 미리보기하고 확정하는 UI
 */

import { useState, useMemo } from 'react';
import { AIReviewCard } from '../AIReviewCard';
import { SummarySection, SkippedSubjectsAlert } from './SummarySection';
import { TimeWarningSection, TimeStatusOk } from './TimeWarningSection';
import { DayQuestsGroup } from './DayQuestsGroup';
import { LoadingState, EmptyState, DailyCurriculumHeader, ActionButtons } from './PreviewStates';
import type { PreviewStepProps, PreviewQuest } from './types';

/**
 * 퀘스트를 날짜별로 그룹화
 */
function groupQuestsByDate(quests: PreviewQuest[]): Record<string, PreviewQuest[]> {
  return quests.reduce((acc, quest) => {
    const date = quest.scheduledDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(quest);
    return acc;
  }, {} as Record<string, PreviewQuest[]>);
}

/**
 * PreviewStep 메인 컴포넌트
 * 생성된 커리큘럼을 미리보기하고 확정하는 단계
 */
export function PreviewStep(props: PreviewStepProps) {
  const {
    quests,
    summary,
    review,
    isLoading,
    error,
    onBack,
    onConfirm,
    onUpdatePracticeNote,
    dailyStudyHours,
    showTimeExceededWarning,
    requiredHoursPerDay,
    onAdjustHours,
    onDismissWarning,
  } = props;

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [showDetailedView, setShowDetailedView] = useState(false);

  const questsByDate = useMemo(() => groupQuestsByDate(quests), [quests]);
  const dateEntries = Object.entries(questsByDate);

  const handleStartEditingNote = (questId: string, currentNote: string) => {
    setEditingNoteId(questId);
    setEditingNoteValue(currentNote || '');
  };

  const handleSaveNote = (questId: string) => {
    if (onUpdatePracticeNote) {
      onUpdatePracticeNote(questId, editingNoteValue);
    }
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const handleCancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  // 로딩 상태
  if (isLoading) return <LoadingState />;

  // 빈 결과 상태
  if (quests.length === 0) return <EmptyState error={error} onBack={onBack} />;

  return (
    <div className="space-y-4">
      {/* AI 에이전트 리뷰 결과 */}
      {review && <AIReviewCard review={review} />}

      {/* 생성 결과 요약 */}
      {summary && <SummarySection summary={summary} />}

      {/* 제외된 과목 경고 */}
      {summary?.skippedSubjects && summary.skippedSubjects.length > 0 && (
        <SkippedSubjectsAlert skippedSubjects={summary.skippedSubjects} />
      )}

      {/* 시간 경고 또는 정상 상태 */}
      {showTimeExceededWarning ? (
        <TimeWarningSection
          dailyStudyHours={dailyStudyHours}
          averageMinutesPerDay={summary?.averageMinutesPerDay || 0}
          requiredHoursPerDay={requiredHoursPerDay}
          onAdjustHours={onAdjustHours}
          onDismissWarning={onDismissWarning}
        />
      ) : (
        <TimeStatusOk dailyStudyHours={dailyStudyHours} />
      )}

      {/* 일별 커리큘럼 헤더 */}
      <DailyCurriculumHeader
        totalDays={dateEntries.length}
        showDetailedView={showDetailedView}
        onToggleView={() => setShowDetailedView(!showDetailedView)}
      />

      {/* 일별 퀘스트 목록 */}
      <div className={`space-y-3 overflow-y-auto ${showDetailedView ? 'max-h-[500px]' : 'max-h-80'}`}>
        {dateEntries.slice(0, showDetailedView ? undefined : 5).map(([date, dayQuests]) => (
          <DayQuestsGroup
            key={date}
            date={date}
            quests={dayQuests}
            editingNoteId={editingNoteId}
            editingNoteValue={editingNoteValue}
            onStartEditingNote={handleStartEditingNote}
            onSaveNote={handleSaveNote}
            onCancelEditingNote={handleCancelEditingNote}
            onNoteValueChange={setEditingNoteValue}
          />
        ))}
        {!showDetailedView && dateEntries.length > 5 && (
          <button
            onClick={() => setShowDetailedView(true)}
            className="w-full py-2 text-center text-sm text-[var(--ink-blue)] hover:bg-blue-50 rounded-lg transition-colors"
          >
            + {dateEntries.length - 5}일 더 보기
          </button>
        )}
      </div>

      {/* 하단 액션 버튼 */}
      <ActionButtons onBack={onBack} onConfirm={onConfirm} />
    </div>
  );
}

// Re-export types for external use
export type { PreviewStepProps, PreviewQuest, PreviewSummary } from './types';
