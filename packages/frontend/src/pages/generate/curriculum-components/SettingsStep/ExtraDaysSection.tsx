/**
 * ExtraDaysSection
 * 남는 날 활용 옵션 섹션
 */

import type { CurriculumOptions } from '../../../../types/curriculum';

interface ExtraDaysSectionProps {
  curriculumOptions: CurriculumOptions;
  onCurriculumOptionsChange: (options: CurriculumOptions) => void;
}

export function ExtraDaysSection({
  curriculumOptions,
  onCurriculumOptionsChange,
}: ExtraDaysSectionProps) {
  const updateExtraDaysOption = (key: 'fillWithReview' | 'fillWithPractice', value: boolean) => {
    onCurriculumOptionsChange({
      ...curriculumOptions,
      extraDaysOption: {
        ...curriculumOptions.extraDaysOption,
        enabled: true,
        fillWithReview: key === 'fillWithReview'
          ? value
          : curriculumOptions.extraDaysOption?.fillWithReview ?? true,
        fillWithPractice: key === 'fillWithPractice'
          ? value
          : curriculumOptions.extraDaysOption?.fillWithPractice ?? true,
      },
    });
  };

  return (
    <div className="notebook-card p-4">
      <label className="block text-sm font-medium mb-3">📅 남는 날 활용 옵션</label>
      <p className="text-xs text-gray-500 mb-3">
        강의가 목표일보다 일찍 끝날 경우 남는 날을 어떻게 활용할지 설정하세요
      </p>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={curriculumOptions.extraDaysOption?.fillWithReview ?? true}
            onChange={(e) => updateExtraDaysOption('fillWithReview', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
          />
          <span className="text-sm">📖 복습 퀘스트로 채우기</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={curriculumOptions.extraDaysOption?.fillWithPractice ?? true}
            onChange={(e) => updateExtraDaysOption('fillWithPractice', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
          />
          <span className="text-sm">✏️ 문제풀이 퀘스트로 채우기</span>
        </label>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        💡 둘 다 체크하지 않으면 남는 날은 빈 날로 유지됩니다
      </p>
    </div>
  );
}
