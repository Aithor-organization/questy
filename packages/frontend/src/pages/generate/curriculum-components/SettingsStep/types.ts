/**
 * SettingsStep 타입 정의
 */

import type { SubjectRatio, SubjectHours, SubjectDays, CurriculumOptions } from '../../../../types/curriculum';

export interface SettingsStepProps {
  targetDate: string;
  subjectRatio: SubjectRatio;
  subjectHours: SubjectHours;
  subjectDays: SubjectDays;
  curriculumOptions: CurriculumOptions;
  onTargetDateChange: (date: string) => void;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  onSubjectHoursChange: (hours: SubjectHours) => void;
  onSubjectDaysChange: (days: SubjectDays) => void;
  onCurriculumOptionsChange: (options: CurriculumOptions) => void;
  onNext: () => void;
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const TARGET_DATE_PRESETS = [
  { label: '3모', date: '2026-03-24', variant: 'default' },
  { label: '6모', date: '2026-06-04', variant: 'default' },
  { label: '9모', date: '2026-09-02', variant: 'default' },
  { label: '수능', date: '2026-11-19', variant: 'highlight' },
] as const;
