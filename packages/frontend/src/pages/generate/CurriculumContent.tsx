/**
 * CurriculumContent
 * 인강 커리큘럼 기반 퀘스트 생성 콘텐츠
 * GeneratePageV2의 탭 콘텐츠로 사용됨
 */

import { useState } from 'react';
import { NotebookPage } from '../../components/notebook/NotebookPage';
import { useCurriculumGeneration } from '../../hooks/useCurriculumGeneration';
import { useMembershipCheck } from '../../hooks/useMembershipCheck';
import { TrialEndedModal } from '../../components/TrialEndedModal';
import { SOCIAL_SUBJECTS, SCIENCE_SUBJECTS } from '../my/constants';
import { CourseSelectionStep } from './curriculum-components/CourseSelectionStep';
import { PreviewStep } from './curriculum-components/PreviewStep';
import { AIReviewCard } from './curriculum-components/AIReviewCard';
import type { Course, SelectedCourse, SubjectRatio, SubjectHours, SubjectDays, CurriculumOptions, ValidationResult, CurriculumReviewResult } from '../../types/curriculum';

type Step = 'settings' | 'courses' | 'preview';

export function CurriculumContent() {
  const [step, setStep] = useState<Step>('settings');
  const {
    searchResults,
    selectedCourses,
    subjectRatio,
    subjectHours,
    subjectDays,
    curriculumOptions,
    targetDate,
    dailyStudyHours,
    generatedQuests,
    questSummary,
    showTimeExceededWarning,
    requiredHoursPerDay,
    // 검증 결과 상태
    validationResult,
    showValidationError,
    // AI 에이전트 리뷰 결과
    reviewResult,
    setSubjectRatio,
    setSubjectHours,
    setSubjectDays,
    setCurriculumOptions,
    setTargetDate,
    selectCourse,
    deselectCourse,
    updateCourseStartChapter,
    searchCourses,
    generateQuests,
    addToPlannerAndNavigate,
    updatePracticeNote,
    adjustDailyStudyHours,
    dismissTimeWarning,
    dismissValidationError,
    isSearching,
    isGenerating,
    generateError,
  } = useCurriculumGeneration();

  // 멤버십 체크 (AI 기능 사용 가능 여부)
  const {
    checkAndShowModal,
    showTrialEndedModal,
    attemptedFeature,
    closeModal,
  } = useMembershipCheck();

  // 사전 실현 가능성 검증 상태
  const [feasibilityError, setFeasibilityError] = useState<string | null>(null);

  // 사전 실현 가능성 검증 (생성 버튼 누르기 전)
  const checkFeasibility = (): { feasible: boolean; error?: string; warning?: string } => {
    if (selectedCourses.length === 0) {
      return { feasible: false, error: '강좌를 선택해주세요.' };
    }

    if (!targetDate) {
      return { feasible: false, error: '목표일을 설정해주세요.' };
    }

    // 총 강의 수 계산
    const totalLectures = selectedCourses.reduce((sum, course) => {
      const startFrom = course.startFromChapter ?? 0;
      return sum + (course.chapters?.length ?? 0) - startFrom;
    }, 0);

    // 가용일 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    const totalDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
      return { feasible: false, error: '목표일은 오늘 이후여야 합니다.' };
    }

    // 과목별 일일 학습 시간 합계 계산
    const totalDailyMinutes = Object.values(subjectHours).reduce((sum, h) => sum + ((h ?? 0) * 60), 0);
    if (totalDailyMinutes <= 0) {
      return { feasible: false, error: '최소 1개 과목의 학습 시간을 설정해주세요.' };
    }

    // 인강 시간 100% 사용 (문제풀이 시간 별도 배정 안 함)
    const maxLectureMinutesPerDay = totalDailyMinutes;
    // 평균 강의 시간: 30분
    const avgLectureMinutes = 30;
    // 최소 1개 인강 보장
    const maxLecturesPerDay = Math.max(1, Math.floor(maxLectureMinutesPerDay / avgLectureMinutes));

    // 필요한 일수 계산
    const requiredDays = Math.ceil(totalLectures / maxLecturesPerDay);
    const avgLecturesPerDay = totalLectures / totalDays;

    if (requiredDays > totalDays) {
      return {
        feasible: false,
        error: `${totalLectures}개 강의를 ${totalDays}일 내에 완료할 수 없습니다.\n` +
          `현재 설정: 하루 최대 ${maxLecturesPerDay}개 (${Math.round(totalDailyMinutes / 60)}시간 기준)\n` +
          `필요 일수: 최소 ${requiredDays}일\n` +
          `💡 목표일을 ${requiredDays - totalDays}일 이상 연장하거나 학습 시간을 늘려주세요.`,
      };
    }

    if (avgLecturesPerDay > 6) {
      return {
        feasible: true,
        warning: `하루 평균 ${avgLecturesPerDay.toFixed(1)}개 강의는 다소 빡빡한 일정입니다. 계속 진행하시겠습니까?`,
      };
    }

    return { feasible: true };
  };

  // 퀘스트 생성 (멤버십 체크 + 실현 가능성 체크 포함)
  const handleGenerateWithCheck = () => {
    // 실현 가능성 체크
    const feasibility = checkFeasibility();
    if (!feasibility.feasible) {
      setFeasibilityError(feasibility.error ?? '알 수 없는 오류');
      return false;
    }

    // 경고가 있으면 확인 후 진행
    if (feasibility.warning) {
      if (!window.confirm(feasibility.warning)) {
        return false;
      }
    }

    setFeasibilityError(null);

    // 멤버십 체크 (AI 커리큘럼 생성은 베타테스터 전용)
    if (!checkAndShowModal('AI 커리큘럼 생성')) {
      return false; // 모달이 표시되고 함수 종료
    }
    generateQuests();
    return true;
  };

  return (
    <>
      <NotebookPage decoration="tape">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
            📚 인강 커리큘럼 생성
          </h1>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">
            인강 강좌를 선택하고 과목별 비중에 맞춰 일일 퀘스트를 생성합니다
          </p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex justify-center items-center gap-1 sm:gap-2 mb-6">
          <StepIndicator step={1} current={step} target="settings" label="설정" />
          <span className="text-gray-300 hidden sm:block">→</span>
          <StepIndicator step={2} current={step} target="courses" label="강좌선택" />
          <span className="text-gray-300 hidden sm:block">→</span>
          <StepIndicator step={3} current={step} target="preview" label="확인" />
        </div>

        {/* Step 1: 설정 */}
        {step === 'settings' && (
          <SettingsStep
            targetDate={targetDate}
            subjectRatio={subjectRatio}
            subjectHours={subjectHours}
            subjectDays={subjectDays}
            curriculumOptions={curriculumOptions}
            onTargetDateChange={setTargetDate}
            onSubjectRatioChange={setSubjectRatio}
            onSubjectHoursChange={setSubjectHours}
            onSubjectDaysChange={setSubjectDays}
            onCurriculumOptionsChange={setCurriculumOptions}
            onNext={() => {
              // 스텝2로 이동 시 이전 에러 초기화 (설정 변경 후 재검증 가능하도록)
              setFeasibilityError(null);
              setStep('courses');
            }}
          />
        )}

        {/* Step 2: 강좌 선택 */}
        {step === 'courses' && (
          <CourseSelectionStep
            searchResults={searchResults}
            selectedCourses={selectedCourses}
            isSearching={isSearching}
            feasibilityError={feasibilityError}
            onSearch={(query, subject) => searchCourses({ query, subject })}
            onSearchBySubject={(subject, query) => searchCourses({ subject, query })}
            onSelect={(course) => {
              // 강좌 선택 시 이전 에러 초기화 (조건 변경됨)
              setFeasibilityError(null);
              selectCourse(course);
            }}
            onDeselect={(courseId) => {
              // 강좌 해제 시 이전 에러 초기화 (조건 변경됨)
              setFeasibilityError(null);
              deselectCourse(courseId);
            }}
            onUpdateStartChapter={(courseId, chapterIndex) => {
              // 이어듣기 변경 시 이전 에러 초기화 (조건 변경됨)
              setFeasibilityError(null);
              updateCourseStartChapter(courseId, chapterIndex);
            }}
            onBack={() => setStep('settings')}
            onNext={() => {
              // 멤버십 체크 후 생성
              if (handleGenerateWithCheck()) {
                setStep('preview');
              }
            }}
            onClearError={() => setFeasibilityError(null)}
          />
        )}

        {/* Step 3: 프리뷰 & 확인 */}
        {step === 'preview' && (
          <PreviewStep
            quests={generatedQuests}
            summary={questSummary}
            review={reviewResult}
            isLoading={isGenerating}
            error={showValidationError ? null : generateError}
            onBack={() => setStep('courses')}
            onConfirm={addToPlannerAndNavigate}
            onUpdatePracticeNote={updatePracticeNote}
            dailyStudyHours={dailyStudyHours}
            showTimeExceededWarning={showTimeExceededWarning}
            requiredHoursPerDay={requiredHoursPerDay}
            onAdjustHours={adjustDailyStudyHours}
            onDismissWarning={dismissTimeWarning}
          />
        )}

        {/* 꿀팁 메모장 */}
        <div className="postit mt-6">
          <p className="handwrite text-lg mb-3">💡 커리큘럼 생성 꿀팁</p>
          <ul className="text-sm space-y-2 text-[var(--pencil-gray)]">
            {step === 'settings' && (
              <>
                <li className="flex items-start gap-2">
                  <span>🎯</span>
                  <span>목표일은 시험일보다 1주일 전으로 설정하면 여유가 생겨서 1주일동안 복습할 수 있어요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>⚖️</span>
                  <span>취약 과목에 더 많은 시간을 배분하세요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>💪</span>
                  <span>시간이 없는 과목은 비워두면 자동으로 제외돼요</span>
                </li>
              </>
            )}
            {step === 'courses' && (
              <>
                <li className="flex items-start gap-2">
                  <span>🔍</span>
                  <span>강사명으로 검색하면 해당 강사의 모든 강좌가 나와요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>📚</span>
                  <span>과목 버튼을 누르면 해당 과목 강좌만 필터링돼요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>▶️</span>
                  <span>이미 들은 강의가 있다면 '이어듣기'로 시작점을 지정하세요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>✅</span>
                  <span>여러 강좌를 선택해서 통합 커리큘럼을 만들 수 있어요</span>
                </li>
              </>
            )}
            {step === 'preview' && (
              <>
                <li className="flex items-start gap-2">
                  <span>📋</span>
                  <span>생성된 퀘스트를 확인하고 플래너에 추가하세요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>✏️</span>
                  <span>문제풀이 퀘스트는 메모를 추가해서 구체화할 수 있어요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>🔄</span>
                  <span>마음에 안 들면 '이전'을 눌러 강좌를 수정할 수 있어요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>📅</span>
                  <span>플래너에 추가되면 오늘의 퀘스트에서 바로 확인돼요</span>
                </li>
              </>
            )}
          </ul>
        </div>
      </NotebookPage>

      {/* 체험판 종료 모달 */}
      <TrialEndedModal
        isOpen={showTrialEndedModal}
        onClose={closeModal}
        featureName={attemptedFeature ?? undefined}
      />

      {/* 검증 실패 모달 */}
      <ValidationErrorModal
        isOpen={showValidationError}
        onClose={() => {
          dismissValidationError();
          setStep('settings');
        }}
        validation={validationResult}
      />
    </>
  );
}

