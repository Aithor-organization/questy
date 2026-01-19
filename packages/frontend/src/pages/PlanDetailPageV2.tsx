/**
 * PlanDetailPageV2
 * 플랜 상세 페이지 - 노트북 스타일
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuestStore, getTodayDateString } from '../stores/questStore';
import { useChatStore, DEFAULT_ROOM_ID } from '../stores/chatStore';
import { NotebookLayout, NotebookPage, QuestCheckItem } from '../components/notebook';
import { RescheduleModal } from '../components/RescheduleModal';

export function PlanDetailPageV2() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { getPlanById, toggleQuestComplete, removePlan, smartRescheduleQuests, rescheduleQuest } = useQuestStore();
  const { addMessage } = useChatStore();

  // 재조정 모달 상태
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState(getTodayDateString());
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleStrategy, setRescheduleStrategy] = useState<string>('smart');

  // 개발중 메시지 표시 상태
  const [showDevMessage, setShowDevMessage] = useState(false);

  // 밀린 퀘스트 재조정 모달 상태
  const [showOverdueModal, setShowOverdueModal] = useState(false);

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
  const todayStr = getTodayDateString();

  // 밀린 퀘스트 목록 (과거 날짜 + 미완료)
  const overdueQuests = useMemo(() => {
    return plan.dailyQuests.filter(q => !q.completed && q.date < todayStr);
  }, [plan.dailyQuests, todayStr]);

  // 밀린 퀘스트 수 (overdueQuests에서 파생)
  const overdueCount = overdueQuests.length;

  // 미완료 퀘스트 수 (전체)
  const incompleteCount = plan.dailyQuests.filter(q => !q.completed).length;

  // 스마트 재스케줄링 실행
  const handleSmartReschedule = async () => {
    if (!planId) return;

    setIsRescheduling(true);
    try {
      const result = await smartRescheduleQuests(planId, rescheduleTargetDate, rescheduleStrategy);

      if (result?.success) {
        const message = result.warnings?.length
          ? `✅ "${plan.materialName}" 플랜의 ${result.rescheduledCount}개 퀘스트를 재조정했어요!\n⚠️ 주의: ${result.warnings.join(', ')}`
          : `✅ "${plan.materialName}" 플랜의 ${result.rescheduledCount}개 퀘스트를 스마트하게 재조정했어요! 다른 플랜과의 충돌도 고려했습니다. 📅`;

        addMessage(DEFAULT_ROOM_ID, {
          role: 'assistant',
          content: message,
          agentRole: 'COACH',
        });
        setShowRescheduleModal(false);
      } else {
        addMessage(DEFAULT_ROOM_ID, {
          role: 'assistant',
          content: '😅 재조정 중 오류가 발생했어요. 다시 시도해주세요.',
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      console.error('[PlanDetail] 재조정 실패:', error);
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: '😅 재조정 중 오류가 발생했어요. 다시 시도해주세요.',
        agentRole: 'COACH',
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  // 플랜 삭제
  const handleDelete = () => {
    if (confirm('정말 이 플랜을 삭제할까요?')) {
      removePlan(plan.id);
      navigate('/');
    }
  };

  // 개별 퀘스트 날짜 변경
  const handleQuestReschedule = (questId: string, newDate: string) => {
    if (!planId) return;
    const success = rescheduleQuest(planId, questId, newDate);
    if (success) {
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: `📅 퀘스트 날짜를 ${newDate}로 변경했어요!`,
        agentRole: 'COACH',
      });
    }
  };

  return (
    <NotebookLayout>
      {/* 개발중 메시지 모달 */}
      {showDevMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">🔧</div>
            <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
              기능 개발 중
            </h3>
            <p className="text-[var(--pencil-gray)] mb-4 text-sm">
              현재 이 기능은 개발중입니다.<br />
              조금만 기다려주세요!
            </p>
            <button
              onClick={() => setShowDevMessage(false)}
              className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 재조정 모달 */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">🧠</div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                스마트 일정 재조정
              </h3>
              <p className="text-[var(--pencil-gray)] mb-4 text-sm">
                "{plan.materialName}" 플랜의 미완료 퀘스트 {incompleteCount}개를 재조정합니다.
              </p>

              {/* 시작 날짜 선택 */}
              <div className="mb-4">
                <label className="block text-sm text-[var(--pencil-gray)] mb-1 text-left">
                  시작 날짜
                </label>
                <input
                  type="date"
                  value={rescheduleTargetDate}
                  onChange={(e) => setRescheduleTargetDate(e.target.value)}
                  min={todayStr}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              {/* 재조정 전략 선택 */}
              <div className="mb-4">
                <label className="block text-sm text-[var(--pencil-gray)] mb-2 text-left">
                  재조정 방식
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'smart', label: '🧠 스마트', desc: '균등 분배' },
                    { value: 'spread', label: '📅 분산', desc: '넓게 퍼뜨림' },
                    { value: 'front_load', label: '🏃 집중', desc: '앞쪽에 집중' },
                    { value: 'priority_first', label: '⭐ 우선순위', desc: '중요한 것 먼저' },
                  ].map((strategy) => (
                    <button
                      key={strategy.value}
                      onClick={() => setRescheduleStrategy(strategy.value)}
                      className={`p-2 rounded-lg border text-left text-sm ${
                        rescheduleStrategy === strategy.value
                          ? 'border-[var(--ink-blue)] bg-[var(--highlight-blue)]'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <span className="font-medium">{strategy.label}</span>
                      <p className="text-xs text-[var(--pencil-gray)]">{strategy.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 스마트 재조정 설명 */}
              <div className="bg-[var(--highlight-blue)] rounded-lg p-3 mb-4 text-left">
                <p className="text-xs text-[var(--ink-blue)]">
                  💡 <strong>스마트 재조정</strong>은 다른 플랜의 일정과 충돌을 방지하고,
                  하루 학습량을 80% 이내로 유지하며 균등하게 분배합니다.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleSmartReschedule}
                  disabled={isRescheduling || !rescheduleTargetDate}
                  className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg disabled:opacity-50"
                >
                  {isRescheduling ? '재조정 중...' : '🧠 일정 재조정하기'}
                </button>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2">
            {/* 재조정 버튼 (미완료 퀘스트가 있을 때만) - 개발중 메시지 표시 */}
            {incompleteCount > 0 && (
              <button
                onClick={() => setShowDevMessage(true)}
                className="text-[var(--ink-blue)] text-sm hover:underline flex items-center gap-1"
              >
                🧠 재조정
              </button>
            )}
            <button
              onClick={handleDelete}
              className="text-[var(--ink-red)] text-sm hover:underline"
            >
              삭제
            </button>
          </div>
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

        {/* 밀린 퀘스트 경고 */}
        {overdueCount > 0 && (
          <div className="mt-4 p-3 bg-[var(--highlight-pink)] rounded-lg border-l-4 border-[var(--sticker-coral)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <div>
                  <p className="text-sm font-medium text-[var(--ink-black)]">
                    밀린 퀘스트 {overdueCount}개
                  </p>
                  <p className="text-xs text-[var(--pencil-gray)]">
                    일정 재조정이 필요해요
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOverdueModal(true)}
                className="px-3 py-1.5 bg-[var(--ink-blue)] text-white text-sm rounded-full hover:bg-blue-600"
              >
                재조정
              </button>
            </div>
          </div>
        )}

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
              onReschedule={handleQuestReschedule}
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

      {/* 밀린 퀘스트 재조정 모달 */}
      <RescheduleModal
        isOpen={showOverdueModal}
        onClose={() => setShowOverdueModal(false)}
        overdueQuests={overdueQuests}
        planName={plan.materialName}
        onReschedule={handleQuestReschedule}
      />
    </NotebookLayout>
  );
}
