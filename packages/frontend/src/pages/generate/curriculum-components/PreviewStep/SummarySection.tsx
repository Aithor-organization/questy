/**
 * SummarySection
 * 커리큘럼 생성 결과 요약 섹션
 * 총 퀘스트 수, 학습 기간, 시간 분배 등 표시
 */

import type { SummarySectionProps, SkippedSubjectsAlertProps } from './types';

/**
 * 제외된 과목 경고 알림 컴포넌트
 */
export function SkippedSubjectsAlert({ skippedSubjects }: SkippedSubjectsAlertProps) {
  if (!skippedSubjects || skippedSubjects.length === 0) return null;

  return (
    <div className="notebook-card p-4 bg-amber-50 border-amber-200">
      <h4 className="font-medium text-amber-800 mb-2">
        ⚠️ 일부 과목이 커리큘럼에서 제외되었습니다
      </h4>
      <p className="text-sm text-amber-700 mb-2">
        선택된 강좌가 없는 과목의 학습 시간은 자동으로 제외되었습니다.
      </p>
      <ul className="text-sm text-amber-600 space-y-1">
        {skippedSubjects.map((skipped, idx) => (
          <li key={idx}>
            • <strong>{skipped.subject}</strong>: {skipped.hours}시간 (제외됨 - {skipped.reason})
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-600 mt-2">
        💡 해당 과목의 강좌를 추가하면 학습 시간이 반영됩니다.
      </p>
    </div>
  );
}

/**
 * 시간 분배 표시 컴포넌트
 */
function TimeDistribution({ timeByType }: { timeByType: SummarySectionProps['summary']['timeByType'] }) {
  if (!timeByType) return null;

  return (
    <div className="mt-3 pt-3 border-t border-blue-200">
      <div className="text-xs text-gray-600 mb-2">⏱️ 시간 분배</div>
      <div className="flex gap-1.5 text-xs flex-wrap">
        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded whitespace-nowrap">
          📺 {Math.round(timeByType.lectureMinutes / 60)}h
        </span>
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">
          📝 {Math.round(timeByType.reviewMinutes / 60)}h
        </span>
        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded whitespace-nowrap">
          ✏️ {Math.round(timeByType.practiceMinutes / 60)}h
        </span>
      </div>
    </div>
  );
}

/**
 * 요약 통계 그리드
 */
function SummaryStats({ summary }: SummarySectionProps) {
  const totalHours = summary.timeByType
    ? Math.round(summary.timeByType.totalMinutes / 60)
    : Math.round((summary.totalQuests * 45) / 60);

  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        총 퀘스트: <strong>{summary.totalQuests}개</strong>
      </div>
      <div>
        학습 기간: <strong>{summary.totalDays}일</strong>
      </div>
      <div>
        일평균: <strong>{summary.averageMinutesPerDay}분</strong>
      </div>
      <div>
        총 시간: <strong>{totalHours}시간</strong>
      </div>
    </div>
  );
}

/**
 * 생성 결과 요약 섹션 메인 컴포넌트
 */
export function SummarySection({ summary }: SummarySectionProps) {
  return (
    <div className="notebook-card p-4 bg-[var(--highlight-blue)]">
      <h3 className="font-medium mb-2">📊 생성 결과 요약</h3>
      <SummaryStats summary={summary} />
      <TimeDistribution timeByType={summary.timeByType} />
    </div>
  );
}
