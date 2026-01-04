import { QuestCard } from './QuestCard';
import type { GeneratedPlan, Recommendation } from '../hooks/useQuestGeneration';

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
  hasOriginalPlan,
  detectedStudyPlan,
  recommendations,
  aiMessage,
  selectedIndex,
  onSelectPlan,
  onSavePlan,
  onReset,
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

      {/* AI 추천 일정 (맞춤 플랜 선택 시에만) */}
      {recommendations && recommendations.length > 0 && selectedPlan.planType === 'custom' && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">📊 AI 추천 일정</h3>
          <div className="grid gap-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${intensityColors[rec.intensity]}`}>
                    {intensityLabels[rec.intensity]}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {rec.suggestedDays}일
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{rec.reason}</p>
                  <p className="text-xs text-gray-400">하루 {rec.dailyStudyMinutes}분</p>
                </div>
              </div>
            ))}
          </div>
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
