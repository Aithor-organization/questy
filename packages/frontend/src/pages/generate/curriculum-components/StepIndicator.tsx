/**
 * StepIndicator
 * 커리큘럼 생성 단계 표시 컴포넌트
 */

export type Step = 'settings' | 'courses' | 'preview';

interface StepIndicatorProps {
  step: number;
  current: Step;
  target: Step;
  label: string;
}

export function StepIndicator({ step, current, target, label }: StepIndicatorProps) {
  const isActive = current === target;
  const isPast =
    (target === 'settings') ||
    (target === 'courses' && current === 'preview');

  return (
    <div className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[var(--ink-blue)] text-white'
        : isPast
          ? 'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
          : 'bg-gray-100 text-gray-400'
    }`}>
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0">
        {step}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

export function StepIndicatorBar({
  currentStep,
  onStepChange,
}: {
  currentStep: Step;
  onStepChange: (step: Step) => void;
}) {
  return (
    <div className="flex gap-2 justify-center mb-6">
      <button onClick={() => onStepChange('settings')}>
        <StepIndicator step={1} current={currentStep} target="settings" label="설정" />
      </button>
      <button onClick={() => onStepChange('courses')}>
        <StepIndicator step={2} current={currentStep} target="courses" label="강좌선택" />
      </button>
      <button onClick={() => onStepChange('preview')}>
        <StepIndicator step={3} current={currentStep} target="preview" label="미리보기" />
      </button>
    </div>
  );
}
