/**
 * SettingsStep
 * 커리큘럼 생성 1단계: 설정 메인 컴포넌트
 */

import { TargetDateSection } from './TargetDateSection';
import { SubjectHoursSection } from './SubjectHoursSection';
import { ExtraDaysSection } from './ExtraDaysSection';
import type { SettingsStepProps } from './types';

export function SettingsStep(props: SettingsStepProps) {
  const {
    targetDate,
    subjectRatio,
    subjectHours,
    subjectDays,
    curriculumOptions,
    onTargetDateChange,
    onSubjectRatioChange,
    onSubjectHoursChange,
    onSubjectDaysChange,
    onCurriculumOptionsChange,
    onNext,
  } = props;

  const hasAtLeastOneSubject = Object.values(subjectHours).some(h => h !== null && h > 0);
  const defaultTargetDate = () => new Date().toISOString().split('T')[0];

  const handleNext = () => {
    if (!targetDate) {
      onTargetDateChange(defaultTargetDate());
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <TargetDateSection
        targetDate={targetDate}
        onTargetDateChange={onTargetDateChange}
      />

      <SubjectHoursSection
        subjectRatio={subjectRatio}
        subjectHours={subjectHours}
        subjectDays={subjectDays}
        onSubjectRatioChange={onSubjectRatioChange}
        onSubjectHoursChange={onSubjectHoursChange}
        onSubjectDaysChange={onSubjectDaysChange}
      />

      <ExtraDaysSection
        curriculumOptions={curriculumOptions}
        onCurriculumOptionsChange={onCurriculumOptionsChange}
      />

      <button
        onClick={handleNext}
        disabled={!hasAtLeastOneSubject}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
      >
        {!hasAtLeastOneSubject ? '⚠️ 최소 1개 과목 시간을 입력해주세요' : '다음: 강좌 선택 →'}
      </button>
    </div>
  );
}
