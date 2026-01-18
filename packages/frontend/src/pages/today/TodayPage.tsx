/**
 * TodayPage
 * 오늘의 퀘스트 페이지 - 노트북 스타일
 * 간소화된 UI: 날짜 헤더 + 퀘스트 목록 + 빠른 액션
 */

import { NotebookLayout } from '../../components/notebook';
import { useTodayPage } from './hooks/useTodayPage';
import {
  EmptyState,
  QuickActions,
  MissedStudyModal,
  CrisisModal,
  RescheduleModal,
  EveningReviewModal,
  IntegratedQuestSection,
} from './components';

export function TodayPage() {
  const {
    // 상태
    plans, quests, selectedDate, coachData, showEveningReview, eveningReview,
    showMissedStudyAlert, showCrisisModal, rescheduleModal,
    isRescheduling, rescheduleTargetDate,
    // 계산값
    todayStr, isToday, isNewUser,
    // 액션
    setSelectedDate, setShowEveningReview, setShowMissedStudyAlert, setShowCrisisModal,
    setRescheduleModal, setRescheduleTargetDate, toggleQuestComplete,
    requestCrisisIntervention, handleMissedStudy,
    handleRescheduleConfirm, changeDate, navigate,
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

      {/* 통합 퀘스트 섹션 (날짜 헤더 + 퀘스트 목록) */}
      <IntegratedQuestSection
        quests={quests}
        selectedDate={selectedDate}
        todayStr={todayStr}
        isToday={isToday}
        onPrevDay={() => changeDate(-1)}
        onNextDay={() => changeDate(1)}
        onGoToToday={() => setSelectedDate(todayStr)}
        onToggleComplete={toggleQuestComplete}
      />

      {/* 빠른 액션 */}
      <QuickActions
        onChat={() => navigate('/chat')}
        onReport={() => navigate('/report')}
        onCrisis={() => setShowCrisisModal(true)}
      />
    </NotebookLayout>
  );
}
