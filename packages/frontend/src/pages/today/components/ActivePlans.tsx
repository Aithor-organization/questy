/**
 * ActivePlans
 * 진행 중인 플랜 미리보기 컴포넌트
 */

import { Link } from 'react-router-dom';
import { PlanCard } from '../../../components/notebook';
import type { QuestPlan } from '../../../stores/questStore';

interface ActivePlansProps {
  plans: QuestPlan[];
}

export function ActivePlans({ plans }: ActivePlansProps) {
  if (plans.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="handwrite text-xl text-[var(--ink-black)]">
          📚 진행 중인 플랜
        </h2>
        <Link
          to="/planner"
          className="text-sm text-[var(--ink-blue)] hover:underline"
        >
          전체 보기
        </Link>
      </div>
      <div className="space-y-3">
        {plans.slice(0, 2).map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
        {plans.length > 2 && (
          <Link
            to="/planner"
            className="block text-center text-sm text-[var(--ink-blue)] hover:underline py-2"
          >
            +{plans.length - 2}개 더 보기
          </Link>
        )}
      </div>
    </div>
  );
}
