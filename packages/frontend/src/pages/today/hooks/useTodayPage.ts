/**
 * useTodayPage Hook
 * TodayPage의 상태 관리 로직
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestStore, getTodayDateString, type QuestWithPlan } from '../../../stores/questStore';
import { useChatStore, DEFAULT_ROOM_ID } from '../../../stores/chatStore';
import { useAuthStore } from '../../../stores/authStore';
import { API_BASE_URL } from '../../../config';
import type { RescheduleModalState, DailyCoachData, EveningReviewData, OverduePlanGroup } from '../types';

export function useTodayPage() {
  const navigate = useNavigate();
  const { plans, getQuestsByDate, toggleQuestComplete, smartRescheduleQuests, rescheduleQuest } = useQuestStore();
  const { addMessage } = useChatStore();
  const { user, syncName } = useAuthStore();

  const studentName = user?.name || '';
  const studentId = user?.studentId || null;
  const todayStr = getTodayDateString();

  // 상태
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [coachData, setCoachData] = useState<DailyCoachData | null>(null);
  const [showEveningReview, setShowEveningReview] = useState(false);
  const [eveningReview, setEveningReview] = useState<EveningReviewData | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [showMissedStudyAlert, setShowMissedStudyAlert] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<RescheduleModalState>({
    isOpen: false,
    quest: null,
    mode: 'single',
  });
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState('');

  // 계산된 값
  const quests = getQuestsByDate(selectedDate);
  const isToday = selectedDate === todayStr;
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 18;
  const isNewUser = !studentId;

  // 미완료 퀘스트 계산
  const overdueQuests = useMemo(() => {
    const allOverdue: QuestWithPlan[] = [];
    for (const plan of plans) {
      for (const quest of plan.dailyQuests) {
        if (quest.date < todayStr && !quest.completed) {
          allOverdue.push({ ...quest, planId: plan.id, planName: plan.materialName });
        }
      }
    }
    return allOverdue.sort((a, b) => a.date.localeCompare(b.date));
  }, [plans, todayStr]);

  // 플랜별 미완료 퀘스트 그룹화
  const overdueByPlan = useMemo((): OverduePlanGroup[] => {
    const byPlan: Record<string, OverduePlanGroup> = {};
    for (const quest of overdueQuests) {
      if (!byPlan[quest.planId]) {
        byPlan[quest.planId] = { planId: quest.planId, planName: quest.planName, quests: [] };
      }
      byPlan[quest.planId].quests.push(quest);
    }
    return Object.values(byPlan);
  }, [overdueQuests]);

  // 코치 데이터 로드
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
        if (data.data.studentName) syncName(data.data.studentName);
        const coachInfo = {
          dailyMessage: data.data.dailyMessage,
          coachTip: data.data.coachTip,
          streak: data.data.summary?.currentStreak || 0,
          missedDays: data.data.summary?.missedDays || 0,
          needsIntervention: data.data.summary?.needsIntervention || false,
        };
        setCoachData(coachInfo);
        if (coachInfo.missedDays && coachInfo.missedDays >= 3) setShowMissedStudyAlert(true);
        if (coachInfo.needsIntervention) setShowCrisisModal(true);
      } else if (data.error?.message?.includes('학생을 찾을 수 없습니다')) {
        setCoachData({
          dailyMessage: '안녕하세요! 오늘도 함께 성장해요! 🌱',
          coachTip: '💡 AI 코치와 대화하며 학습 계획을 세워보세요!',
          streak: 0,
        });
      }
    } catch {
      setCoachData({
        dailyMessage: `안녕하세요 ${studentName || ''}님! 오늘도 파이팅이에요! 💪`,
        coachTip: '💡 작은 목표부터 차근차근 달성해봐요!',
        streak: 0,
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
        addMessage(DEFAULT_ROOM_ID, { role: 'assistant', content: data.data.message, agentRole: 'COACH' });
      }
    } catch {
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
        addMessage(DEFAULT_ROOM_ID, { role: 'assistant', content: data.data.message, agentRole: 'COACH' });
      }
    } catch {
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
        addMessage(DEFAULT_ROOM_ID, { role: 'assistant', content: data.data.message, agentRole: 'COACH' });
      }
    } catch {
      addMessage(DEFAULT_ROOM_ID, {
        role: 'assistant',
        content: `😊 ${studentName}님, 좀 쉬었어도 괜찮아요!\n\n다시 시작하는 것 자체가 대단한 거예요. 오늘은 가볍게 하나만 해볼까요? 💪`,
        agentRole: 'COACH',
      });
    }
    setShowMissedStudyAlert(false);
    navigate('/chat/' + DEFAULT_ROOM_ID);
  };

  // 퀘스트 재조정
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

  const openRescheduleModal = (quest: QuestWithPlan) => {
    setRescheduleTargetDate(todayStr);
    setRescheduleModal({ isOpen: true, quest, mode: 'single' });
  };

  const openBulkRescheduleModal = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setRescheduleTargetDate(todayStr);
      setRescheduleModal({ isOpen: true, quest: { planId, planName: plan.materialName } as QuestWithPlan, mode: 'bulk' });
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleModal.quest || !rescheduleTargetDate) return;
    setIsRescheduling(true);
    try {
      if (rescheduleModal.mode === 'single') {
        const success = rescheduleQuest(rescheduleModal.quest.planId, rescheduleModal.quest.id, rescheduleTargetDate);
        if (success) {
          addMessage(DEFAULT_ROOM_ID, {
            role: 'assistant',
            content: `✅ "${rescheduleModal.quest.unitTitle}" 퀘스트를 ${rescheduleTargetDate}로 이동했어요!`,
            agentRole: 'COACH',
          });
        }
      } else {
        const result = await smartRescheduleQuests(rescheduleModal.quest.planId, rescheduleTargetDate, 'smart');
        if (result?.success) {
          const message = result.warnings?.length
            ? `✅ ${result.rescheduledCount}개 퀘스트를 재조정했어요!\n⚠️ 주의: ${result.warnings.join(', ')}`
            : `✅ ${result.rescheduledCount}개 퀘스트를 스마트하게 재조정했어요! 📅`;
          addMessage(DEFAULT_ROOM_ID, { role: 'assistant', content: message, agentRole: 'COACH' });
        }
      }
    } catch {
      addMessage(DEFAULT_ROOM_ID, { role: 'assistant', content: '😅 재조정 중 오류가 발생했어요. 다시 시도해주세요.', agentRole: 'COACH' });
    } finally {
      setIsRescheduling(false);
      setRescheduleModal({ isOpen: false, quest: null, mode: 'single' });
    }
  };

  // 날짜 변경
  const changeDate = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  return {
    // 상태
    plans, quests, selectedDate, coachData, showEveningReview, eveningReview, isLoadingReview,
    showMissedStudyAlert, showCrisisModal, rescheduleModal, isRescheduling, rescheduleTargetDate,
    // 계산값
    todayStr, isToday, isEvening, isNewUser, overdueQuests, overdueByPlan,
    // 액션
    setSelectedDate, setShowEveningReview, setShowMissedStudyAlert, setShowCrisisModal,
    setRescheduleModal, setRescheduleTargetDate, toggleQuestComplete,
    requestEveningReview, requestCrisisIntervention, handleMissedStudy,
    handleRescheduleToToday, openRescheduleModal, openBulkRescheduleModal, handleRescheduleConfirm,
    changeDate, navigate, addMessage,
  };
}
