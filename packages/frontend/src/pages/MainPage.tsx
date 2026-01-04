import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuestStore, getTodayDateString } from '../stores/questStore';
import type { QuestWithPlan } from '../stores/questStore';

export function MainPage() {
  const { plans, getQuestsByDate, toggleQuestComplete } = useQuestStore();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  const todayStr = getTodayDateString();
  const quests = getQuestsByDate(selectedDate);
  const isToday = selectedDate === todayStr;

  // 날짜 이동
  const changeDate = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // 플랜이 하나도 없을 때
  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-md">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">QuestyBook</h1>
          <p className="text-gray-500 mb-6">
            아직 학습 플랜이 없습니다.<br />
            새로운 퀘스트를 생성해보세요!
          </p>
          <Link
            to="/generate"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            퀘스트 생성하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-lg mx-auto py-6 px-4">
        {/* 헤더 */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">나의 퀘스트</h1>
          <Link
            to="/generate"
            className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            + 새 플랜
          </Link>
        </header>

        {/* 진행 중인 플랜 (상단) */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📋 진행 중인 플랜</h2>
          <div className="space-y-2">
            {plans.map((plan) => {
              const completed = plan.dailyQuests.filter((q) => q.completed).length;
              const total = plan.dailyQuests.length;
              const percent = Math.round((completed / total) * 100);

              return (
                <Link
                  key={plan.id}
                  to={`/plan/${plan.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate flex-1 mr-2">{plan.materialName}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0">{percent}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {completed}/{total} 완료
                    </p>
                    <p className="text-xs text-gray-400">
                      {plan.summary.totalDays}일 과정
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t border-gray-200 my-4" />

        {/* 날짜 선택 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📅 일별 퀘스트</h2>
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => changeDate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeftIcon />
              </button>

              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">
                  {formatDateDisplay(selectedDate)}
                </p>
                {isToday ? (
                  <span className="text-xs text-blue-600 font-medium">오늘</span>
                ) : (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="text-xs text-gray-500 hover:text-blue-600"
                  >
                    오늘로 이동
                  </button>
                )}
              </div>

              <button
                onClick={() => changeDate(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          {/* 퀘스트 리스트 */}
          <div className="space-y-3">
            {quests.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-400 text-sm">
                  이 날짜에 예정된 퀘스트가 없습니다
                </p>
              </div>
            ) : (
              quests.map((quest) => (
                <QuestItem
                  key={`${quest.planId}-${quest.day}`}
                  quest={quest}
                  onToggle={() => toggleQuestComplete(quest.planId, quest.day)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// 퀘스트 아이템 컴포넌트
function QuestItem({
  quest,
  onToggle,
}: {
  quest: QuestWithPlan;
  onToggle: () => void;
}) {
  // 상세 정보 여부 확인
  const hasDetails = (quest.topics && quest.topics.length > 0) ||
                     quest.pages ||
                     (quest.objectives && quest.objectives.length > 0);

  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 transition-all ${
      quest.completed ? 'opacity-60' : ''
    }`}>
      {/* 플랜 이름 & 페이지 */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-blue-600 font-medium">{quest.planName}</p>
        {quest.pages && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            📄 {quest.pages}
          </span>
        )}
      </div>

      {/* 퀘스트 정보 */}
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-3">
          <h3 className={`font-semibold text-gray-900 ${
            quest.completed ? 'line-through text-gray-500' : ''
          }`}>
            {quest.unitNumber}. {quest.unitTitle}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{quest.range}</p>
        </div>

        {/* 완료 체크박스 */}
        <button
          onClick={onToggle}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            quest.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-blue-500'
          }`}
        >
          {quest.completed && <CheckIcon />}
        </button>
      </div>

      {/* 학습 주제 (상세 정보) */}
      {quest.topics && quest.topics.length > 0 && !quest.completed && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {quest.topics.slice(0, 4).map((topic, index) => (
              <span
                key={index}
                className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
              >
                {topic}
              </span>
            ))}
            {quest.topics.length > 4 && (
              <span className="text-xs text-gray-400">+{quest.topics.length - 4}</span>
            )}
          </div>
        </div>
      )}

      {/* 학습 목표 (상세 정보) */}
      {quest.objectives && quest.objectives.length > 0 && !quest.completed && (
        <div className="mt-2">
          <ul className="text-xs text-gray-600 space-y-0.5">
            {quest.objectives.slice(0, 2).map((objective, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-green-500">•</span>
                <span>{objective}</span>
              </li>
            ))}
            {quest.objectives.length > 2 && (
              <li className="text-gray-400">외 {quest.objectives.length - 2}개 목표</li>
            )}
          </ul>
        </div>
      )}

      {/* 하단 정보 */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">⏱ {quest.estimatedMinutes}분</p>
        {hasDetails && !quest.completed && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
            상세 계획
          </span>
        )}
      </div>

      {/* 팁 */}
      {quest.tip && !quest.completed && (
        <div className="mt-3 p-2 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-700">💡 {quest.tip}</p>
        </div>
      )}
    </div>
  );
}

// 날짜 포맷
function formatDateDisplay(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${parseInt(month)}월 ${parseInt(day)}일 (${weekday})`;
}

// 아이콘 컴포넌트
function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
