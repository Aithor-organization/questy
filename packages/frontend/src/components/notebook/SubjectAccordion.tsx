/**
 * SubjectAccordion
 * 과목별 접이식 퀘스트 그룹 컴포넌트
 * - 과목/플랜별 퀘스트 그룹화
 * - 진행률 표시 [완료/전체]
 * - 접기/펼치기
 * - 첫 번째 미완료 그룹 자동 펼침
 */

import { useState, useEffect, useMemo } from 'react';
import type { QuestWithPlan } from '../../stores/questStore';
import { QuestCheckItem } from './QuestCheckItem';

// 과목별 아이콘 매핑
const SUBJECT_ICONS: Record<string, string> = {
  '수학': '📐',
  '국어': '📖',
  '영어': '🔤',
  '한국사': '🏛️',
  '사회': '🌍',
  '과학': '🔬',
  '탐구': '🔍',
  '물리': '⚛️',
  '화학': '🧪',
  '생물': '🧬',
  '지구과학': '🌏',
  '자습': '✍️',
  '문제풀이': '📝',
  '복습': '🔄',
  'default': '📚',
};

// 과목 이름에서 아이콘 추출
function getSubjectIcon(groupName: string): string {
  // 과목명이 그룹 이름에 포함되어 있는지 확인
  for (const [subject, icon] of Object.entries(SUBJECT_ICONS)) {
    if (groupName.includes(subject)) {
      return icon;
    }
  }
  return SUBJECT_ICONS.default;
}

// 과목 색상 클래스
const SUBJECT_COLORS: Record<string, string> = {
  '수학': 'bg-blue-100 border-blue-300 text-blue-800',
  '국어': 'bg-orange-100 border-orange-300 text-orange-800',
  '영어': 'bg-purple-100 border-purple-300 text-purple-800',
  '한국사': 'bg-amber-100 border-amber-300 text-amber-800',
  '과학': 'bg-green-100 border-green-300 text-green-800',
  '탐구': 'bg-teal-100 border-teal-300 text-teal-800',
  '자습': 'bg-gray-100 border-gray-300 text-gray-800',
  'default': 'bg-slate-100 border-slate-300 text-slate-800',
};

function getSubjectColorClass(groupName: string): string {
  for (const [subject, colorClass] of Object.entries(SUBJECT_COLORS)) {
    if (groupName.includes(subject)) {
      return colorClass;
    }
  }
  return SUBJECT_COLORS.default;
}

interface QuestGroup {
  groupKey: string;
  groupName: string;
  quests: QuestWithPlan[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}

interface SubjectAccordionProps {
  quests: QuestWithPlan[];
  onToggle: (planId: string, questId: string) => void;
  // 그룹화 기준: 'planName' (교재별) 또는 커스텀 함수
  groupBy?: 'planName' | ((quest: QuestWithPlan) => string);
}

export function SubjectAccordion({
  quests,
  onToggle,
  groupBy = 'planName',
}: SubjectAccordionProps) {
  // 퀘스트를 그룹별로 분류
  const groups: QuestGroup[] = useMemo(() => {
    const groupMap = new Map<string, QuestWithPlan[]>();

    quests.forEach((quest) => {
      const key = typeof groupBy === 'function'
        ? groupBy(quest)
        : quest[groupBy] || '기타';

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
  }, [quests, groupBy]);

  // 펼침 상태 관리 (첫 번째 미완료 그룹 자동 펼침)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 첫 렌더링 시 첫 번째 미완료 그룹 자동 펼침
  useEffect(() => {
    const firstIncompleteGroup = groups.find(g => !g.isComplete);
    if (firstIncompleteGroup) {
      setExpandedGroups(new Set([firstIncompleteGroup.groupKey]));
    } else if (groups.length > 0) {
      // 모두 완료되었으면 첫 번째 그룹 펼침
      setExpandedGroups(new Set([groups[0].groupKey]));
    }
  }, [groups.length]); // groups.length로 의존성 단순화

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

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.groupKey);
        const icon = getSubjectIcon(group.groupName);
        const colorClass = getSubjectColorClass(group.groupName);
        const progressPercent = group.totalCount > 0
          ? Math.round((group.completedCount / group.totalCount) * 100)
          : 0;

        return (
          <div
            key={group.groupKey}
            className={`rounded-xl overflow-hidden transition-all duration-200 border ${
              group.isComplete
                ? 'border-[var(--sticker-mint)]/40 bg-[var(--highlight-green)]/30'
                : 'border-gray-200 bg-white'
            }`}
          >
            {/* 그룹 헤더 (클릭하여 접기/펼치기) */}
            <button
              onClick={() => toggleGroup(group.groupKey)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
            >
              {/* 과목 아이콘 */}
              <span className="text-2xl">{icon}</span>

              {/* 과목명 + 진행률 */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink-black)]">
                    {group.groupName}
                  </span>
                  {group.isComplete && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sticker-mint)] text-white">
                      완료!
                    </span>
                  )}
                </div>
                {/* 프로그레스 바 */}
                <div className="mt-1 flex items-center gap-2">
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

              {/* 진행 상태 뱃지 */}
              <div className={`px-2 py-1 rounded-lg text-sm font-medium ${colorClass}`}>
                {group.completedCount}/{group.totalCount}
              </div>

              {/* 화살표 */}
              <span
                className={`text-[var(--pencil-gray)] transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>

            {/* 퀘스트 목록 (펼침 상태일 때만 표시) */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1">
                <div className="space-y-0">
                  {group.quests.map((quest) => (
                    <QuestCheckItem
                      key={quest.id}
                      quest={quest}
                      onToggle={() => onToggle(quest.planId, quest.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
