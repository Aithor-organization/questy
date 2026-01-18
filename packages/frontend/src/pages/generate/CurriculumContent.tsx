/**
 * CurriculumContent
 * 인강 커리큘럼 기반 퀘스트 생성 콘텐츠
 * GeneratePageV2의 탭 콘텐츠로 사용됨
 */

import { useState } from 'react';
import { NotebookPage } from '../../components/notebook/NotebookPage';
import { useCurriculumGeneration } from '../../hooks/useCurriculumGeneration';
import type { Course, SelectedCourse, SubjectRatio, SubjectHours } from '../../types/curriculum';

type Step = 'settings' | 'courses' | 'preview';

export function CurriculumContent() {
  const [step, setStep] = useState<Step>('settings');
  const {
    searchResults,
    selectedCourses,
    subjectRatio,
    subjectHours,
    targetDate,
    dailyStudyHours,
    generatedQuests,
    questSummary,
    showTimeExceededWarning,
    requiredHoursPerDay,
    setSubjectRatio,
    setSubjectHours,
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
    isSearching,
    isGenerating,
  } = useCurriculumGeneration();

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
            onTargetDateChange={setTargetDate}
            onSubjectRatioChange={setSubjectRatio}
            onSubjectHoursChange={setSubjectHours}
            onNext={() => setStep('courses')}
          />
        )}

        {/* Step 2: 강좌 선택 */}
        {step === 'courses' && (
          <CourseSelectionStep
            searchResults={searchResults}
            selectedCourses={selectedCourses}
            isSearching={isSearching}
            onSearch={(query, subject) => searchCourses({ query, subject })}
            onSearchBySubject={(subject, query) => searchCourses({ subject, query })}
            onSelect={selectCourse}
            onDeselect={deselectCourse}
            onUpdateStartChapter={updateCourseStartChapter}
            onBack={() => setStep('settings')}
            onNext={() => {
              generateQuests();
              setStep('preview');
            }}
          />
        )}

        {/* Step 3: 프리뷰 & 확인 */}
        {step === 'preview' && (
          <PreviewStep
            quests={generatedQuests}
            summary={questSummary}
            isLoading={isGenerating}
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

function SettingsStep(props: {
  targetDate: string;
  subjectRatio: SubjectRatio;
  subjectHours: SubjectHours;
  onTargetDateChange: (date: string) => void;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  onSubjectHoursChange: (hours: SubjectHours) => void;
  onNext: () => void;
}) {
  const [inputMode, setInputMode] = useState<'hours' | 'ratio'>('hours');

  const totalHours = Object.values(props.subjectHours).reduce((sum, h) => sum + (h || 0), 0);
  const hasAtLeastOneSubject = Object.values(props.subjectHours).some(h => h !== null && h > 0);
  const totalRatio = Object.values(props.subjectRatio).reduce((a, b) => a + b, 0);
  const isValidRatio = totalRatio === 100;
  const canProceed = inputMode === 'hours' ? hasAtLeastOneSubject : isValidRatio;

  const defaultTargetDate = () => new Date().toISOString().split('T')[0];

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
              <div key={subject} className="flex items-center gap-3 mb-3">
                <span className="w-14 text-sm">{subject}</span>
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
            ))}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
              <span className="text-sm text-gray-600">합계</span>
              <span className="text-sm font-bold text-[var(--ink-blue)]">{totalHours}시간</span>
            </div>
            {!hasAtLeastOneSubject && (
              <p className="text-xs text-yellow-600 mt-2">⚠️ 최소 1개 과목의 학습 시간을 입력해주세요</p>
            )}
            {hasAtLeastOneSubject && (
              <p className="text-xs text-gray-500 mt-2">💡 비워둔 과목은 커리큘럼에 포함되지 않습니다</p>
            )}
          </>
        ) : (
          <>
            {Object.entries(props.subjectRatio).map(([subject, ratio]) => (
              <div key={subject} className="flex items-center gap-3 mb-3">
                <span className="w-14 text-sm">{subject}</span>
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
            ))}
            {!isValidRatio && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ 과목별 비중의 합이 100%가 되어야 합니다 (현재: {totalRatio}%)
              </p>
            )}
          </>
        )}
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
  onSearch: (query: string, subject?: string) => void;
  onSearchBySubject: (subject: string, query?: string) => void;
  onSelect: (course: Course) => void;
  onDeselect: (courseId: string) => void;
  onUpdateStartChapter: (courseId: string, chapterIndex: number | undefined) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="강좌명 또는 강사명 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
        />
        <button
          onClick={handleSearch}
          disabled={props.isSearching}
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {props.isSearching ? '🔄' : '🔍'} 검색
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['수학', '영어', '국어', '한국사', '탐구'].map((subject) => (
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
      </div>

      <div className="notebook-card p-2 max-h-48 overflow-y-auto">
        {props.searchResults.length === 0 ? (
          <p className="text-center text-gray-400 py-4 text-sm">강좌를 검색해주세요</p>
        ) : (
          props.searchResults.map((course) => {
            const isSelected = props.selectedCourses.some(c => c.id === course.id);
            return (
              <div
                key={course.id}
                className={`p-3 rounded-lg mb-2 flex justify-between items-center transition-colors ${
                  isSelected ? 'bg-[var(--highlight-blue)]' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{course.courseName}</div>
                  <div className="text-xs text-gray-500">
                    {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
                  </div>
                </div>
                <button
                  onClick={() => isSelected ? props.onDeselect(course.id) : props.onSelect(course)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
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
        <div className="notebook-card p-3">
          <h3 className="text-sm font-medium mb-2">✅ 선택한 강좌 ({props.selectedCourses.length}개)</h3>
          <div className="space-y-2">
            {props.selectedCourses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-[var(--highlight-blue)] rounded"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[var(--ink-blue)] text-sm font-medium">{course.courseName}</span>
                  <button
                    onClick={() => props.onDeselect(course.id)}
                    className="text-[var(--ink-blue)] hover:text-red-500 text-sm"
                  >
                    ×
                  </button>
                </div>
                {course.chapters && course.chapters.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--pencil-gray)]">이어듣기:</span>
                    <select
                      value={course.startFromChapter ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        props.onUpdateStartChapter(course.id, value === '' ? undefined : parseInt(value, 10));
                      }}
                      className="text-xs px-2 py-1 border border-[var(--paper-lines)] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ink-blue)]"
                    >
                      {course.chapters.map((chapter, idx) => (
                        <option key={idx} value={idx === 0 ? '' : idx}>
                          {chapter.title.slice(0, 25)}{chapter.title.length > 25 ? '...' : ''}{idx > 0 ? ' 부터' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
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
          disabled={props.selectedCourses.length === 0}
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
  isLoading: boolean;
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
              <div className="flex gap-2 text-xs">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">📺 강의 {Math.round(props.summary.timeByType.lectureMinutes / 60)}시간</span>
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">📝 복습 {Math.round(props.summary.timeByType.reviewMinutes / 60)}시간</span>
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">✏️ 문제풀이 {Math.round(props.summary.timeByType.practiceMinutes / 60)}시간</span>
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

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {Object.entries(questsByDate).slice(0, 5).map(([date, quests]) => (
          <div key={date} className="notebook-card p-3">
            <div className="text-xs text-gray-500 mb-2">{date}</div>
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
        {Object.keys(questsByDate).length > 5 && (
          <p className="text-center text-sm text-gray-400">... 외 {Object.keys(questsByDate).length - 5}일</p>
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
