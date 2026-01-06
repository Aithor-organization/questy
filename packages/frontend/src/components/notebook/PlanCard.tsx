/**
 * PlanCard
 * 학습 플랜 카드 - 노트북 표지 스타일
 */

import { Link } from 'react-router-dom';
import type { QuestPlan } from '../../stores/questStore';

interface PlanCardProps {
  plan: QuestPlan;
}

export function PlanCard({ plan }: PlanCardProps) {
  const completed = plan.dailyQuests.filter(q => q.completed).length;
  const total = plan.dailyQuests.length;
  const progress = Math.round((completed / total) * 100);

  // 과목별 색상
  const getSubjectColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('수학') || lower.includes('math')) return 'var(--ink-blue)';
    if (lower.includes('국어') || lower.includes('korean')) return 'var(--ink-red)';
    if (lower.includes('영어') || lower.includes('english')) return 'var(--sticker-gold)';
    if (lower.includes('과학') || lower.includes('science')) return 'var(--sticker-mint)';
    return 'var(--sticker-coral)';
  };

  const accentColor = getSubjectColor(plan.materialName);

  return (
    <Link
      to={`/plan/${plan.id}`}
      className="block notebook-page hover:shadow-lg transition-shadow group"
      style={{
        borderLeft: `4px solid ${accentColor}`,
        transform: 'rotate(-0.5deg)',
      }}
    >
      <div className="p-4">
        {/* 상단: 제목 + 진행률 배지 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="handwrite text-xl text-[var(--ink-black)] truncate group-hover:text-[var(--ink-blue)] transition-colors">
              {plan.materialName}
            </h3>
            <p className="text-xs text-[var(--pencil-gray)] mt-1">
              {plan.summary.totalDays}일 과정 • {plan.summary.totalUnits}개 단원
            </p>
          </div>
          <div
            className="sticker flex-shrink-0"
            style={{
              background: progress === 100 ? 'var(--sticker-mint)' : 'var(--highlight-yellow)',
              color: progress === 100 ? '#064e3b' : '#78350f',
            }}
          >
            {progress}%
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="progress-bar-notebook mb-3">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 하단: 완료 현황 */}
        <div className="flex items-center justify-between text-xs text-[var(--pencil-gray)]">
          <span>
            {completed}/{total} 완료
          </span>
          <span className="flex items-center gap-1">
            <span>⏱</span>
            <span>~{plan.summary.averageMinutesPerDay}분/일</span>
          </span>
        </div>

        {/* AI 메시지 (있으면) */}
        {plan.aiMessage && (
          <div className="postit mt-3 text-xs line-clamp-2">
            💬 {plan.aiMessage}
          </div>
        )}
      </div>
    </Link>
  );
}
