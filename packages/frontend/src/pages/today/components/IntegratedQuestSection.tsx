/**
 * IntegratedQuestSection
 * 날짜 헤더와 퀘스트 목록을 하나의 섹션으로 통합
 * - 날짜 네비게이션
 * - 확대된 퀘스트 목록
 */

import { useState, useEffect, useMemo } from 'react';
import type { QuestWithPlan } from '../../../stores/questStore';
import { LargeQuestItem } from './LargeQuestItem';

interface QuestGroup {
  groupKey: string;
  groupName: string;
  quests: QuestWithPlan[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}

interface IntegratedQuestSectionProps {
  quests: QuestWithPlan[];
  selectedDate: string;
  todayStr: string;
  isToday: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onGoToToday: () => void;
  onToggleComplete: (planId: string, questId: string) => void;
}

export function IntegratedQuestSection({
  quests,
  selectedDate,
  todayStr,
  isToday,
  onPrevDay,
  onNextDay,
  onGoToToday,
  onToggleComplete,
}: IntegratedQuestSectionProps) {
  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return {
      month: parseInt(month),
      day: parseInt(day),
      weekday: weekdays[d.getDay()],
    };
  };

  const formatted = formatDate(selectedDate);
  const completed = quests.filter(q => q.completed).length;
  const total = quests.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  // 퀘스트를 그룹별로 분류
  const groups: QuestGroup[] = useMemo(() => {
    const groupMap = new Map<string, QuestWithPlan[]>();

    quests.forEach((quest) => {
      const key = quest.planName || '기타';
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(quest);
    });

    return Array.from(groupMap.entries()).map(([key, groupQuests]) => ({
      groupKey: key,
      groupName: key,
      quests: groupQuests,
      completedCount: groupQuests.filter(q => q.completed).length,
      totalCount: groupQuests.length,
      isComplete: groupQuests.every(q => q.completed),
    }));
  }, [quests]);

  // 펼침 상태 관리 (첫 번째 미완료 그룹 자동 펼침)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const firstIncompleteGroup = groups.find(g => !g.isComplete);
    if (firstIncompleteGroup) {
      setExpandedGroups(new Set([firstIncompleteGroup.groupKey]));
    } else if (groups.length > 0) {
      setExpandedGroups(new Set([groups[0].groupKey]));
    }
  }, [groups.length]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <div className="notebook-page-lined mb-6">
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--paper-lines)]">
        <button
          onClick={onPrevDay}
          className="p-2 hover:bg-[var(--highlight-yellow)] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--pencil-gray)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center flex-1">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="handwrite text-2xl text-[var(--ink-black)]">
              {formatted.month}월 {formatted.day}일
            </span>
            <span className="text-sm text-[var(--pencil-gray)]">
              ({formatted.weekday})
            </span>
          </div>
          {isToday ? (
            <span className="sticker sticker-gold text-xs mt-0.5 inline-block">
              오늘
            </span>
          ) : (
            <button
              onClick={onGoToToday}
              className="text-xs text-[var(--ink-blue)] hover:underline mt-0.5"
            >
              오늘로 이동
            </button>
          )}
        </div>

        <button
          onClick={onNextDay}
          className="p-2 hover:bg-[var(--highlight-yellow)] rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--pencil-gray)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 진행률 바 */}
      {total > 0 && (
        <div className="px-4 py-2 border-b border-[var(--paper-lines)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--pencil-gray)]">
              진행률
            </span>
            <span className="handwrite text-base text-[var(--ink-blue)]">
              {completed}/{total}
            </span>
          </div>
          <div className="progress-bar-notebook">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 퀘스트 목록 */}
      <div className="p-3">
        {quests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--pencil-gray)]">
              이 날짜에 예정된 퀘스트가 없어요
            </p>
            {!isToday && (
              <button
                onClick={onGoToToday}
                className="text-[var(--ink-blue)] text-xs mt-2 hover:underline"
              >
                오늘로 돌아가기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.groupKey);
              const progressPercent = group.totalCount > 0
                ? Math.round((group.completedCount / group.totalCount) * 100)
                : 0;

              return (
                <div
                  key={group.groupKey}
                  className={`rounded-xl overflow-hidden transition-all duration-200 border-2 ${
                    group.isComplete
                      ? 'border-[var(--sticker-mint)]/40 bg-[var(--highlight-green)]/30'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* 그룹 헤더 */}
                  <button
                    onClick={() => toggleGroup(group.groupKey)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base text-[var(--ink-black)] line-clamp-2">
                          {group.groupName}
                        </span>
                        {group.isComplete && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sticker-mint)] text-white flex-shrink-0">
                            완료
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              group.isComplete
                                ? 'bg-[var(--sticker-mint)]'
                                : 'bg-[var(--ink-blue)]'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-2 py-1 rounded-lg text-sm font-medium bg-[var(--highlight-blue)] text-[var(--ink-blue)]">
                      {group.completedCount}/{group.totalCount}
                    </div>

                    <span
                      className={`text-sm text-[var(--pencil-gray)] transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      ▼
                    </span>
                  </button>

                  {/* 퀘스트 목록 (펼침 상태일 때만) */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1">
                      <div className="space-y-2">
                        {group.quests.map((quest) => (
                          <LargeQuestItem
                            key={quest.id}
                            quest={quest}
                            isToday={isToday}
                            onToggle={() => onToggleComplete(quest.planId, quest.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 과거 날짜 요약 */}
      {!isToday && quests.length > 0 && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h3 className="font-medium text-sm text-[var(--ink-black)]">
                  {selectedDate < todayStr ? '이 날의 학습 기록' : '예정된 학습'}
                </h3>
                <p className="text-xs text-[var(--pencil-gray)]">
                  {selectedDate < todayStr
                    ? '과거 기록은 수정할 수 없어요'
                    : '미래 퀘스트는 해당 날짜가 되면 시작할 수 있어요'}
                </p>
              </div>
              <button
                onClick={onGoToToday}
                className="text-[var(--ink-blue)] text-xs hover:underline"
              >
                오늘로
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
