/**
 * PlannerPage
 * 전체 플랜 관리 페이지 - 노트북 스타일
 */

import { Link } from 'react-router-dom';
import { useQuestStore } from '../stores/questStore';
import { NotebookLayout, NotebookPage, PlanCard } from '../components/notebook';

export function PlannerPage() {
  const { plans } = useQuestStore();

  // 통계 계산
  const totalQuests = plans.reduce((sum, p) => sum + p.dailyQuests.length, 0);
  const completedQuests = plans.reduce(
    (sum, p) => sum + p.dailyQuests.filter(q => q.completed).length,
    0
  );
  const completedPlans = plans.filter(
    p => p.dailyQuests.every(q => q.completed)
  ).length;

  return (
    <NotebookLayout>
      {/* 통계 카드 */}
      <NotebookPage decoration="tape" className="mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="handwrite text-3xl text-[var(--ink-blue)]">
              {plans.length}
            </p>
            <p className="text-xs text-[var(--pencil-gray)]">전체 플랜</p>
          </div>
          <div>
            <p className="handwrite text-3xl text-[var(--sticker-mint)]">
              {completedQuests}/{totalQuests}
            </p>
            <p className="text-xs text-[var(--pencil-gray)]">완료 퀘스트</p>
          </div>
          <div>
            <p className="handwrite text-3xl text-[var(--sticker-gold)]">
              {completedPlans}
            </p>
            <p className="text-xs text-[var(--pencil-gray)]">완료 플랜</p>
          </div>
        </div>
      </NotebookPage>

      {/* 플랜 목록 */}
      <NotebookPage title="📋 나의 학습 플랜" decoration="holes">
        {plans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">📚</p>
            <p className="text-[var(--pencil-gray)] mb-4">
              아직 플랜이 없어요
            </p>
            <Link
              to="/generate"
              className="sticker sticker-gold inline-flex items-center gap-2"
            >
              ✨ 첫 플랜 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 진행 중 */}
            {plans.filter(p => !p.dailyQuests.every(q => q.completed)).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--pencil-gray)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--sticker-coral)]" />
                  진행 중
                </h3>
                <div className="space-y-3">
                  {plans
                    .filter(p => !p.dailyQuests.every(q => q.completed))
                    .map(plan => (
                      <PlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
              </div>
            )}

            {/* 완료됨 */}
            {plans.filter(p => p.dailyQuests.every(q => q.completed)).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--pencil-gray)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--sticker-mint)]" />
                  완료됨
                </h3>
                <div className="space-y-3 opacity-70">
                  {plans
                    .filter(p => p.dailyQuests.every(q => q.completed))
                    .map(plan => (
                      <PlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </NotebookPage>

      {/* 새 플랜 추가 버튼 */}
      <Link
        to="/generate"
        className="fixed bottom-8 right-8 w-14 h-14 bg-[var(--sticker-coral)] text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform z-50"
      >
        +
      </Link>
    </NotebookLayout>
  );
}
