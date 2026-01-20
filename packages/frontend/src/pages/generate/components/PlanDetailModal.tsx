/**
 * PlanDetailModal Component
 * 플랜 상세 보기 모달 - 시작 지점 선택 기능 포함
 */

import { useState, useMemo } from 'react';
import type { GeneratedPlan, DailyQuest } from '../../../hooks/useQuestGeneration';
import { ALL_DAYS, DAY_TO_JS_DAY, formatDate, type DayOfWeek } from '@questybook/shared';

interface PlanDetailModalProps {
  plan: GeneratedPlan;
  onClose: () => void;
  onSave: (plan: GeneratedPlan) => void;
  selectedDays?: DayOfWeek[]; // 선택된 요일 (없으면 모든 요일)
}

/**
 * 선택된 요일에 맞춰 오늘부터 날짜를 계산합니다
 */
function getNextDateForSelectedDays(
  baseDate: Date,
  questIndex: number,
  selectedDays: DayOfWeek[]
): Date {
  // 모든 요일이 선택된 경우 연속 날짜
  if (selectedDays.length === 0 || selectedDays.length === 7) {
    const result = new Date(baseDate);
    result.setDate(baseDate.getDate() + questIndex);
    return result;
  }

  // 선택된 요일의 JS Day 값으로 변환 (0=일, 6=토)
  const allowedJsDays = new Set(selectedDays.map(d => DAY_TO_JS_DAY[d]));

  // questIndex번째 허용된 날짜를 찾음
  let daysToAdd = 0;
  let matchedCount = 0;

  while (matchedCount <= questIndex) {
    const checkDate = new Date(baseDate);
    checkDate.setDate(baseDate.getDate() + daysToAdd);

    if (allowedJsDays.has(checkDate.getDay())) {
      if (matchedCount === questIndex) {
        return checkDate;
      }
      matchedCount++;
    }
    daysToAdd++;
  }

  // 폴백
  const result = new Date(baseDate);
  result.setDate(baseDate.getDate() + questIndex);
  return result;
}


