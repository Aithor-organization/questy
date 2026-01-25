/**
 * TimeWarningSection
 * 일일 학습 시간 초과 경고 및 조정 UI
 * 학습 시간 설정이 목표에 미달할 때 표시
 */

import type { TimeWarningSectionProps } from './types';

/**
 * 시간 조정 슬라이더 컴포넌트
 */
function TimeAdjustmentSlider({
  dailyStudyHours,
  onAdjustHours,
}: Pick<TimeWarningSectionProps, 'dailyStudyHours' | 'onAdjustHours'>) {
  return (
    <div className="bg-white rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">일일 학습 시간 조정</span>
        <span className="text-lg font-bold text-red-600">{dailyStudyHours}시간</span>
      </div>
      <input
        type="range"
        min="10"
        max="14"
        value={dailyStudyHours}
        onChange={(e) => onAdjustHours(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>10시간</span>
        <span>12시간</span>
        <span>14시간 (최대)</span>
      </div>
    </div>
  );
}

/**
 * 시간 초과 경고 메시지
 */
function WarningMessage({
  dailyStudyHours,
  averageMinutesPerDay,
  requiredHoursPerDay,
}: Pick<TimeWarningSectionProps, 'dailyStudyHours' | 'averageMinutesPerDay' | 'requiredHoursPerDay'>) {
  return (
    <>
      <h4 className="font-medium text-red-800 mb-2">⏰ 일일 학습 시간 초과</h4>
      <p className="text-sm text-red-700 mb-3">
        현재 설정된 일일 학습 시간(<strong>{dailyStudyHours}시간</strong>)으로는
        목표일까지 커리큘럼을 완료하기 어렵습니다.
      </p>
      <p className="text-sm text-red-700 mb-3">
        일평균 <strong>{averageMinutesPerDay}분</strong>이 필요하며,
        최소 <strong>{requiredHoursPerDay}시간</strong>으로 조정하는 것을 권장합니다.
      </p>
    </>
  );
}

/**
 * 조정 액션 버튼들
 */
function ActionButtons({
  requiredHoursPerDay,
  onAdjustHours,
  onDismissWarning,
}: Pick<TimeWarningSectionProps, 'requiredHoursPerDay' | 'onAdjustHours' | 'onDismissWarning'>) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onAdjustHours(requiredHoursPerDay)}
        className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
      >
        {requiredHoursPerDay}시간으로 조정
      </button>
      <button
        onClick={onDismissWarning}
        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
      >
        현재 설정 유지
      </button>
    </div>
  );
}

/**
 * 시간 초과 경고 섹션 메인 컴포넌트
 */
export function TimeWarningSection(props: TimeWarningSectionProps) {
  const {
    dailyStudyHours,
    averageMinutesPerDay,
    requiredHoursPerDay,
    onAdjustHours,
    onDismissWarning,
  } = props;

  return (
    <div className="notebook-card p-4 bg-red-50 border-red-200">
      <WarningMessage
        dailyStudyHours={dailyStudyHours}
        averageMinutesPerDay={averageMinutesPerDay}
        requiredHoursPerDay={requiredHoursPerDay}
      />
      <TimeAdjustmentSlider
        dailyStudyHours={dailyStudyHours}
        onAdjustHours={onAdjustHours}
      />
      <ActionButtons
        requiredHoursPerDay={requiredHoursPerDay}
        onAdjustHours={onAdjustHours}
        onDismissWarning={onDismissWarning}
      />
      <p className="text-xs text-red-500 mt-2">
        💡 시간을 늘리면 더 많은 학습량을 하루에 소화해야 합니다.
      </p>
    </div>
  );
}

/**
 * 정상 시간 상태 표시 (경고 없음)
 */
export function TimeStatusOk({ dailyStudyHours }: { dailyStudyHours: number }) {
  return (
    <div className="notebook-card p-3 bg-green-50 border-green-200">
      <div className="flex items-center justify-between">
        <span className="text-sm text-green-700">
          ✅ 일일 학습 시간: <strong>{dailyStudyHours}시간</strong>
        </span>
        <span className="text-xs text-green-600">여유롭게 학습 가능합니다</span>
      </div>
    </div>
  );
}
