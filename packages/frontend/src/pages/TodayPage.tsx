/**
 * TodayPage
 * 오늘의 퀘스트 페이지 - 노트북 스타일 + AI 코치 통합
 * - 저녁 리뷰 (FR-025)
 * - 학습 리마인더 (FR-021)
 * - 미학습 대응 (FR-024)
 * - 위기 개입 트리거 (FR-026)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuestStore, getTodayDateString } from '../stores/questStore';
import { useChatStore } from '../stores/chatStore';
import {
  NotebookLayout,
  NotebookPage,
  DailyHeader,
  QuestCheckItem,
  PlanCard,
} from '../components/notebook';
import { API_BASE_URL } from '../config';

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
  const { plans, getQuestsByDate, toggleQuestComplete } = useQuestStore();
  const { addMessage } = useChatStore();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [coachData, setCoachData] = useState<DailyCoachData | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [showEveningReview, setShowEveningReview] = useState(false);
  const [eveningReview, setEveningReview] = useState<EveningReviewData | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [showMissedStudyAlert, setShowMissedStudyAlert] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);

  const todayStr = getTodayDateString();
  const quests = getQuestsByDate(selectedDate);
  const isToday = selectedDate === todayStr;
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 18; // 6 PM 이후

  // 학생 정보 및 코치 데이터 로드
  useEffect(() => {
    const storedName = localStorage.getItem('questybook_student_name');
    const storedId = localStorage.getItem('questybook_student_id');

    if (storedName) {
      setStudentName(storedName);
    }

    if (storedId) {
      setStudentId(storedId);
      fetchCoachData(storedId);
    } else {
      setCoachData({
        dailyMessage: '안녕하세요! 오늘도 함께 성장해요! 🌱',
        coachTip: '💡 25분 집중 + 5분 휴식의 포모도로 기법을 사용해보세요!',
        streak: 0,
      });
    }
  }, []);

  const fetchCoachData = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${id}/today`);
      const data = await response.json();

      if (data.success) {
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
      setCoachData({
        dailyMessage: `안녕 ${studentName || ''}님! 오늘도 파이팅! 💪`,
        coachTip: '💡 작은 목표부터 차근차근 달성해봐요!',
        streak: 3,
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
        addMessage({
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

  // 학습 리마인더 요청
  const requestReminder = async () => {
    if (!studentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        // 채팅 페이지로 이동하면서 메시지 추가
        addMessage({
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
        navigate('/chat');
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `📚 ${studentName}님, 오늘의 퀘스트가 기다리고 있어요!\n\n작은 것부터 시작해볼까요? 한 문제만 풀어봐요! 💪`,
        agentRole: 'COACH',
      });
      navigate('/chat');
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
        addMessage({
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `💕 ${studentName}님, 많이 힘드셨죠?\n\n괜찮아요. 누구나 지칠 때가 있어요. 지금은 무리하지 말고, 마음 편히 쉬어도 돼요.\n\n언제든 이야기하고 싶으면 여기 있을게요. 💙`,
        agentRole: 'COACH',
      });
    }

    setShowCrisisModal(false);
    navigate('/chat');
  };

  // 미학습 대응
  const handleMissedStudy = async () => {
    if (!studentId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/coach/students/${studentId}/missed-study`);
      const data = await response.json();

      if (data.success) {
        addMessage({
          role: 'assistant',
          content: data.data.message,
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `😊 ${studentName}님, 좀 쉬었어도 괜찮아요!\n\n다시 시작하는 것 자체가 대단한 거예요. 오늘은 가볍게 하나만 해볼까요? 💪`,
        agentRole: 'COACH',
      });
    }

    setShowMissedStudyAlert(false);
    navigate('/chat');
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

  // 신규 사용자 체크
  const isNewUser = !localStorage.getItem('questybook_student_id');

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

        <div className="postit mt-6 mx-auto max-w-xs">
          <p className="handwrite text-lg mb-2">💡 이렇게 시작해요:</p>
          <ol className="text-sm space-y-1 text-[var(--pencil-gray)]">
            <li>1. 코치와 대화로 학습 상담</li>
            <li>2. 교재 목차 사진 촬영</li>
            <li>3. AI가 맞춤 학습 플랜 생성!</li>
          </ol>
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

      {/* 일별 헤더 */}
      <DailyHeader
        date={selectedDate}
        quests={quests}
        onPrevDay={() => changeDate(-1)}
        onNextDay={() => changeDate(1)}
        onToday={() => setSelectedDate(todayStr)}
        isToday={isToday}
      />

      {/* 오늘의 퀘스트 */}
      <NotebookPage title="📝 오늘의 퀘스트" decoration="holes">
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
          <div className="space-y-0">
            {quests.map((quest) => (
              <QuestCheckItem
                key={`${quest.planId}-${quest.day}`}
                quest={quest}
                onToggle={() => toggleQuestComplete(quest.planId, quest.day)}
              />
            ))}
          </div>
        )}
      </NotebookPage>

      {/* 학습 시작 리마인더 (퀘스트가 있지만 하나도 완료 안됐을 때) */}
      {isToday && quests.length > 0 && quests.every(q => !q.completed) && currentHour >= 10 && (
        <div className="notebook-page-lined p-4 bg-[var(--highlight-yellow)] mt-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <p className="text-[var(--ink-black)] font-medium">아직 오늘 퀘스트를 시작 안 했어요!</p>
              <p className="text-sm text-[var(--pencil-gray)]">작은 것부터 시작해볼까요?</p>
            </div>
            <button
              onClick={requestReminder}
              className="px-4 py-2 bg-[var(--ink-blue)] text-white rounded-lg text-sm"
            >
              동기부여 받기
            </button>
          </div>
        </div>
      )}

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
