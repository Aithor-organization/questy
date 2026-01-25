/**
 * PreviewStep 컴포넌트 타입 정의
 * 커리큘럼 미리보기 단계에서 사용되는 모든 타입
 */

import type { CurriculumReviewResult } from '../../../../types/curriculum';

/**
 * 퀘스트 미리보기 아이템 타입
 */
export interface PreviewQuest {
  id: string;
  title: string;
  description: string;
  questType: string;
  subject: string;
  scheduledDate: string;
  estimatedMinutes: number;
  editable?: boolean;
  practiceNote?: string;
  relatedLectures?: string[];
}

/**
 * 시간 분배 타입
 */
export interface TimeByType {
  lectureMinutes: number;
  reviewMinutes: number;
  practiceMinutes: number;
  totalMinutes: number;
}

/**
 * 제외된 과목 정보
 */
export interface SkippedSubjectInfo {
  subject: string;
  hours: number;
  reason: string;
}

/**
 * 생성 결과 요약 타입
 */
export interface PreviewSummary {
  totalQuests: number;
  totalDays: number;
  averageMinutesPerDay: number;
  subjectDistribution: Record<string, number>;
  timeByType?: TimeByType;
  skippedSubjects?: SkippedSubjectInfo[] | null;
}

/**
 * PreviewStep 메인 컴포넌트 Props
 */
export interface PreviewStepProps {
  quests: PreviewQuest[];
  summary: PreviewSummary | null;
  review?: CurriculumReviewResult | null;
  isLoading: boolean;
  error?: Error | null;
  onBack: () => void;
  onConfirm: () => void;
  onUpdatePracticeNote?: (questId: string, note: string) => void;
  dailyStudyHours: number;
  showTimeExceededWarning: boolean;
  requiredHoursPerDay: number;
  onAdjustHours: (hours: number) => void;
  onDismissWarning: () => void;
}

/**
 * SummarySection 컴포넌트 Props
 */
export interface SummarySectionProps {
  summary: PreviewSummary;
}

/**
 * SkippedSubjectsAlert 컴포넌트 Props
 */
export interface SkippedSubjectsAlertProps {
  skippedSubjects: SkippedSubjectInfo[];
}

/**
 * TimeWarningSection 컴포넌트 Props
 */
export interface TimeWarningSectionProps {
  dailyStudyHours: number;
  averageMinutesPerDay: number;
  requiredHoursPerDay: number;
  onAdjustHours: (hours: number) => void;
  onDismissWarning: () => void;
}

/**
 * QuestPreviewCard 컴포넌트 Props
 */
export interface QuestPreviewCardProps {
  quest: PreviewQuest;
  editingNoteId: string | null;
  editingNoteValue: string;
  onStartEditingNote: (questId: string, currentNote: string) => void;
  onSaveNote: (questId: string) => void;
  onCancelEditingNote: () => void;
  onNoteValueChange: (value: string) => void;
}

/**
 * DayQuestsGroup 컴포넌트 Props
 */
export interface DayQuestsGroupProps {
  date: string;
  quests: PreviewQuest[];
  editingNoteId: string | null;
  editingNoteValue: string;
  onStartEditingNote: (questId: string, currentNote: string) => void;
  onSaveNote: (questId: string) => void;
  onCancelEditingNote: () => void;
  onNoteValueChange: (value: string) => void;
}
