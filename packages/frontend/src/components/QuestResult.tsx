import { QuestCard } from './QuestCard';

interface DailyQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
}

interface Recommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

interface QuestResultProps {
  materialName: string;
  dailyQuests: DailyQuest[];
  summary: {
    totalDays: number;
    totalUnits: number;
    averageMinutesPerDay: number;
    totalEstimatedHours?: number;
  };
  recommendations?: Recommendation[];
  aiMessage?: string;
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

export function QuestResult({
  materialName,
  dailyQuests,
  summary,
  recommendations,
  aiMessage,
  onReset
}: QuestResultProps) {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{materialName}</h2>
          <p className="text-sm text-gray-500">
            {summary.totalDays}일 · {summary.totalUnits}개 단원
          </p>
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

      {/* 요약 */}
      <div className="bg-blue-50 rounded-xl p-4">
        <div className="text-center">
          <p className="text-sm text-blue-800">
            하루 평균 <span className="font-bold">{summary.averageMinutesPerDay}분</span> 학습
          </p>
          {summary.totalEstimatedHours && (
            <p className="text-xs text-blue-600 mt-1">
              총 예상 학습 시간: {summary.totalEstimatedHours}시간
            </p>
          )}
        </div>
      </div>

      {/* AI 추천 일정 */}
      {recommendations && recommendations.length > 0 && (
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
        <div className="grid gap-3">
          {dailyQuests.map((quest) => (
            <QuestCard
              key={quest.day}
              day={quest.day}
              date={quest.date}
              unitTitle={quest.unitTitle}
              range={quest.range}
              estimatedMinutes={quest.estimatedMinutes}
              tip={quest.tip}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