// ===== 서브 컴포넌트 =====

function StepIndicator({
  step,
  current,
  target,
  label
}: {
  step: number;
  current: Step;
  target: Step;
  label: string;
}) {
  const isActive = current === target;
  const isPast =
    (target === 'settings') ||
    (target === 'courses' && current === 'preview');

  return (
    <div className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[var(--ink-blue)] text-white'
        : isPast
          ? 'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
          : 'bg-gray-100 text-gray-400'
    }`}>
      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0">
        {step}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// 요일 상수
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function SettingsStep(props: {
  targetDate: string;
  subjectRatio: SubjectRatio;
  subjectHours: SubjectHours;
  subjectDays: SubjectDays;
  curriculumOptions: CurriculumOptions;
  onTargetDateChange: (date: string) => void;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  onSubjectHoursChange: (hours: SubjectHours) => void;
  onSubjectDaysChange: (days: SubjectDays) => void;
  onCurriculumOptionsChange: (options: CurriculumOptions) => void;
  onNext: () => void;
}) {
  const [inputMode, setInputMode] = useState<'hours' | 'ratio'>('hours');

  const totalHours = Object.values(props.subjectHours).reduce((sum, h) => sum + (h || 0), 0);
  const hasAtLeastOneSubject = Object.values(props.subjectHours).some(h => h !== null && h > 0);
  const totalRatio = Object.values(props.subjectRatio).reduce((a, b) => a + b, 0);
  const isValidRatio = totalRatio === 100;
  const canProceed = inputMode === 'hours' ? hasAtLeastOneSubject : isValidRatio;

  const defaultTargetDate = () => new Date().toISOString().split('T')[0];

  // 요일 토글 핸들러
  const toggleDay = (subject: keyof SubjectDays, day: number) => {
    const currentDays = props.subjectDays[subject];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    props.onSubjectDaysChange({
      ...props.subjectDays,
      [subject]: newDays,
    });
  };

  return (
    <div className="space-y-6">
      {/* 목표일 */}
      <div className="notebook-card p-4">
        <label className="block text-sm font-medium mb-2">🎯 목표일</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => props.onTargetDateChange('2026-03-24')}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              props.targetDate === '2026-03-24'
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            3모
          </button>
          <button
            type="button"
            onClick={() => props.onTargetDateChange('2026-06-04')}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              props.targetDate === '2026-06-04'
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            6모
          </button>
          <button
            type="button"
            onClick={() => props.onTargetDateChange('2026-09-02')}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              props.targetDate === '2026-09-02'
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            9모
          </button>
          <button
            type="button"
            onClick={() => props.onTargetDateChange('2026-11-19')}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              props.targetDate === '2026-11-19'
                ? 'bg-[var(--sticker-coral)] text-white'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            수능
          </button>
        </div>
        <input
          type="date"
          value={props.targetDate || defaultTargetDate()}
          onChange={(e) => props.onTargetDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
        />
      </div>

      {/* 과목별 학습 시간 설정 */}
      <div className="notebook-card p-4">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-medium">📊 과목별 학습 시간</label>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('hours')}
              className={`px-2 py-1 text-xs rounded ${inputMode === 'hours' ? 'bg-[var(--ink-blue)] text-white' : 'bg-gray-100'}`}
            >
              시간
            </button>
            <button
              onClick={() => setInputMode('ratio')}
              className={`px-2 py-1 text-xs rounded ${inputMode === 'ratio' ? 'bg-[var(--ink-blue)] text-white' : 'bg-gray-100'}`}
            >
              비중(%)
            </button>
          </div>
        </div>

        {inputMode === 'hours' ? (
          <>
            {Object.entries(props.subjectHours).map(([subject, hours]) => (
              <div key={subject} className="mb-4 pb-3 border-b border-dashed border-gray-200 last:border-b-0 last:pb-0 last:mb-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-14 text-sm font-medium">{subject}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={hours ?? ''}
                    placeholder="미입력"
                    onChange={(e) => {
                      const value = e.target.value === '' ? null : Number(e.target.value);
                      props.onSubjectHoursChange({
                        ...props.subjectHours,
                        [subject as keyof SubjectHours]: value,
                      });
                    }}
                    className="flex-1 px-3 py-1.5 border border-[var(--paper-lines)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
                  />
                  <span className="w-12 text-right text-sm text-gray-500">시간</span>
                </div>
                {/* 요일 선택 버튼 */}
                <div className="flex items-center gap-1 ml-14">
                  <span className="text-xs text-gray-400 mr-1">요일:</span>
                  {DAY_LABELS.map((label, dayIndex) => {
                    const isSelected = props.subjectDays[subject as keyof SubjectDays].includes(dayIndex);
                    return (
                      <button
                        key={dayIndex}
                        type="button"
                        onClick={() => toggleDay(subject as keyof SubjectDays, dayIndex)}
                        className={`w-6 h-6 text-xs rounded-full transition-colors ${
                          isSelected
                            ? 'bg-[var(--ink-blue)] text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
              <span className="text-sm text-gray-600">합계</span>
              <span className="text-sm font-bold text-[var(--ink-blue)]">{totalHours}시간</span>
            </div>
            {!hasAtLeastOneSubject && (
              <p className="text-xs text-yellow-600 mt-2">⚠️ 최소 1개 과목의 학습 시간을 입력해주세요</p>
            )}
            {hasAtLeastOneSubject && (
              <p className="text-xs text-gray-500 mt-2">💡 비워둔 과목은 커리큘럼에 포함되지 않습니다. 요일 버튼으로 학습일을 조절하세요.</p>
            )}
          </>
        ) : (
          <>
            {Object.entries(props.subjectRatio).map(([subject, ratio]) => (
              <div key={subject} className="mb-4 pb-3 border-b border-dashed border-gray-200 last:border-b-0 last:pb-0 last:mb-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-14 text-sm font-medium">{subject}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={ratio}
                    onChange={(e) => props.onSubjectRatioChange({
                      ...props.subjectRatio,
                      [subject as keyof SubjectRatio]: Number(e.target.value)
                    })}
                    className="flex-1 accent-[var(--ink-blue)]"
                  />
                  <span className="w-12 text-right text-sm font-medium">{ratio}%</span>
                </div>
                {/* 요일 선택 버튼 */}
                <div className="flex items-center gap-1 ml-14">
                  <span className="text-xs text-gray-400 mr-1">요일:</span>
                  {DAY_LABELS.map((label, dayIndex) => {
                    const isSelected = props.subjectDays[subject as keyof SubjectDays].includes(dayIndex);
                    return (
                      <button
                        key={dayIndex}
                        type="button"
                        onClick={() => toggleDay(subject as keyof SubjectDays, dayIndex)}
                        className={`w-6 h-6 text-xs rounded-full transition-colors ${
                          isSelected
                            ? 'bg-[var(--ink-blue)] text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!isValidRatio && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ 과목별 비중의 합이 100%가 되어야 합니다 (현재: {totalRatio}%)
              </p>
            )}
          </>
        )}
      </div>

      {/* 남는 날 활용 옵션 (A2 시나리오) */}
      <div className="notebook-card p-4">
        <label className="block text-sm font-medium mb-3">📅 남는 날 활용 옵션</label>
        <p className="text-xs text-gray-500 mb-3">
          강의가 목표일보다 일찍 끝날 경우 남는 날을 어떻게 활용할지 설정하세요
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={props.curriculumOptions.extraDaysOption?.fillWithReview ?? true}
              onChange={(e) => {
                props.onCurriculumOptionsChange({
                  ...props.curriculumOptions,
                  extraDaysOption: {
                    ...props.curriculumOptions.extraDaysOption,
                    enabled: true,
                    fillWithReview: e.target.checked,
                    fillWithPractice: props.curriculumOptions.extraDaysOption?.fillWithPractice ?? true,
                  },
                });
              }}
              className="w-4 h-4 rounded border-gray-300 text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
            />
            <span className="text-sm">📖 복습 퀘스트로 채우기</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={props.curriculumOptions.extraDaysOption?.fillWithPractice ?? true}
              onChange={(e) => {
                props.onCurriculumOptionsChange({
                  ...props.curriculumOptions,
                  extraDaysOption: {
                    ...props.curriculumOptions.extraDaysOption,
                    enabled: true,
                    fillWithReview: props.curriculumOptions.extraDaysOption?.fillWithReview ?? true,
                    fillWithPractice: e.target.checked,
                  },
                });
              }}
              className="w-4 h-4 rounded border-gray-300 text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
            />
            <span className="text-sm">✏️ 문제풀이 퀘스트로 채우기</span>
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          💡 둘 다 체크하지 않으면 남는 날은 빈 날로 유지됩니다
        </p>
      </div>

      <button
        onClick={() => {
          if (!props.targetDate) {
            props.onTargetDateChange(defaultTargetDate());
          }
          props.onNext();
        }}
        disabled={!canProceed}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
      >
        {!canProceed ? '⚠️ 최소 1개 과목 시간을 입력해주세요' : '다음: 강좌 선택 →'}
      </button>
    </div>
  );
}

// 검증 실패 모달 컴포넌트
function ValidationErrorModal(props: {
  isOpen: boolean;
  onClose: () => void;
  validation: ValidationResult | null;
}) {
  if (!props.isOpen || !props.validation) return null;

  const { issues, suggestions } = props.validation;

  // 에러와 경고 분리
  const errors = issues.filter(i => i.severity === 'invalid');
  const warnings = issues.filter(i => i.severity === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={props.onClose}
      />

      {/* 모달 내용 */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-red-50 border-b border-red-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-800">커리큘럼 생성 불가</h2>
              <p className="text-sm text-red-600">일정을 조정해주세요</p>
            </div>
          </div>
        </div>

        {/* 문제점 목록 */}
        <div className="px-6 py-4 space-y-4">
          {/* 에러 (INVALID) */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-1">
                <span>🚫</span> 불가능한 일정 ({errors.length}개)
              </h3>
              <ul className="space-y-2">
                {errors.map((error, idx) => (
                  <li
                    key={idx}
                    className="bg-red-50 border border-red-200 rounded-lg p-3"
                  >
                    <p className="text-sm text-red-800">{error.message}</p>
                    {error.details && (
                      <div className="mt-1 text-xs text-red-600">
                        {error.details.date && <span>날짜: {error.details.date} | </span>}
                        {error.details.count !== undefined && <span>실제: {error.details.count} | </span>}
                        {error.details.expected !== undefined && <span>권장: {error.details.expected} 이하</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 경고 (WARNING) */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-1">
                <span>⚡</span> 주의사항 ({warnings.length}개)
              </h3>
              <ul className="space-y-2">
                {warnings.map((warning, idx) => (
                  <li
                    key={idx}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                  >
                    <p className="text-sm text-amber-800">{warning.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 제안사항 */}
          {suggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                <span>💡</span> 해결 방법
              </h3>
              <ul className="space-y-1">
                {suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 rounded-b-2xl">
          <button
            onClick={props.onClose}
            className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-[var(--ink-blue)]/90 transition-colors"
          >
            설정 다시 조정하기
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            목표일을 늘리거나 강좌 수를 줄여주세요
          </p>
        </div>
      </div>
    </div>
  );
}
