/**
 * PlanAccordion
 * 플랜 목록 접이식 그룹 컴포넌트
 * - 과목별 플랜 그룹화
 * - 진행률 표시 [완료/전체]
 * - 접기/펼치기
 */

import { useState, useEffect, useMemo } from 'react';
import type { QuestPlan } from '../../stores/questStore';
import { PlanCard } from './PlanCard';

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
  'default': '📚',
};

// 플랜 이름에서 과목 추출
function extractSubject(materialName: string): string {
  const subjects = ['수학', '국어', '영어', '한국사', '사회', '과학', '물리', '화학', '생물', '지구과학', '탐구'];
  for (const subject of subjects) {
    if (materialName.includes(subject)) {
      return subject;
    }
  }
  return '기타';
}

function getSubjectIcon(subject: string): string {
  return SUBJECT_ICONS[subject] || SUBJECT_ICONS.default;
}

// 과목 색상 클래스
const SUBJECT_COLORS: Record<string, string> = {
  '수학': 'bg-blue-100 border-blue-300 text-blue-800',
  '국어': 'bg-orange-100 border-orange-300 text-orange-800',
  '영어': 'bg-purple-100 border-purple-300 text-purple-800',
  '한국사': 'bg-amber-100 border-amber-300 text-amber-800',
  '과학': 'bg-green-100 border-green-300 text-green-800',
  '탐구': 'bg-teal-100 border-teal-300 text-teal-800',
  '기타': 'bg-slate-100 border-slate-300 text-slate-800',
};

function getSubjectColorClass(subject: string): string {
  return SUBJECT_COLORS[subject] || SUBJECT_COLORS['기타'];
}

interface PlanGroup {
  subject: string;
  plans: QuestPlan[];
  completedCount: number;
  totalCount: number;
  isAllComplete: boolean;
}

interface PlanAccordionProps {
  plans: QuestPlan[];
  // 그룹화 방식: 'subject' (과목별) 또는 'status' (진행상태별)
  groupBy?: 'subject' | 'status';
  // 진행 중인 플랜만 보기 (groupBy='status'일 때 유용)
  showOnlyActive?: boolean;
}

export function PlanAccordion({
  plans,
  groupBy = 'subject',
  showOnlyActive = false,
}: PlanAccordionProps) {
  // 플랜을 그룹별로 분류
  const groups: PlanGroup[] = useMemo(() => {
    if (groupBy === 'status') {
      // 진행상태별 그룹화
      const activePlans = plans.filter(p => !p.dailyQuests.every(q => q.completed));
      const completedPlans = plans.filter(p => p.dailyQuests.every(q => q.completed));

      const result: PlanGroup[] = [];

      if (activePlans.length > 0) {
        result.push({
          subject: '진행 중',
          plans: activePlans,
          completedCount: activePlans.filter(p => p.dailyQuests.every(q => q.completed)).length,
          totalCount: activePlans.length,
          isAllComplete: false,
        });
      }

      if (!showOnlyActive && completedPlans.length > 0) {
        result.push({
          subject: '완료됨',
          plans: completedPlans,
          completedCount: completedPlans.length,
          totalCount: completedPlans.length,
          isAllComplete: true,
        });
      }

      return result;
    }

    // 과목별 그룹화
    const groupMap = new Map<string, QuestPlan[]>();

    plans.forEach((plan) => {
      const subject = extractSubject(plan.materialName);
      if (!groupMap.has(subject)) {
        groupMap.set(subject, []);
      }
      groupMap.get(subject)!.push(plan);
    });

    return Array.from(groupMap.entries()).map(([subject, groupPlans]) => {
      const completedPlans = groupPlans.filter(p => p.dailyQuests.every(q => q.completed));
      return {
        subject,
        plans: groupPlans,
        completedCount: completedPlans.length,
        totalCount: groupPlans.length,
        isAllComplete: completedPlans.length === groupPlans.length,
      };
    });
  }, [plans, groupBy, showOnlyActive]);

  // 펼침 상태 관리
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 첫 렌더링 시 첫 번째 미완료 그룹 자동 펼침
  useEffect(() => {
    const firstIncompleteGroup = groups.find(g => !g.isAllComplete);
    if (firstIncompleteGroup) {
      setExpandedGroups(new Set([firstIncompleteGroup.subject]));
    } else if (groups.length > 0) {
      setExpandedGroups(new Set([groups[0].subject]));
    }
  }, [groups.length]);

  const toggleGroup = (subject: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.subject);
        const icon = groupBy === 'status'
          ? (group.subject === '진행 중' ? '📚' : '✅')
          : getSubjectIcon(group.subject);
        const colorClass = groupBy === 'status'
          ? (group.subject === '진행 중' ? 'bg-coral-100 border-coral-300 text-coral-800' : 'bg-green-100 border-green-300 text-green-800')
          : getSubjectColorClass(group.subject);

        // 그룹 내 전체 퀘스트 진행률 계산
        const totalQuests = group.plans.reduce((sum, p) => sum + p.dailyQuests.length, 0);
        const completedQuests = group.plans.reduce(
          (sum, p) => sum + p.dailyQuests.filter(q => q.completed).length,
          0
        );
        const progressPercent = totalQuests > 0
          ? Math.round((completedQuests / totalQuests) * 100)
          : 0;

        return (
          <div
            key={group.subject}
            className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
              group.isAllComplete
                ? 'border-[var(--sticker-mint)] bg-[var(--highlight-green)]/30'
                : 'border-[var(--line-dark)] bg-white'
            }`}
          >
            {/* 그룹 헤더 */}
            <button
              onClick={() => toggleGroup(group.subject)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
            >
              {/* 과목 아이콘 */}
              <span className="text-2xl">{icon}</span>

              {/* 과목명 + 진행률 */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink-black)]">
                    {group.subject}
                  </span>
                  {group.isAllComplete && (
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
                        group.isAllComplete
                          ? 'bg-[var(--sticker-mint)]'
                          : 'bg-[var(--ink-blue)]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--pencil-gray)]">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* 플랜 개수 뱃지 */}
              <div className={`px-2 py-1 rounded-lg text-sm font-medium ${colorClass}`}>
                {group.completedCount}/{group.totalCount} 플랜
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

            {/* 플랜 목록 */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-[var(--line-light)]">
                <div className="space-y-3">
                  {group.plans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} />
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
