import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuestStore } from '../stores/questStore';

export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { getPlanById, removePlan, toggleQuestComplete } = useQuestStore();

  const plan = planId ? getPlanById(planId) : undefined;

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-gray-500 mb-4">플랜을 찾을 수 없습니다</p>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const completed = plan.dailyQuests.filter((q) => q.completed).length;
  const total = plan.dailyQuests.length;
  const percent = Math.round((completed / total) * 100);

  const handleDelete = () => {
    if (confirm('이 플랜을 삭제하시겠습니까?')) {
      removePlan(plan.id);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-lg mx-auto py-6 px-4">
        {/* 헤더 */}
        <header className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-blue-600 hover:text-blue-700 mb-2"
          >
            ← 나의 퀘스트
          </button>
          <h1 className="text-xl font-bold text-gray-900">{plan.materialName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {plan.summary.totalDays}일 · {plan.summary.totalUnits}개 단원
          </p>
        </header>

        {/* 진행률 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">진행률</span>
            <span className="text-sm text-gray-500">{completed}/{total}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">{percent}% 완료</p>
        </div>

        {/* AI 메시지 */}
        {plan.aiMessage && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-purple-800">💡 {plan.aiMessage}</p>
          </div>
        )}

        {/* 추천 일정 */}
        {plan.recommendations && plan.recommendations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📊 AI 추천 일정</h3>
            <div className="space-y-2">
              {plan.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{rec.suggestedDays}일</span>
                  <span className="text-gray-400">{rec.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 퀘스트 목록 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📅 전체 일정</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {plan.dailyQuests.map((quest) => (
              <div
                key={quest.day}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  quest.completed ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <button
                  onClick={() => toggleQuestComplete(plan.id, quest.day)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    quest.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {quest.completed && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 font-medium">Day {quest.day}</span>
                    <span className="text-xs text-gray-400">{formatDate(quest.date)}</span>
                  </div>
                  <p className={`text-sm truncate ${quest.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {quest.unitNumber}. {quest.unitTitle}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{quest.estimatedMinutes}분</span>
              </div>
            ))}
          </div>
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={handleDelete}
          className="w-full mt-4 py-3 text-red-500 hover:text-red-600 text-sm"
        >
          플랜 삭제
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
}
