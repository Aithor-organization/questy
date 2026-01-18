/**
 * PlannerPage
 * 전체 플랜 관리 페이지 - 노트북 스타일
 */

import { Link } from 'react-router-dom';
import { ClipboardList, BookOpen, Sparkles, Plus } from 'lucide-react';
import { useQuestStore } from '../stores/questStore';
import { NotebookLayout, NotebookPage, PlanAccordion } from '../components/notebook';

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
      <NotebookPage title={<span className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> 나의 학습 플랜</span>} decoration="holes">
        {plans.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <BookOpen className="w-12 h-12 text-[var(--pencil-gray)]" />
            </div>
            <p className="text-[var(--pencil-gray)] mb-4">
              아직 플랜이 없어요
            </p>
            <Link
              to="/generate"
              className="sticker sticker-gold inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> 첫 플랜 만들기
            </Link>
          </div>
        ) : (
          <PlanAccordion plans={plans} groupBy="subject" />
        )}
      </NotebookPage>

      {/* 새 플랜 추가 버튼 */}
      <Link
        to="/generate"
        className="fixed bottom-24 right-6 w-14 h-14 bg-[var(--sticker-coral)] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </NotebookLayout>
  );
}
