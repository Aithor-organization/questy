import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestForm, PlanSelector } from '../components';
import { useQuestGeneration } from '../hooks/useQuestGeneration';
import type { GeneratedPlan } from '../hooks/useQuestGeneration';
import { useQuestStore } from '../stores/questStore';

export function GeneratePage() {
  const navigate = useNavigate();
  const {
    generate,
    regenerate,
    reviewPlan,
    result,
    isLoading,
    isRegenerating,
    isReviewing,
    review,
    error,
    reset,
  } = useQuestGeneration();
  const { addPlan, plans } = useQuestStore();
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);

  const handleSavePlan = (plan: GeneratedPlan) => {
    if (result) {
      const totalMinutes = plan.dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
      const questUnits = new Set(plan.dailyQuests.map((q) => q.unitNumber));

      addPlan({
        materialName: result.materialName,
        dailyQuests: plan.dailyQuests,
        summary: {
          totalDays: plan.totalDays,
          totalUnits: questUnits.size,
          averageMinutesPerDay: Math.round(totalMinutes / plan.totalDays),
          totalEstimatedHours: plan.totalEstimatedHours,
        },
        recommendations: result.recommendations,
        aiMessage: result.aiMessage,
      });
      navigate('/');
    }
  };

  const handleReset = () => {
    setSelectedPlanIndex(0);
    reset();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-lg mx-auto py-8 px-4">
        {/* 헤더 */}
        <header className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">QuestyBook</h1>
          <p className="text-gray-500 text-sm mt-1">
            목차 사진으로 일일 학습 퀘스트 생성
          </p>
          {plans.length > 0 && (
            <button
              onClick={() => navigate('/')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              ← 나의 퀘스트로 돌아가기
            </button>
          )}
        </header>

        {/* 메인 카드 */}
        <main className="bg-white rounded-2xl shadow-sm p-6">
          {result ? (
            <PlanSelector
              materialName={result.materialName}
              plans={result.plans}
              hasOriginalPlan={result.hasOriginalPlan}
              detectedStudyPlan={result.detectedStudyPlan}
              recommendations={result.recommendations}
              aiMessage={result.aiMessage}
              selectedIndex={selectedPlanIndex}
              onSelectPlan={setSelectedPlanIndex}
              onSavePlan={handleSavePlan}
              onReset={handleReset}
              onRegenerate={regenerate}
              onReviewPlan={reviewPlan}
              isRegenerating={isRegenerating}
              isReviewing={isReviewing}
              review={review}
            />
          ) : (
            <>
              <QuestForm onSubmit={generate} isLoading={isLoading} />

              {error && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="mt-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
                  <p className="mt-2 text-gray-600 font-medium">
                    퀘스트 생성중입니다
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
