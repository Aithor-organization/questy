import { QuestCard } from './QuestCard';
import type { GeneratedPlan, Recommendation, PlanReview } from '../hooks/useQuestGeneration';

interface DetectedStudyPlan {
  source: string;
  totalDays: number;
}

interface PlanSelectorProps {
  materialName: string;
  plans: GeneratedPlan[];
  hasOriginalPlan: boolean;
  detectedStudyPlan: DetectedStudyPlan | null;
  recommendations?: Recommendation[];
  aiMessage?: string;
  selectedIndex: number;
  onSelectPlan: (index: number) => void;
  onSavePlan: (plan: GeneratedPlan) => void;
  onReset: () => void;
  onRegenerate?: (targetDays: number) => Promise<void>;
  onReviewPlan?: (plan: GeneratedPlan) => Promise<PlanReview | null>;
  isRegenerating?: boolean;
  isReviewing?: boolean;
  review?: PlanReview | null;
}

const intensityLabels = {
  relaxed: '여유롭게',
  normal: '보통',
  intensive: '빡빡하게',
};

const intensityColors = {
  relaxed: 'bg-green-100 text-green-700',
  normal: 'bg-yellow-100 text-yellow-700',
  intensive: 'bg-red-100 text-red-700',
};

export function PlanSelector({
  materialName,
  plans,
  hasOriginalPlan: _hasOriginalPlan,
  detectedStudyPlan,
  recommendations,
  aiMessage,
  selectedIndex,
  onSelectPlan,
  onSavePlan,
  onReset,
  onRegenerate,
  onReviewPlan,
  isRegenerating,
  isReviewing,
  review,
}: PlanSelectorProps) {
  const selectedPlan = plans[selectedIndex];

  if (!selectedPlan) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">플랜을 찾을 수 없습니다</p>
        <button onClick={onReset} className="mt-4 text-blue-600 hover:text-blue-700">
          다시 시도하기
        </button>
      </div>
    );
  }

  const totalMinutes = selectedPlan.dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
  const averageMinutes = Math.round(totalMinutes / selectedPlan.totalDays);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{materialName}</h2>
          {detectedStudyPlan && (
            <p className="text-sm text-green-600 mt-1">
              📋 {detectedStudyPlan.source} 감지됨
            </p>
          )}
        </div>
        <button
          onClick={onReset}
          type="button"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          다시 만들기
        </button>
      </div>

      {/* AI 메시지 */}
      {aiMessage && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-800">💡 {aiMessage}</p>
        </div>
      )}

      {/* 플랜 선택 탭 (2개 이상일 때만) */}
      {plans.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">🎯 플랜 선택</h3>
          <div className="grid gap-2">
            {plans.map((plan, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPlan(idx)}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  selectedIndex === idx
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      plan.planType === 'original'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {plan.planType === 'original' ? '원본' : '맞춤'}
                    </span>
                    <span className="font-medium text-gray-900">{plan.planName}</span>
                  </div>
                  <span className="text-sm text-gray-500">{plan.totalDays}일</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 플랜 요약 */}
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-800">{selectedPlan.planName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            selectedPlan.planType === 'original'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {selectedPlan.planType === 'original' ? '원본 계획' : '맞춤 계획'}
          </span>
        </div>
        <div className="text-center">
          <p className="text-sm text-blue-800">
            하루 평균 <span className="font-bold">{averageMinutes}분</span> 학습
          </p>
          <p className="text-xs text-blue-600 mt-1">
            총 예상 학습 시간: {selectedPlan.totalEstimatedHours}시간
          </p>
        </div>
      </div>

      {/* AI 추천 일정 (클릭하면 해당 일정으로 재생성) */}
      {recommendations && recommendations.length > 0 && onRegenerate && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            📊 AI 추천 일정
            <span className="text-xs font-normal text-gray-500 ml-1">(클릭하면 재생성)</span>
          </h3>
          <div className="grid gap-2">
            {recommendations.map((rec, idx) => (
              <button
                key={idx}
                onClick={() => onRegenerate(rec.suggestedDays)}
                disabled={isRegenerating}
                className={`flex items-center justify-between p-3 rounded-lg text-left transition-all border-2 ${
                  selectedPlan.totalDays === rec.suggestedDays
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                } ${isRegenerating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${intensityColors[rec.intensity]}`}>
                    {intensityLabels[rec.intensity]}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {rec.suggestedDays}일
                  </span>
                  {selectedPlan.totalDays === rec.suggestedDays && (
                    <span className="text-xs text-blue-600">✓ 현재</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{rec.reason}</p>
                  <p className="text-xs text-gray-400">하루 {rec.dailyStudyMinutes}분</p>
                </div>
              </button>
            ))}
          </div>
          {isRegenerating && (
            <div className="text-center py-2">
              <span className="text-sm text-blue-600">플랜 재생성 중...</span>
            </div>
          )}
        </div>
      )}

      {/* AI 전문가 리뷰 */}
      {onReviewPlan && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">🎓 AI 전문가 리뷰</h3>
            {!review && !isReviewing && (
              <button
                onClick={() => onReviewPlan(selectedPlan)}
                disabled={isReviewing}
                className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 disabled:opacity-50 transition-colors"
              >
                플랜 분석받기
              </button>
            )}
          </div>

          {/* 리뷰 진행 중 로딩 상태 */}
          {isReviewing && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-3" />
              <p className="text-sm font-medium text-purple-700">AI 전문가가 플랜을 분석 중입니다...</p>
              <p className="text-xs text-purple-500 mt-1">잠시만 기다려주세요</p>
            </div>
          )}

          {review && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 space-y-4">
              {/* 점수 및 총평 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-2xl font-bold text-purple-600">{review.overallScore}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">총점 {review.overallScore}/10</p>
                  <p className="text-xs text-gray-600 mt-0.5">{review.overallComment}</p>
                </div>
              </div>

              {/* 장점 */}
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1">✅ 장점</p>
                <ul className="space-y-1">
                  {review.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-gray-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-green-500">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 개선점 */}
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-1">💡 개선 제안</p>
                <ul className="space-y-1">
                  {review.improvements.map((s, i) => (
                    <li key={i} className="text-xs text-gray-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-orange-500">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 밸런스 분석 */}
              <div className="grid gap-2 text-xs">
                <div className="flex gap-2">
                  <span className="text-gray-500">⏱️</span>
                  <span className="text-gray-700">{review.balanceAnalysis.timeBalance}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">📈</span>
                  <span className="text-gray-700">{review.balanceAnalysis.difficultyProgression}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500">🔄</span>
                  <span className="text-gray-700">{review.balanceAnalysis.restDaysAdvice}</span>
                </div>
              </div>

              {/* 전문가 조언 */}
              <div className="bg-white/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-700 mb-1">💬 전문가 조언</p>
                <p className="text-xs text-gray-700">{review.expertAdvice}</p>
              </div>

              {/* 동기부여 팁 */}
              <div className="flex flex-wrap gap-1">
                {review.motivationalTips.map((tip, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-white/70 rounded-full text-gray-600">
                    🌟 {tip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 퀘스트 목록 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📅 일일 퀘스트</h3>
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {selectedPlan.dailyQuests.map((quest) => (
            <QuestCard
              key={quest.day}
              day={quest.day}
              date={quest.date}
              unitTitle={quest.unitTitle}
              range={quest.range}
              estimatedMinutes={quest.estimatedMinutes}
              tip={quest.tip}
              topics={quest.topics}
              pages={quest.pages}
              objectives={quest.objectives}
            />
          ))}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onReset}
          className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          다시 만들기
        </button>
        <button
          onClick={() => onSavePlan(selectedPlan)}
          className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          이 플랜 사용하기
        </button>
      </div>
    </div>
  );
}
