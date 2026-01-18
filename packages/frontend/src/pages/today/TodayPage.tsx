/**
 * TodayPage
 * 오늘의 퀘스트 페이지 - 노트북 스타일 + AI 코치 통합
 * - 저녁 리뷰 (FR-025)
 * - 학습 리마인더 (FR-021)
 * - 미학습 대응 (FR-024)
 * - 위기 개입 트리거 (FR-026)
 */

import { DEFAULT_ROOM_ID } from '../../stores/chatStore';
import { NotebookLayout } from '../../components/notebook';
import { useTodayPage } from './hooks/useTodayPage';
import {
  CoachMessage,
  OverdueQuests,
  EmptyState,
  QuickActions,
  TodayHeader,
  QuestList,
  ActivePlans,
  MissedStudyModal,
  CrisisModal,
  RescheduleModal,
  EveningReviewModal,
} from './components';

export function TodayPage() {
  const {
    // 상태
    plans, quests, selectedDate, coachData, showEveningReview, eveningReview,
    isLoadingReview, showMissedStudyAlert, showCrisisModal, rescheduleModal,
    isRescheduling, rescheduleTargetDate,
    // 계산값
    todayStr, isToday, isEvening, isNewUser, overdueQuests, overdueByPlan,
    // 액션
    setSelectedDate, setShowEveningReview, setShowMissedStudyAlert, setShowCrisisModal,
    setRescheduleModal, setRescheduleTargetDate, toggleQuestComplete,
    requestEveningReview, requestCrisisIntervention, handleMissedStudy,
    handleRescheduleToToday, openRescheduleModal, openBulkRescheduleModal,
    handleRescheduleConfirm, changeDate, navigate, addMessage,
  } = useTodayPage();

  // 플랜이 없을 때
  if (plans.length === 0) {
    return <EmptyState coachData={coachData} isNewUser={isNewUser} />;
  }

  return (
    <NotebookLayout>
      {/* 모달들 */}
      <MissedStudyModal
        show={showMissedStudyAlert}
        missedDays={coachData?.missedDays || 0}
        onConfirm={handleMissedStudy}
        onClose={() => setShowMissedStudyAlert(false)}
      />
      <CrisisModal
        show={showCrisisModal}
        onConfirm={requestCrisisIntervention}
        onClose={() => setShowCrisisModal(false)}
      />
      <RescheduleModal
        modal={rescheduleModal}
        targetDate={rescheduleTargetDate}
        todayStr={todayStr}
        isRescheduling={isRescheduling}
        onTargetDateChange={setRescheduleTargetDate}
        onConfirm={handleRescheduleConfirm}
        onClose={() => setRescheduleModal({ isOpen: false, quest: null, mode: 'single' })}
      />
      <EveningReviewModal
        show={showEveningReview}
        review={eveningReview}
        onClose={() => setShowEveningReview(false)}
      />

      {/* 코치 인사 메시지 */}
      {coachData && isToday && (
        <CoachMessage
          coachData={coachData}
          isEvening={isEvening}
          isLoadingReview={isLoadingReview}
          onChat={() => navigate('/chat')}
          onEveningReview={requestEveningReview}
        />
      )}

      {/* 미완료 퀘스트 섹션 */}
      {isToday && (
        <OverdueQuests
          overdueQuests={overdueQuests}
          overdueByPlan={overdueByPlan}
          onRescheduleToToday={handleRescheduleToToday}
          onOpenRescheduleModal={openRescheduleModal}
          onOpenBulkRescheduleModal={openBulkRescheduleModal}
          onAskCoach={(message) => addMessage(DEFAULT_ROOM_ID, { role: 'user', content: message })}
          onNavigate={navigate}
        />
      )}

      {/* 날짜 헤더 */}
      <TodayHeader
        selectedDate={selectedDate}
        quests={quests}
        todayStr={todayStr}
        isToday={isToday}
        onPrevDay={() => changeDate(-1)}
        onNextDay={() => changeDate(1)}
        onGoToToday={() => setSelectedDate(todayStr)}
      />

      {/* 퀘스트 목록 */}
      <QuestList
        quests={quests}
        selectedDate={selectedDate}
        isToday={isToday}
        onToggleComplete={toggleQuestComplete}
        onGoToToday={() => setSelectedDate(todayStr)}
      />

      {/* 진행 중인 플랜 */}
      <ActivePlans plans={plans} />

      {/* 빠른 액션 */}
      <QuickActions
        onChat={() => navigate('/chat')}
        onReport={() => navigate('/report')}
        onCrisis={() => setShowCrisisModal(true)}
      />
    </NotebookLayout>
  );
}
