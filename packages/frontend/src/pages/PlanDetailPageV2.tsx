/**
 * PlanDetailPageV2
 * 플랜 상세 페이지 - 노트북 스타일
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuestStore } from '../stores/questStore';
import { NotebookLayout, NotebookPage, QuestCheckItem } from '../components/notebook';

export function PlanDetailPageV2() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { getPlanById, toggleQuestComplete, removePlan } = useQuestStore();

  const plan = planId ? getPlanById(planId) : undefined;

  if (!plan) {
    return (
      <NotebookLayout>
        <NotebookPage decoration="tape" className="text-center py-12">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-[var(--pencil-gray)] mb-4">
            플랜을 찾을 수 없어요
          </p>
          <Link to="/" className="sticker sticker-coral">
            홈으로 돌아가기
          </Link>
        </NotebookPage>
      </NotebookLayout>
    );
  }

  const completed = plan.dailyQuests.filter(q => q.completed).length;
  const total = plan.dailyQuests.length;
  const progress = Math.round((completed / total) * 100);

  // 플랜 삭제
  const handleDelete = () => {
    if (confirm('정말 이 플랜을 삭제할까요?')) {
      removePlan(plan.id);
      navigate('/');
    }
  };

  return (
    <NotebookLayout>
      {/* 헤더 */}
      <NotebookPage decoration="tape">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <Link
              to="/planner"
              className="text-sm text-[var(--ink-blue)] hover:underline mb-2 inline-block"
            >
              ← 플래너로 돌아가기
            </Link>
            <h1 className="handwrite handwrite-xl text-[var(--ink-black)] truncate">
              {plan.materialName}
            </h1>
          </div>
          <button
            onClick={handleDelete}
            className="text-[var(--ink-red)] text-sm hover:underline"
          >
            삭제
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 text-center py-4 border-y border-[var(--paper-lines)]">
          <div>
            <p className="handwrite text-2xl text-[var(--ink-blue)]">{plan.summary.totalDays}</p>
            <p className="text-xs text-[var(--pencil-gray)]">일</p>
          </div>
          <div>
            <p className="handwrite text-2xl text-[var(--sticker-mint)]">{completed}/{total}</p>
            <p className="text-xs text-[var(--pencil-gray)]">완료</p>
          </div>
          <div>
            <p className="handwrite text-2xl text-[var(--sticker-gold)]">{progress}%</p>
            <p className="text-xs text-[var(--pencil-gray)]">진행률</p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="mt-4">
          <div className="progress-bar-notebook">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          {progress === 100 && (
            <div className="text-center mt-2">
              <span className="sticker sticker-mint animate-stamp">🎉 완료!</span>
            </div>
          )}
        </div>

        {/* AI 메시지 */}
        {plan.aiMessage && (
          <div className="postit mt-4">
            <p className="text-sm">💬 {plan.aiMessage}</p>
          </div>
        )}
      </NotebookPage>

      {/* 퀘스트 목록 */}
      <NotebookPage title="📝 퀘스트 목록" decoration="holes" className="mt-6">
        <div className="space-y-0">
          {plan.dailyQuests.map((quest) => (
            <QuestCheckItem
              key={quest.id}
              quest={{
                ...quest,
                planId: plan.id,
                planName: plan.materialName,
              }}
              onToggle={() => toggleQuestComplete(plan.id, quest.id)}
            />
          ))}
        </div>
      </NotebookPage>

      {/* 추천 사항 */}
      {plan.recommendations && plan.recommendations.length > 0 && (
        <NotebookPage title="💡 AI 추천" decoration="tape" className="mt-6">
          <div className="space-y-3">
            {plan.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  rec.intensity === 'relaxed' ? 'bg-[var(--highlight-green)]' :
                  rec.intensity === 'intensive' ? 'bg-[var(--highlight-pink)]' :
                  'bg-[var(--highlight-yellow)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">
                    {rec.suggestedDays}일 플랜
                  </span>
                  <span className="text-xs text-[var(--pencil-gray)]">
                    {rec.dailyStudyMinutes}분/일
                  </span>
                </div>
                <p className="text-sm text-[var(--pencil-gray)]">
                  {rec.reason}
                </p>
              </div>
            ))}
          </div>
        </NotebookPage>
      )}
    </NotebookLayout>
  );
}
