/**
 * TodayPage
 * 오늘의 퀘스트 페이지 - 노트북 스타일 + AI 코치 통합
 * - 저녁 리뷰 (FR-025)
 * - 학습 리마인더 (FR-021)
 * - 미학습 대응 (FR-024)
 * - 위기 개입 트리거 (FR-026)
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuestStore, getTodayDateString, type QuestWithPlan } from '../stores/questStore';
import { useChatStore, DEFAULT_ROOM_ID } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import {
  NotebookLayout,
  NotebookPage,
  DailyHeader,
  PlanCard,
  SubjectAccordion,
} from '../components/notebook';
import { API_BASE_URL } from '../config';

// 재조정 모달 타입
interface RescheduleModalState {
  isOpen: boolean;
  quest: QuestWithPlan | null;
  mode: 'single' | 'bulk';
}

interface DailyCoachData {
  dailyMessage: string;
  coachTip: string;
  streak: number;
  missedDays?: number;
  needsIntervention?: boolean;
}

interface EveningReviewData {
  summary: string;
  completedCount: number;
  totalCount: number;
  tomorrowPreview: string;
}

export function TodayPage() {
  const navigate = useNavigate();
  const { plans, getQuestsByDate, toggleQuestComplete, smartRescheduleQuests, rescheduleQuest } = useQuestStore();
  const { addMessage } = useChatStore();
  const { user, syncName } = useAuthStore();
  const studentName = user?.name || '';
  const studentId = user?.studentId || null;
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [coachData, setCoachData] = useState<DailyCoachData | null>(null);
  const [showEveningReview, setShowEveningReview] = useState(false);
  const [eveningReview, setEveningReview] = useState<EveningReviewData | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [showMissedStudyAlert, setShowMissedStudyAlert] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  // 재조정 모달 상태
  const [rescheduleModal, setRescheduleModal] = useState<RescheduleModalState>({
    isOpen: false,
    quest: null,
    mode: 'single',
  });
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState('');

  const todayStr = getTodayDateString();
  const quests = getQuestsByDate(selectedDate);
  const isToday = selectedDate === todayStr;
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 18; // 6 PM 이후

  // 모든 과거 날짜의 미완료 퀘스트 계산 (오늘 이전)
  const overdueQuests = useMemo(() => {
    const allOverdue: QuestWithPlan[] = [];
    for (const plan of plans) {
      for (const quest of plan.dailyQuests) {
        // 오늘 이전 날짜이고 미완료인 퀘스트
        if (quest.date < todayStr && !quest.completed) {
          allOverdue.push({
            ...quest,
            planId: plan.id,
            planName: plan.materialName,
          });
        }
      }
    }
    // 날짜순 정렬 (오래된 것 먼저)
    return allOverdue.sort((a, b) => a.date.localeCompare(b.date));
  }, [plans, todayStr]);

  // 플랜별 미완료 퀘스트 그룹화
  const overdueByPlan = useMemo(() => {
    const byPlan: Record<string, { planId: string; planName: string; quests: QuestWithPlan[] }> = {};
    for (const quest of overdueQuests) {
      if (!byPlan[quest.planId]) {
        byPlan[quest.planId] = {
          planId: quest.planId,
          planName: quest.planName,
          quests: [],
        };
      }
      byPlan[quest.planId].quests.push(quest);
    }
    return Object.values(byPlan);
  }, [overdueQuests]);

  // 코치 데이터 로드 (authStore에서 studentId 사용)
  useEffect(() => {
    if (studentId) {
      fetchCoachData(studentId);
    } else {
      setCoachData({
        dailyMessage: '안녕하세요! 오늘도 함께 성장해요! 🌱',
        coachTip: '💡 25분 집중 + 5분 휴식의 포모도로 기법을 사용해보세요!',
        streak: 0,
      });
    }
  }, [studentId]);

  const fetchCoachData = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${id}/today`);
      const data = await response.json();

      if (data.success) {
        // 백엔드에서 받은 이름으로 authStore 동기화
        if (data.data.studentName) {
          syncName(data.data.studentName);
        }

        const coachInfo = {
          dailyMessage: data.data.dailyMessage,
          coachTip: data.data.coachTip,
          streak: data.data.summary?.currentStreak || 0,
          missedDays: data.data.summary?.missedDays || 0,
          needsIntervention: data.data.summary?.needsIntervention || false,
        };
        setCoachData(coachInfo);

        // 미학습 알림 표시 (3일 이상 미학습)
        if (coachInfo.missedDays && coachInfo.missedDays >= 3) {
          setShowMissedStudyAlert(true);
        }

        // 위기 개입 필요 여부 확인
        if (coachInfo.needsIntervention) {
          setShowCrisisModal(true);
        }
      } else if (data.error?.message?.includes('학생을 찾을 수 없습니다')) {
        // 학생 없음 - 기본 코치 데이터 사용
        setCoachData({
          dailyMessage: `안녕하세요! 오늘도 함께 성장해요! 🌱`,
          coachTip: '💡 AI 코치와 대화하며 학습 계획을 세워보세요!',
          streak: 0,
        });
      }
    } catch (error) {
      console.warn('[TodayPage] 코치 데이터 로드 실패:', error);
      setCoachData({
        dailyMessage: `안녕하세요 ${studentName || ''}님! 오늘도 파이팅이에요! 💪`,
        coachTip: '💡 작은 목표부터 차근차근 달성해봐요!',
        streak: 0,  // 실제 데이터 없으면 0
      });
    }
  };

  // 저녁 리뷰 요청
  const requestEveningReview = async () => {
    if (!studentId) return;

    setIsLoadingReview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/evening-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr }),
      });

      const data = await response.json();

      if (data.success) {
        setEveningReview({
          summary: data.data.message,
          completedCount: data.data.completedCount || 0,
          totalCount: data.data.totalCount || 0,
          tomorrowPreview: data.data.tomorrowPreview || '내일도 화이팅!',
        });
        setShowEveningReview(true);

        // 채팅 히스토리에도 추가
        addMessage(DEFAULT_ROOM_ID, {
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      // 오프라인 폴백
      const completedCount = quests.filter(q => q.completed).length;
      const totalCount = quests.length;

      setEveningReview({
        summary: `🌙 오늘도 고생했어요, ${studentName}님!\n\n오늘 ${completedCount}/${totalCount}개 퀘스트를 완료했어요.\n${completedCount === totalCount ? '완벽해요! 🎉' : '내일도 함께 화이팅!'}\n\n푹 쉬고 내일 봐요! 💤`,
        completedCount,
        totalCount,
        tomorrowPreview: '내일도 함께 성장해요!',
      });
      setShowEveningReview(true);
    } finally {
      setIsLoadingReview(false);
    }
  };

  // 위기 개입 요청
  const requestCrisisIntervention = async () => {
    if (!studentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/crisis-intervention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'moderate' }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage(DEFAULT_ROOM_ID, {
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: `💕 ${studentName}님, 많이 힘드셨죠?\n\n괜찮아요. 누구나 지칠 때가 있어요. 지금은 무리하지 말고, 마음 편히 쉬어도 돼요.\n\n언제든 이야기하고 싶으면 여기 있을게요. 💙`,
        agentRole: 'COACH',
      });
    }

    setShowCrisisModal(false);
    navigate('/chat/' + DEFAULT_ROOM_ID);
  };

  // 미학습 대응
  const handleMissedStudy = async () => {
    if (!studentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/missed-study`);
      const data = await response.json();

      if (data.success) {
        addMessage(DEFAULT_ROOM_ID, {
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: `😊 ${studentName}님, 좀 쉬었어도 괜찮아요!\n\n다시 시작하는 것 자체가 대단한 거예요. 오늘은 가볍게 하나만 해볼까요? 💪`,
        agentRole: 'COACH',
      });
    }

    setShowMissedStudyAlert(false);
    navigate('/chat/' + DEFAULT_ROOM_ID);
  };

  // 단일 퀘스트 재조정 (오늘로)
  const handleRescheduleToToday = (quest: QuestWithPlan) => {
    const success = rescheduleQuest(quest.planId, quest.id, todayStr);
    if (success) {
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: `✅ "${quest.unitTitle}" 퀘스트를 오늘로 이동했어요! 화이팅! 💪`,
        agentRole: 'COACH',
      });
    }
  };

  // 재조정 모달 열기 (개별 퀘스트)
  const openRescheduleModal = (quest: QuestWithPlan) => {
    setRescheduleTargetDate(todayStr);
    setRescheduleModal({ isOpen: true, quest, mode: 'single' });
  };

  // 전체 재조정 모달 열기 (플랜 단위)
  const openBulkRescheduleModal = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setRescheduleTargetDate(todayStr);
      setRescheduleModal({
        isOpen: true,
        quest: { planId, planName: plan.materialName } as QuestWithPlan,
        mode: 'bulk',
      });
    }
  };

  // 모달에서 재조정 실행
  const handleRescheduleConfirm = async () => {
    if (!rescheduleModal.quest || !rescheduleTargetDate) return;

    setIsRescheduling(true);
    try {
      if (rescheduleModal.mode === 'single') {
        // 단일 퀘스트 재조정
        const success = rescheduleQuest(
          rescheduleModal.quest.planId,
          rescheduleModal.quest.id,
          rescheduleTargetDate
        );
        if (success) {
          addMessage(DEFAULT_ROOM_ID, {
            role: 'assistant',
            content: `✅ "${rescheduleModal.quest.unitTitle}" 퀘스트를 ${rescheduleTargetDate}로 이동했어요!`,
            agentRole: 'COACH',
          });
        }
      } else {
        // 플랜 전체 스마트 재조정
        const result = await smartRescheduleQuests(
          rescheduleModal.quest.planId,
          rescheduleTargetDate,
          'smart'
        );
        if (result?.success) {
          const message = result.warnings?.length
            ? `✅ ${result.rescheduledCount}개 퀘스트를 재조정했어요!\n⚠️ 주의: ${result.warnings.join(', ')}`
            : `✅ ${result.rescheduledCount}개 퀘스트를 스마트하게 재조정했어요! 다른 플랜과의 충돌도 고려했습니다. 📅`;
          addMessage(DEFAULT_ROOM_ID, {
            role: 'assistant',
            content: message,
            agentRole: 'COACH',
          });
        }
      }
    } catch (error) {
      console.error('[TodayPage] 재조정 실패:', error);
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: '😅 재조정 중 오류가 발생했어요. 다시 시도해주세요.',
        agentRole: 'COACH',
      });
    } finally {
      setIsRescheduling(false);
      setRescheduleModal({ isOpen: false, quest: null, mode: 'single' });
    }
  };

  // 날짜 이동
  const changeDate = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // 신규 사용자 체크 (authStore에서 studentId 사용)
  const isNewUser = !studentId;

  // 플랜이 없을 때
  if (plans.length === 0) {
    return (
      <NotebookLayout>
        {coachData && (
          <div className="notebook-page-lined p-4 bg-[var(--highlight-green)] mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
                🤖
              </div>
              <div className="flex-1">
                <p className="text-[var(--ink-black)] font-medium">{coachData.dailyMessage}</p>
                <p className="text-sm text-[var(--pencil-gray)] mt-1">{coachData.coachTip}</p>
              </div>
              {coachData.streak > 0 && (
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-sm">
                  🔥 {coachData.streak}일
                </div>
              )}
            </div>
          </div>
        )}

        <NotebookPage decoration="holes" className="text-center">
          <div className="py-12">
            <div className="text-6xl mb-4">📓</div>
            <h1 className="handwrite handwrite-xl text-[var(--ink-black)] mb-2">
              QuestyBook
            </h1>
            <p className="text-[var(--pencil-gray)] mb-6">
              {isNewUser ? (
                <>
                  처음 오셨네요! 👋<br />
                  AI 코치와 함께 학습 여정을 시작해볼까요?
                </>
              ) : (
                <>
                  아직 학습 플랜이 없어요!<br />
                  새로운 퀘스트를 만들어볼까요?
                </>
              )}
            </p>

            <div className="flex flex-col gap-3">
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 sticker sticker-mint text-base px-6 py-3"
              >
                💬 코치와 대화하기
              </Link>
              <Link
                to="/generate"
                className="inline-flex items-center gap-2 sticker sticker-gold text-base px-6 py-3"
              >
                ✨ 퀘스트 생성하기
              </Link>
            </div>
          </div>
        </NotebookPage>

        {/* 꿀팁 메모장 */}
        <div className="postit mt-6 mx-auto max-w-sm">
          <p className="handwrite text-lg mb-3">💡 QuestyBook 사용 꿀팁</p>
          <ul className="text-sm space-y-2 text-[var(--pencil-gray)]">
            <li className="flex items-start gap-2">
              <span>📸</span>
              <span>교재 목차 사진을 찍어 보내면 AI가 학습 플랜을 만들어줘요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>💬</span>
              <span>코치에게 "오늘 뭐 공부해?" 라고 물어보세요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>✅</span>
              <span>퀘스트 완료 시 체크하면 연속 학습일이 쌓여요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>🔥</span>
              <span>7일 연속 달성하면 특별 배지를 받을 수 있어요!</span>
            </li>
          </ul>
        </div>
      </NotebookLayout>
    );
  }

  return (
    <NotebookLayout>
      {/* 미학습 알림 모달 */}
      {showMissedStudyAlert && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="text-5xl mb-3">😢</div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                좀 쉬었네요...
              </h3>
              <p className="text-[var(--pencil-gray)] mb-4">
                {coachData?.missedDays}일 동안 학습을 쉬었어요.<br />
                다시 시작해볼까요?
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleMissedStudy}
                  className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg"
                >
                  💪 다시 시작하기
                </button>
                <button
                  onClick={() => setShowMissedStudyAlert(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg"
                >
                  나중에
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 위기 개입 모달 */}
      {showCrisisModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="text-5xl mb-3">💙</div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                많이 힘드셨죠?
              </h3>
              <p className="text-[var(--pencil-gray)] mb-4">
                최근 학습이 어려워 보여요.<br />
                코치가 도움을 드릴게요.
              </p>
              <div className="space-y-2">
                <button
                  onClick={requestCrisisIntervention}
                  className="w-full py-3 bg-[var(--sticker-mint)] text-white rounded-lg"
                >
                  💬 코치와 대화하기
                </button>
                <button
                  onClick={() => setShowCrisisModal(false)}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg"
                >
                  괜찮아요
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 재조정 모달 */}
      {rescheduleModal.isOpen && rescheduleModal.quest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                {rescheduleModal.mode === 'single' ? '퀘스트 일정 변경' : '전체 일정 재조정'}
              </h3>
              <p className="text-[var(--pencil-gray)] mb-4 text-sm">
                {rescheduleModal.mode === 'single'
                  ? `"${rescheduleModal.quest.unitTitle}" 퀘스트를 언제로 옮길까요?`
                  : `"${rescheduleModal.quest.planName}" 플랜의 미완료 퀘스트를 스마트하게 재배치합니다.`}
              </p>

              {/* 날짜 선택 */}
              <div className="mb-4">
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">
                  {rescheduleModal.mode === 'single' ? '새 날짜' : '시작 날짜'}
                </label>
                <input
                  type="date"
                  value={rescheduleTargetDate}
                  onChange={(e) => setRescheduleTargetDate(e.target.value)}
                  min={todayStr}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-center"
                />
              </div>

              {/* 스마트 재조정 설명 */}
              {rescheduleModal.mode === 'bulk' && (
                <div className="bg-[var(--highlight-blue)] rounded-lg p-3 mb-4 text-left">
                  <p className="text-xs text-[var(--ink-blue)]">
                    🧠 <strong>스마트 재조정</strong>이란?
                    <br />
                    • 다른 플랜과의 시간 충돌 방지
                    <br />
                    • 하루 학습량 80% 버퍼 규칙 적용
                    <br />
                    • 균등한 일정 분배
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleRescheduleConfirm}
                  disabled={isRescheduling || !rescheduleTargetDate}
                  className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg disabled:opacity-50"
                >
                  {isRescheduling ? '재조정 중...' : rescheduleModal.mode === 'single' ? '날짜 변경' : '🧠 스마트 재조정'}
                </button>
                <button
                  onClick={() => setRescheduleModal({ isOpen: false, quest: null, mode: 'single' })}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 저녁 리뷰 모달 */}
      {showEveningReview && eveningReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <div className="text-5xl mb-3">🌙</div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                오늘의 학습 리뷰
              </h3>
              <div className="my-4 flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--ink-blue)]">
                    {eveningReview.completedCount}
                  </div>
                  <div className="text-xs text-[var(--pencil-gray)]">완료</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-300">
                    {eveningReview.totalCount - eveningReview.completedCount}
                  </div>
                  <div className="text-xs text-[var(--pencil-gray)]">남음</div>
                </div>
              </div>
              <p className="text-[var(--pencil-gray)] text-sm whitespace-pre-wrap mb-4">
                {eveningReview.summary}
              </p>
              <button
                onClick={() => setShowEveningReview(false)}
                className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 코치 인사 메시지 */}
      {coachData && isToday && (
        <div className="notebook-page-lined p-4 bg-[var(--highlight-green)] mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
              🤖
            </div>
            <div className="flex-1">
              <p className="text-[var(--ink-black)] font-medium">{coachData.dailyMessage}</p>
              <p className="text-sm text-[var(--pencil-gray)] mt-1">{coachData.coachTip}</p>
            </div>
            {coachData.streak > 0 && (
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-sm shadow-sm">
                🔥 {coachData.streak}일
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate('/chat')}
              className="flex-1 py-2 bg-white/50 rounded-lg text-sm text-[var(--ink-black)] hover:bg-white/70 transition-colors"
            >
              💬 질문하기
            </button>
            {isEvening && (
              <button
                onClick={requestEveningReview}
                disabled={isLoadingReview}
                className="flex-1 py-2 bg-white/80 rounded-lg text-sm text-[var(--ink-black)] hover:bg-white transition-colors disabled:opacity-50"
              >
                {isLoadingReview ? '로딩...' : '🌙 저녁 리뷰'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 미완료 퀘스트 섹션 (이전 날짜에서 밀린 퀘스트) */}
      {isToday && overdueQuests.length > 0 && (
        <div className="notebook-page-lined p-4 bg-[var(--highlight-pink)] mb-4 rounded-lg border-l-4 border-[var(--sticker-coral)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏰</span>
              <h3 className="font-semibold text-[var(--ink-black)]">
                미완료 퀘스트 ({overdueQuests.length}개)
              </h3>
            </div>
            {/* 전체 재조정 버튼 (플랜이 하나일 때만) */}
            {overdueByPlan.length === 1 && (
              <button
                onClick={() => openBulkRescheduleModal(overdueByPlan[0].planId)}
                className="text-xs px-3 py-1 bg-[var(--ink-blue)] text-white rounded-full hover:bg-blue-600 transition-colors"
              >
                🧠 전체 재조정
              </button>
            )}
          </div>

          {/* 플랜별 미완료 퀘스트 목록 */}
          <div className="space-y-3">
            {overdueByPlan.map((planGroup) => (
              <div key={planGroup.planId} className="bg-white/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--ink-black)]">
                    📚 {planGroup.planName}
                  </span>
                  {overdueByPlan.length > 1 && (
                    <button
                      onClick={() => openBulkRescheduleModal(planGroup.planId)}
                      className="text-xs px-2 py-1 bg-[var(--sticker-mint)] text-white rounded hover:bg-emerald-500"
                    >
                      재조정
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {planGroup.quests.slice(0, 3).map((quest) => (
                    <div
                      key={quest.id}
                      className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[var(--pencil-gray)] mr-2">
                          {quest.date.slice(5).replace('-', '/')}
                        </span>
                        <span className="text-[var(--ink-black)] truncate">
                          {quest.unitTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleRescheduleToToday(quest)}
                          className="text-xs px-2 py-1 bg-[var(--ink-blue)] text-white rounded hover:bg-blue-600"
                          title="오늘로 이동"
                        >
                          오늘
                        </button>
                        <button
                          onClick={() => openRescheduleModal(quest)}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          title="날짜 선택"
                        >
                          📅
                        </button>
                      </div>
                    </div>
                  ))}
                  {planGroup.quests.length > 3 && (
                    <p className="text-xs text-[var(--pencil-gray)] text-center py-1">
                      +{planGroup.quests.length - 3}개 더...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* AI 코치에게 도움 요청 */}
          <div className="mt-3 pt-3 border-t border-[var(--sticker-coral)]/30">
            <button
              onClick={() => {
                addMessage(DEFAULT_ROOM_ID, {
                  role: 'user',
                  content: `밀린 퀘스트 ${overdueQuests.length}개를 어떻게 처리하면 좋을까요?`,
                });
                navigate('/chat/' + DEFAULT_ROOM_ID);
              }}
              className="w-full py-2 text-sm text-[var(--ink-blue)] hover:underline"
            >
              💬 AI 코치에게 일정 조언 받기
            </button>
          </div>
        </div>
      )}

      {/* 일별 헤더 */}
      <DailyHeader
        date={selectedDate}
        quests={quests}
        onPrevDay={() => changeDate(-1)}
        onNextDay={() => changeDate(1)}
        onToday={() => setSelectedDate(todayStr)}
        isToday={isToday}
      />

      {/* 과거 날짜 요약 (오늘이 아닐 때만 표시) */}
      {!isToday && quests.length > 0 && (
        <div className="notebook-page-lined p-4 bg-gray-50 mb-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--ink-black)]">
                {selectedDate < todayStr ? '이 날의 학습 기록' : '예정된 학습'}
              </h3>
              <p className="text-sm text-[var(--pencil-gray)]">
                {selectedDate < todayStr
                  ? '과거 기록은 수정할 수 없어요 (읽기 전용)'
                  : '미래 퀘스트는 해당 날짜가 되면 시작할 수 있어요'}
              </p>
            </div>
          </div>
          {/* 완료 통계 */}
          {selectedDate < todayStr && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-[var(--sticker-mint)] font-bold text-lg">
                  {quests.filter(q => q.completed).length}
                </span>
                <span className="text-sm text-[var(--pencil-gray)]">완료</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-bold text-lg">
                  {quests.filter(q => !q.completed).length}
                </span>
                <span className="text-sm text-[var(--pencil-gray)]">미완료</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[var(--ink-blue)] text-sm hover:underline"
              >
                오늘로 돌아가기 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 오늘의 퀘스트 */}
      <NotebookPage title={isToday ? "📝 오늘의 퀘스트" : `📝 ${selectedDate.slice(5).replace('-', '/')} 퀘스트`} decoration="holes">
        {quests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--pencil-gray)]">
              이 날짜에 예정된 퀘스트가 없어요
            </p>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[var(--ink-blue)] text-sm mt-2 hover:underline"
              >
                오늘로 돌아가기
              </button>
            )}
          </div>
        ) : (
          <SubjectAccordion
            quests={quests}
            onToggle={toggleQuestComplete}
            groupBy="planName"
          />
        )}
      </NotebookPage>

      {/* 진행 중인 플랜 미리보기 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-2">
          <h2 className="handwrite text-xl text-[var(--ink-black)]">
            📚 진행 중인 플랜
          </h2>
          <Link
            to="/planner"
            className="text-sm text-[var(--ink-blue)] hover:underline"
          >
            전체 보기
          </Link>
        </div>
        <div className="space-y-3">
          {plans.slice(0, 2).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
          {plans.length > 2 && (
            <Link
              to="/planner"
              className="block text-center text-sm text-[var(--ink-blue)] hover:underline py-2"
            >
              +{plans.length - 2}개 더 보기
            </Link>
          )}
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate('/chat')}
          className="flex-1 py-3 bg-[var(--sticker-mint)] text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm"
        >
          💬 코치와 대화
        </button>
        <button
          onClick={() => navigate('/report')}
          className="flex-1 py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          📊 학습 리포트
        </button>
      </div>

      {/* 힘들 때 버튼 */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowCrisisModal(true)}
          className="text-[var(--pencil-gray)] text-sm hover:text-[var(--ink-blue)]"
        >
          😔 공부가 너무 힘들어요...
        </button>
      </div>
    </NotebookLayout>
  );
}