export function PlanDetailModal({ plan, onClose, onSave, selectedDays = [...ALL_DAYS] }: PlanDetailModalProps) {
  // 시작 지점 선택 상태 (null이면 처음부터, 숫자면 해당 Day부터 시작)
  const [startFromDay, setStartFromDay] = useState<number | null>(null);

  // 항상 오늘부터 날짜 재계산 + 시작 지점 선택 시 해당 Day부터 추출
  const filteredPlan = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 시작 지점이 선택되면 해당 Day부터만 추출
    const filteredQuests = startFromDay === null
      ? plan.dailyQuests
      : plan.dailyQuests.filter(q => q.day >= startFromDay);

    // Day 번호 재정렬 (1부터 시작) + 오늘부터 날짜 재배치
    const renumberedQuests: DailyQuest[] = filteredQuests.map((quest, index) => {
      const newDate = getNextDateForSelectedDays(today, index, selectedDays);
      return {
        ...quest,
        day: index + 1,
        date: formatDate(newDate),
      };
    });

    // 총 예상 시간 재계산
    const totalMinutes = renumberedQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

    return {
      ...plan,
      dailyQuests: renumberedQuests,
      totalDays: renumberedQuests.length,
      totalEstimatedHours: Math.round(totalMinutes / 60),
    };
  }, [plan, startFromDay, selectedDays]);

  const lastQuest = filteredPlan.dailyQuests[filteredPlan.dailyQuests.length - 1];
  const endDateFormatted = lastQuest
    ? new Date(lastQuest.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-[var(--paper-cream)]">
          <div className="flex items-center justify-between">
            <h2 className="handwrite text-2xl text-[var(--ink-black)]">
              {plan.planName}
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)] text-xl"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">{plan.description}</p>

          {/* 요약 정보 */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="sticker sticker-mint">{filteredPlan.totalDays}일</span>
            <span className="sticker sticker-gold">⏱ {filteredPlan.totalEstimatedHours}시간</span>
            {endDateFormatted && (
              <span className="sticker sticker-pink">🏁 {endDateFormatted} 완료</span>
            )}
          </div>

          {/* 시작 지점 선택 안내 */}
          {startFromDay === null && plan.dailyQuests.length > 1 && (
            <div className="mt-3 p-2 bg-[var(--highlight-green)] rounded-lg">
              <p className="text-xs text-[var(--ink-black)]">
                💡 이미 일부를 학습했다면, 아래에서 시작할 Day를 클릭하세요
              </p>
            </div>
          )}

          {/* 선택된 시작 지점 표시 */}
          {startFromDay !== null && (
            <div className="mt-3 p-2 bg-[var(--highlight-blue)] rounded-lg flex items-center justify-between">
              <p className="text-xs text-[var(--ink-blue)]">
                📍 Day {startFromDay}부터 시작 ({plan.dailyQuests.length - startFromDay + 1}일로 조정됨)
              </p>
              <button
                onClick={() => setStartFromDay(null)}
                className="text-xs text-[var(--ink-blue)] underline hover:no-underline"
              >
                처음부터
              </button>
            </div>
          )}
        </div>

        {/* 퀘스트 목록 - 오늘부터 재계산된 날짜로 표시 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredPlan.dailyQuests.map((quest, index) => {
              const questDate = new Date(quest.date);
              const dayName = questDate.toLocaleDateString('ko-KR', { weekday: 'short' });
              const dateStr = questDate.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
              const isWeekend = questDate.getDay() === 0 || questDate.getDay() === 6;
              const isFirstQuest = index === 0;

              // 원본 플랜에서 해당 퀘스트의 원래 Day 번호 찾기 (시작 지점 선택용)
              const originalDay = plan.dailyQuests.find(
                q => q.unitNumber === quest.unitNumber && q.unitTitle === quest.unitTitle
              )?.day || quest.day;

              return (
                <div
                  key={index}
                  onClick={() => {
                    // 시작 지점 미선택 상태에서, 첫 번째 Day가 아닌 퀘스트 클릭 시 시작 지점으로 설정
                    if (startFromDay === null && originalDay > 1) {
                      setStartFromDay(originalDay);
                    }
                  }}
                  className={`p-3 rounded-lg border transition-all ${
                    isFirstQuest && startFromDay !== null
                      ? 'bg-[var(--highlight-green)] border-green-300 ring-2 ring-green-400'
                      : isWeekend
                        ? 'bg-[var(--highlight-pink)] border-pink-200'
                        : 'bg-[var(--paper-cream)] border-[var(--paper-lines)]'
                  } ${startFromDay === null && originalDay > 1 ? 'cursor-pointer hover:ring-2 hover:ring-[var(--ink-blue)] hover:ring-opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          isFirstQuest && startFromDay !== null
                            ? 'bg-green-200 text-green-700'
                            : isWeekend
                              ? 'bg-pink-200 text-pink-700'
                              : 'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
                        }`}
                      >
                        {isFirstQuest && startFromDay !== null ? '🚀 시작' : `Day ${quest.day}`}
                      </span>
                      <span className="text-xs text-[var(--pencil-gray)]">
                        {dateStr} ({dayName})
                      </span>
                    </div>
                    <span className="text-xs text-[var(--pencil-gray)]">
                      ⏱ {quest.estimatedMinutes}분
                    </span>
                  </div>

                  <h4 className="font-medium text-[var(--ink-black)] text-sm">
                    {quest.unitNumber}단원: {quest.unitTitle}
                  </h4>
                  <p className="text-xs text-[var(--pencil-gray)] mt-1">
                    📖 {quest.range}
                  </p>

                  {quest.topics && quest.topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {quest.topics.slice(0, 3).map((topic, i) => (
                        <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border">
                          {topic}
                        </span>
                      ))}
                      {quest.topics.length > 3 && (
                        <span className="text-xs text-[var(--pencil-gray)]">
                          +{quest.topics.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {quest.tip && (
                    <p className="mt-2 text-xs text-[var(--ink-blue)] bg-[var(--highlight-blue)] p-2 rounded">
                      💡 {quest.tip}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 (버튼) */}
        <div className="p-4 border-t bg-white flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)]"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onSave(filteredPlan);
              onClose();
            }}
            className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-opacity-90"
          >
            {startFromDay !== null
              ? `✓ Day ${startFromDay}부터 시작`
              : '✓ 이 플랜 선택하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
