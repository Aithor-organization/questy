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

    // 인강은 일일 학습 시간의 60%까지만 사용 가능 (복습/문제풀이 시간 확보)
    const maxLectureMinutesPerDay = totalDailyMinutes * 0.6;
    // 평균 강의 시간: 30분
    const avgLectureMinutes = 30;
    const maxLecturesPerDay = Math.floor(maxLectureMinutesPerDay / avgLectureMinutes);

    // 필요한 일수 계산
    const requiredDays = Math.ceil(totalLectures / Math.max(maxLecturesPerDay, 1));
    const avgLecturesPerDay = totalLectures / totalDays;

    // 검증
    if (maxLecturesPerDay < 1) {
      return {
        feasible: false,
        error: `일일 학습 시간(${Math.round(totalDailyMinutes)}분)이 너무 짧습니다. 최소 1시간 이상 필요합니다.`,
      };
    }

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

function CourseSelectionStep(props: {
  searchResults: Course[];
  selectedCourses: SelectedCourse[];
  isSearching: boolean;
  feasibilityError: string | null;
  onSearch: (query: string, subject?: string) => void;
  onSearchBySubject: (subject: string, query?: string) => void;
  onSelect: (course: Course) => void;
  onDeselect: (courseId: string) => void;
  onUpdateStartChapter: (courseId: string, chapterIndex: number | undefined) => void;
  onBack: () => void;
  onNext: () => void;
  onClearError: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedTamgu, setExpandedTamgu] = useState<'과탐' | '사탐' | null>(null);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      props.onSearch(searchQuery, selectedSubject || undefined);
    }
  };

  const handleSubjectClick = (subject: string) => {
    if (selectedSubject === subject) {
      setSelectedSubject(null);
      props.onSearchBySubject(subject);
    } else {
      setSelectedSubject(subject);
      props.onSearchBySubject(subject, searchQuery.trim() || undefined);
    }
  };

  const handleTamguSubjectClick = (subject: string) => {
    setSelectedSubject(subject);
    props.onSearchBySubject(subject, searchQuery.trim() || undefined);
  };

  const handleTamguCategoryClick = (category: '과탐' | '사탐') => {
    setExpandedTamgu(expandedTamgu === category ? null : category);
  };

  // 탐구 과목인지 확인
  const isScienceSubject = (subject: string | null) => subject ? SCIENCE_SUBJECTS.includes(subject) : false;
  const isSocialSubject = (subject: string | null) => subject ? SOCIAL_SUBJECTS.includes(subject) : false;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="강좌명 또는 강사명 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 min-w-0 px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
        />
        <button
          onClick={handleSearch}
          disabled={props.isSearching}
          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 shrink-0"
        >
          {props.isSearching ? '🔄' : '🔍'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          {['수학', '영어', '국어', '한국사'].map((subject) => (
            <button
              key={subject}
              onClick={() => handleSubjectClick(subject)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedSubject === subject
                  ? 'bg-[var(--ink-blue)] text-white'
                  : 'bg-[var(--highlight-yellow)] hover:bg-yellow-200'
              }`}
            >
              {subject}
            </button>
          ))}

          {/* 과탐/사탐 카테고리 버튼 */}
          <button
            onClick={() => handleTamguCategoryClick('과탐')}
            className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${
              expandedTamgu === '과탐' || isScienceSubject(selectedSubject)
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-green-100 hover:bg-green-200 text-green-700'
            }`}
          >
            과탐
            <svg className={`w-3 h-3 transition-transform ${expandedTamgu === '과탐' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button
            onClick={() => handleTamguCategoryClick('사탐')}
            className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1 ${
              expandedTamgu === '사탐' || isSocialSubject(selectedSubject)
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
            }`}
          >
            사탐
            <svg className={`w-3 h-3 transition-transform ${expandedTamgu === '사탐' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 과탐 세부 과목 */}
        {expandedTamgu === '과탐' && (
          <div className="flex gap-1.5 flex-wrap pl-2 ">
            {SCIENCE_SUBJECTS.map((subject) => (
              <button
                key={subject}
                onClick={() => handleTamguSubjectClick(subject)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  selectedSubject === subject
                    ? 'bg-[var(--ink-blue)] text-white'
                    : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        )}

        {/* 사탐 세부 과목 */}
        {expandedTamgu === '사탐' && (
          <div className="flex gap-1.5 flex-wrap pl-2 ">
            {SOCIAL_SUBJECTS.map((subject) => (
              <button
                key={subject}
                onClick={() => handleTamguSubjectClick(subject)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  selectedSubject === subject
                    ? 'bg-[var(--ink-blue)] text-white'
                    : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">💡 과탐/사탐을 눌러 세부 과목을 선택하세요</p>

      <div className="notebook-card p-2 max-h-48 overflow-y-auto">
        {props.searchResults.length === 0 ? (
          <p className="text-center text-gray-400 py-4 text-sm">강좌를 검색해주세요</p>
        ) : (
          props.searchResults.map((course) => {
            const isSelected = props.selectedCourses.some(c => c.id === course.id);
            return (
              <div
                key={course.id}
                className={`p-3 rounded-lg mb-2 flex justify-between items-start transition-colors ${
                  isSelected ? 'bg-[var(--highlight-blue)]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="font-medium text-sm">{course.courseName}</div>
                  <div className="text-xs text-gray-500">
                    {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
                  </div>
                </div>
                <button
                  onClick={() => isSelected ? props.onDeselect(course.id) : props.onSelect(course)}
                  className={`px-3 py-1 text-sm rounded transition-colors flex-shrink-0 self-center ${
                    isSelected
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-[var(--ink-blue)] text-white hover:bg-[var(--ink-blue)]/90'
                  }`}
                >
                  {isSelected ? '제거' : '추가'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {props.selectedCourses.length > 0 && (
        <div className="notebook-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-[var(--ink-blue)] text-white rounded-full flex items-center justify-center text-xs">
              {props.selectedCourses.length}
            </span>
            선택한 강좌
          </h3>
          <div className="space-y-3">
            {props.selectedCourses.map((course) => (
              <div
                key={course.id}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm"
              >
                {/* 강좌 헤더 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[var(--ink-black)] text-sm leading-tight">
                      {course.courseName}
                    </h4>
                    <p className="text-xs text-[var(--pencil-gray)] mt-1">
                      {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
                    </p>
                  </div>
                  <button
                    onClick={() => props.onDeselect(course.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* 이어듣기 선택 */}
                {course.chapters && course.chapters.length > 0 && (
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                    <label className="text-xs text-[var(--pencil-gray)] mb-1.5 block">
                      이어듣기 시작점
                    </label>
                    <select
                      value={course.startFromChapter ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        props.onUpdateStartChapter(course.id, value === '' ? undefined : parseInt(value, 10));
                      }}
                      className="w-full text-sm px-3 py-2 border border-[var(--paper-lines)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent"
                    >
                      {course.chapters.map((chapter, idx) => (
                        <option key={idx} value={idx === 0 ? '' : idx}>
                          {idx + 1}강. {chapter.title.slice(0, 30)}{chapter.title.length > 30 ? '...' : ''}{idx > 0 ? ' 부터' : ' (처음부터)'}
                        </option>
                      ))}
                    </select>
                    {course.startFromChapter && course.startFromChapter > 0 && (
                      <p className="text-xs text-[var(--ink-blue)] mt-2 flex items-center gap-1">
                        <span>→</span>
                        {course.startFromChapter}강 건너뛰고 {course.startFromChapter + 1}강부터 시작
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실행 가능성 오류 표시 */}
      {props.feasibilityError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="font-medium text-red-700">일정 생성이 불가능합니다</p>
                <p className="text-sm text-red-600 mt-1 whitespace-pre-line">{props.feasibilityError}</p>
              </div>
            </div>
            <button
              onClick={props.onClearError}
              className="text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={props.onBack}
          className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          ← 이전
        </button>
        <button
          onClick={props.onNext}
          disabled={props.selectedCourses.length === 0 || !!props.feasibilityError}
          className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
        >
          퀘스트 생성 ✨
        </button>
      </div>
    </div>
  );
}

function PreviewStep(props: {
  quests: Array<{
    id: string;
    title: string;
    description: string;
    questType: string;
    subject: string;
    scheduledDate: string;
    estimatedMinutes: number;
    editable?: boolean;
    practiceNote?: string;
    relatedLectures?: string[];
  }>;
  summary: {
    totalQuests: number;
    totalDays: number;
    averageMinutesPerDay: number;
    subjectDistribution: Record<string, number>;
    timeByType?: {
      lectureMinutes: number;
      reviewMinutes: number;
      practiceMinutes: number;
      totalMinutes: number;
    };
    skippedSubjects?: Array<{
      subject: string;
      hours: number;
      reason: string;
    }> | null;
  } | null;
  review?: CurriculumReviewResult | null;
  isLoading: boolean;
  error?: Error | null;
  onBack: () => void;
  onConfirm: () => void;
  onUpdatePracticeNote?: (questId: string, note: string) => void;
  dailyStudyHours: number;
  showTimeExceededWarning: boolean;
  requiredHoursPerDay: number;
  onAdjustHours: (hours: number) => void;
  onDismissWarning: () => void;
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [showDetailedView, setShowDetailedView] = useState(false);

  const startEditingNote = (questId: string, currentNote: string) => {
    setEditingNoteId(questId);
    setEditingNoteValue(currentNote || '');
  };

  const saveNote = (questId: string) => {
    if (props.onUpdatePracticeNote) {
      props.onUpdatePracticeNote(questId, editingNoteValue);
    }
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  if (props.isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4 animate-bounce">✨</div>
        <p className="text-lg font-medium">퀘스트 생성 중...</p>
        <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
      </div>
    );
  }

  if (props.quests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-lg font-medium">퀘스트 생성에 실패했습니다</p>
        {props.error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-left max-w-md mx-auto">
            <p className="text-sm text-red-600 font-medium mb-1">오류 상세:</p>
            <p className="text-xs text-red-500 break-all">{props.error.message || String(props.error)}</p>
          </div>
        )}
        <button onClick={props.onBack} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          다시 시도
        </button>
      </div>
    );
  }

  const questsByDate = props.quests.reduce((acc, quest) => {
    const date = quest.scheduledDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(quest);
    return acc;
  }, {} as Record<string, typeof props.quests>);

  return (
    <div className="space-y-4">
      {/* AI 에이전트 리뷰 결과 (최상단) */}
      {props.review && (
        <AIReviewCard review={props.review} />
      )}

      {props.summary && (
        <div className="notebook-card p-4 bg-[var(--highlight-blue)]">
          <h3 className="font-medium mb-2">📊 생성 결과 요약</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>총 퀘스트: <strong>{props.summary.totalQuests}개</strong></div>
            <div>학습 기간: <strong>{props.summary.totalDays}일</strong></div>
            <div>일평균: <strong>{props.summary.averageMinutesPerDay}분</strong></div>
            <div>총 시간: <strong>{props.summary.timeByType ? Math.round(props.summary.timeByType.totalMinutes / 60) : Math.round(props.summary.totalQuests * 45 / 60)}시간</strong></div>
          </div>
          {props.summary.timeByType && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="text-xs text-gray-600 mb-2">⏱️ 시간 분배</div>
              <div className="flex gap-1.5 text-xs flex-wrap">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded whitespace-nowrap">📺 {Math.round(props.summary.timeByType.lectureMinutes / 60)}h</span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">📝 {Math.round(props.summary.timeByType.reviewMinutes / 60)}h</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded whitespace-nowrap">✏️ {Math.round(props.summary.timeByType.practiceMinutes / 60)}h</span>
              </div>
            </div>
          )}
        </div>
      )}

      {props.summary?.skippedSubjects && props.summary.skippedSubjects.length > 0 && (
        <div className="notebook-card p-4 bg-amber-50 border-amber-200">
          <h4 className="font-medium text-amber-800 mb-2">⚠️ 일부 과목이 커리큘럼에서 제외되었습니다</h4>
          <p className="text-sm text-amber-700 mb-2">선택된 강좌가 없는 과목의 학습 시간은 자동으로 제외되었습니다.</p>
          <ul className="text-sm text-amber-600 space-y-1">
            {props.summary.skippedSubjects.map((skipped, idx) => (
              <li key={idx}>• <strong>{skipped.subject}</strong>: {skipped.hours}시간 (제외됨 - {skipped.reason})</li>
            ))}
          </ul>
          <p className="text-xs text-amber-600 mt-2">💡 해당 과목의 강좌를 추가하면 학습 시간이 반영됩니다.</p>
        </div>
      )}

      {props.showTimeExceededWarning && (
        <div className="notebook-card p-4 bg-red-50 border-red-200">
          <h4 className="font-medium text-red-800 mb-2">⏰ 일일 학습 시간 초과</h4>
          <p className="text-sm text-red-700 mb-3">
            현재 설정된 일일 학습 시간(<strong>{props.dailyStudyHours}시간</strong>)으로는 목표일까지 커리큘럼을 완료하기 어렵습니다.
          </p>
          <p className="text-sm text-red-700 mb-3">
            일평균 <strong>{props.summary?.averageMinutesPerDay || 0}분</strong>이 필요하며, 최소 <strong>{props.requiredHoursPerDay}시간</strong>으로 조정하는 것을 권장합니다.
          </p>
          <div className="bg-white rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">일일 학습 시간 조정</span>
              <span className="text-lg font-bold text-red-600">{props.dailyStudyHours}시간</span>
            </div>
            <input
              type="range"
              min="10"
              max="14"
              value={props.dailyStudyHours}
              onChange={(e) => props.onAdjustHours(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10시간</span>
              <span>12시간</span>
              <span>14시간 (최대)</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => props.onAdjustHours(props.requiredHoursPerDay)}
              className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
            >
              {props.requiredHoursPerDay}시간으로 조정
            </button>
            <button
              onClick={props.onDismissWarning}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
            >
              현재 설정 유지
            </button>
          </div>
          <p className="text-xs text-red-500 mt-2">💡 시간을 늘리면 더 많은 학습량을 하루에 소화해야 합니다.</p>
        </div>
      )}

      {!props.showTimeExceededWarning && (
        <div className="notebook-card p-3 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">✅ 일일 학습 시간: <strong>{props.dailyStudyHours}시간</strong></span>
            <span className="text-xs text-green-600">여유롭게 학습 가능합니다</span>
          </div>
        </div>
      )}

      {/* 상세 보기 토글 */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">📅 일별 커리큘럼</h3>
        <button
          onClick={() => setShowDetailedView(!showDetailedView)}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
        >
          {showDetailedView ? '간략히 보기 ▲' : `전체 보기 (${Object.keys(questsByDate).length}일) ▼`}
        </button>
      </div>

      <div className={`space-y-3 overflow-y-auto ${showDetailedView ? 'max-h-[500px]' : 'max-h-80'}`}>
        {Object.entries(questsByDate).slice(0, showDetailedView ? undefined : 5).map(([date, quests]) => (
          <div key={date} className="notebook-card p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-gray-500">{date}</div>
              <div className="text-xs text-gray-400">
                {quests.length}개 · {quests.reduce((sum, q) => sum + q.estimatedMinutes, 0)}분
              </div>
            </div>
            {quests.map((quest) => (
              <div key={quest.id} className="mb-2 last:mb-0">
                {quest.questType === 'practice' ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">✏️ {quest.subject}</span>
                        <span className="text-sm font-medium">{quest.title}</span>
                      </div>
                      <span className="text-xs text-gray-500">{quest.estimatedMinutes}분</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{quest.description}</div>
                    {quest.relatedLectures && quest.relatedLectures.length > 0 && (
                      <div className="text-xs text-orange-600 mt-1">📚 관련: {quest.relatedLectures.join(', ')}</div>
                    )}
                    {quest.editable && (
                      <div className="mt-2">
                        {editingNoteId === quest.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingNoteValue}
                              onChange={(e) => setEditingNoteValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveNote(quest.id);
                                if (e.key === 'Escape') cancelEditingNote();
                              }}
                              placeholder="예: 수특 독서 1강 문제 풀기"
                              className="flex-1 text-xs px-2 py-1 border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-400"
                              autoFocus
                            />
                            <button onClick={() => saveNote(quest.id)} className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600">저장</button>
                            <button onClick={cancelEditingNote} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">취소</button>
                          </div>
                        ) : (
                          <div onClick={() => startEditingNote(quest.id, quest.practiceNote || '')} className="flex items-center gap-1 cursor-pointer hover:bg-orange-100 rounded px-1 py-0.5 transition-colors">
                            <span className="text-xs text-gray-400">메모:</span>
                            <span className={`text-xs flex-1 ${quest.practiceNote ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                              {quest.practiceNote || '클릭하여 메모 추가'}
                            </span>
                            <span className="text-xs text-orange-400">✏️</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      quest.questType === 'lecture' ? 'bg-blue-100 text-blue-700' :
                      quest.questType === 'review' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {quest.questType === 'lecture' ? '📺' : quest.questType === 'review' ? '📝' : '📋'} {quest.subject}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{quest.title}</div>
                      <div className="text-xs text-gray-500">{quest.estimatedMinutes}분</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {!showDetailedView && Object.keys(questsByDate).length > 5 && (
          <button
            onClick={() => setShowDetailedView(true)}
            className="w-full py-2 text-center text-sm text-[var(--ink-blue)] hover:bg-blue-50 rounded-lg transition-colors"
          >
            + {Object.keys(questsByDate).length - 5}일 더 보기
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={props.onBack} className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors">
          ← 이전
        </button>
        <button onClick={props.onConfirm} className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-[var(--ink-blue)]/90 transition-colors">
          플래너에 추가 📋
        </button>
      </div>
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

// AI 에이전트 리뷰 카드 컴포넌트
function AIReviewCard({ review }: { review: CurriculumReviewResult }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return '✅';
      case 'good': return '👍';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`notebook-card border ${getScoreBg(review.overallScore)} transition-all`}>
      {/* 헤더 (항상 표시) */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getScoreColor(review.overallScore)} bg-white border-2`}>
              {review.overallScore}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                🤖 AI 커리큘럼 검증
                {review.isApproved ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">승인</span>
                ) : (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">조정 권장</span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">{review.summary}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>

        {/* 카테고리 점수 바 (간략 표시) */}
        {!isExpanded && (
          <div className="flex gap-2 mt-3">
            {Object.entries(review.categories).map(([key, cat]) => (
              <div
                key={key}
                className={`flex-1 text-center py-1 px-2 rounded text-xs ${getStatusColor(cat.status)}`}
              >
                {getStatusIcon(cat.status)} {key === 'feasibility' ? '실현성' : key === 'balance' ? '균형' : key === 'distribution' ? '분배' : '완성도'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 내용 (펼쳤을 때만 표시) */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
          {/* 카테고리별 상세 점수 */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(review.categories).map(([key, cat]) => (
              <div key={key} className={`p-3 rounded-lg ${getStatusColor(cat.status)}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">
                    {key === 'feasibility' ? '📊 실현 가능성' :
                     key === 'balance' ? '⚖️ 균형' :
                     key === 'distribution' ? '📚 과목 분배' : '✅ 완성도'}
                  </span>
                  <span className="font-bold">{cat.score}</span>
                </div>
                <p className="text-xs opacity-80">{cat.message}</p>
              </div>
            ))}
          </div>

          {/* 좋은 점 */}
          {review.highlights.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-800 mb-2">✨ 좋은 점</h4>
              <ul className="space-y-1">
                {review.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-green-700 flex items-start gap-2">
                    <span>•</span><span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 우려 사항 */}
          {review.concerns.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-amber-800 mb-2">⚠️ 주의 사항</h4>
              <ul className="space-y-1">
                {review.concerns.map((c, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                    <span>•</span><span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선 제안 */}
          {review.suggestions.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-800 mb-2">💡 개선 제안</h4>
              <ul className="space-y-1">
                {review.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-blue-700 flex items-start gap-2">
                    <span>•</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
