/**
 * CurriculumContentBeta
 * 새로운 커리큘럼 생성 UI (베타 버전)
 * - Step 1: 내 현황 + 기존 플랜 + 목표 날짜
 * - Step 2: 목표 일수 + 학습 요일 + 과목별 시간 범위
 * - Step 3: 강좌 선택
 * - Step 4: AI 조정 미리보기
 *
 * ⚠️ 관리자 전용 기능 (테스트 중)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookPage } from '../../components/notebook/NotebookPage';
import { ALL_DAYS, DAY_LABELS } from '@questybook/shared';
import { useCurriculumBeta } from '../../hooks/useCurriculumBeta';
import { useAuthStore } from '../../stores/authStore';

// 과목 레이블 매핑
const SUBJECT_LABELS: Record<string, string> = {
  math: '수학',
  korean: '국어',
  english: '영어',
  science1: '탐구1',
  science2: '탐구2',
  history: '한국사',
};

// 과목 옵션
const SUBJECT_OPTIONS = ['math', 'korean', 'english', 'science1', 'science2', 'history'];

export function CurriculumContentBeta() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin ?? false;

  const {
    // Step 관리
    step,
    setStep,

    // Step 1
    startDate,
    setStartDate,
    targetDate,
    setTargetDate,
    dailyStudyHours,
    existingPlans,
    existingHoursByDay,

    // Step 2 (자동 계산됨)
    totalDays,
    selectedDays,
    subjectHoursRange,
    updateHoursRange,
    subjectDays,
    toggleSubjectDay,
    addSubject,
    removeSubject,
    conflictAnalysis,

    // Step 3
    searchResults,
    selectedCourses,
    searchCourses,
    selectCourse,
    deselectCourse,
    updateStartFromChapter,
    isSearching,
    searchError,

    // Step 4
    generatedQuests,
    questSummary,
    validationResult,

    // 액션
    generateQuests,
    addToPlannerAndNavigate,

    // 로딩 상태
    isGenerating,
    generateError,
    isHydrated,
  } = useCurriculumBeta();

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubject, setSearchSubject] = useState<string>('');

  // 관리자가 아니면 모달 표시
  if (!isAdmin) {
    return (
      <NotebookPage title="🧪 Beta: 스마트 커리큘럼" decoration="holes">
        {/* 테스트 중 모달 */}
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-xl">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-[var(--ink-black)] mb-2">
              베타 기능
            </h2>
            <p className="text-[var(--pencil-gray)] mb-6">
              현재 테스트 중입니다.<br />
              정식 오픈 시 이용 가능합니다.
            </p>
            <button
              onClick={() => navigate('/generate')}
              className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              돌아가기
            </button>
          </div>
        </div>
      </NotebookPage>
    );
  }

  // 생성 중 경과 시간 표시
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 생성 중일 때 타이머 시작/종료
  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGenerating]);

  // Step 2에서 선택한 과목 키 → 검색용 과목명 매핑
  const subjectKeyToSearchName: Record<string, string> = {
    math: '수학',
    korean: '국어',
    english: '영어',
    science1: '과학',
    science2: '과학',
    history: '사회',
  };

  // Step 2에서 선택된 과목들 (중복 제거)
  const selectedSubjectKeys = Object.keys(subjectHoursRange);
  const availableSubjects = [...new Set(
    selectedSubjectKeys.map(key => subjectKeyToSearchName[key]).filter(Boolean)
  )];

  // 검색 실행 (Step 2 선택 과목 내에서만)
  const handleSearch = () => {
    // 선택된 과목이 있으면 해당 과목으로 필터링
    const subjectFilter = searchSubject || (availableSubjects.length === 1 ? availableSubjects[0] : undefined);
    searchCourses({ query: searchQuery || undefined, subject: subjectFilter });
  };

  // Step 3 진입 시 자동 검색 (선택된 과목 기준)
  useEffect(() => {
    if (step === 'courses' && searchResults.length === 0 && !isSearching && availableSubjects.length > 0) {
      // 선택 과목이 1개면 해당 과목만, 여러 개면 첫 번째 과목으로 검색
      const firstSubject = availableSubjects[0];
      setSearchSubject(firstSubject);
      searchCourses({ subject: firstSubject });
    }
  }, [step, searchResults.length, isSearching, searchCourses, availableSubjects.length]);

  return (
    <>
      {/* Step 1: 내 현황 */}
      {step === 'status' && (
        <NotebookPage title="🧪 Beta: 스마트 커리큘럼" decoration="holes">
          {/* 내 학습 현황 */}
          <div className="mb-6 p-4 bg-[var(--highlight-blue)] rounded-xl">
            <h3 className="font-semibold text-[var(--ink-black)] mb-3">👤 내 학습 현황</h3>
            {!isHydrated ? (
              // 로딩 스켈레톤
              <div className="grid grid-cols-3 gap-3 animate-pulse">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-20 mx-auto" />
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-20 mx-auto" />
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-20 mx-auto" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-[var(--ink-blue)]">
                    {dailyStudyHours}시간
                  </div>
                  <div className="text-xs text-[var(--pencil-gray)]">하루 순공시간</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-[var(--sticker-mint)]">
                    {(() => {
                      const activeDays = Object.values(existingHoursByDay).filter(h => h > 0).length || 1;
                      const total = Object.values(existingHoursByDay).reduce((a, b) => a + b, 0);
                      return (total / activeDays).toFixed(1);
                    })()}시간
                  </div>
                  <div className="text-xs text-[var(--pencil-gray)]">평균 하루 사용</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-[var(--sticker-coral)]">
                    {existingPlans.length}개
                  </div>
                  <div className="text-xs text-[var(--pencil-gray)]">진행 중 플랜</div>
                </div>
              </div>
            )}
          </div>

          {/* 기존 플랜 목록 */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--ink-black)] mb-3">📋 진행 중인 플랜</h3>
            {!isHydrated ? (
              // 로딩 스켈레톤
              <div className="space-y-2 animate-pulse">
                <div className="p-3 bg-white border border-[var(--paper-lines)] rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full" />
                </div>
                <div className="p-3 bg-white border border-[var(--paper-lines)] rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-4 bg-gray-200 rounded w-28" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full" />
                </div>
              </div>
            ) : existingPlans.length > 0 ? (
              <div className="space-y-2">
                {existingPlans.slice(0, 3).map(plan => {
                  const completed = plan.dailyQuests.filter(q => q.completed).length;
                  const total = plan.dailyQuests.length;

                  // 요일 계산
                  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
                  const scheduledDays = new Set<number>();
                  let totalMinutes = 0;
                  plan.dailyQuests.forEach(quest => {
                    if (!quest.completed) {
                      const date = new Date(quest.date);
                      scheduledDays.add(date.getDay());
                      totalMinutes += quest.estimatedMinutes || 0;
                    }
                  });
                  const daysArray = Array.from(scheduledDays).sort();
                  const avgHoursPerDay = scheduledDays.size > 0
                    ? (totalMinutes / 60 / scheduledDays.size).toFixed(1)
                    : '0';

                  return (
                    <div key={plan.id} className="p-3 bg-white border border-[var(--paper-lines)] rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{plan.materialName}</span>
                        <span className="text-xs text-[var(--pencil-gray)]">
                          {completed}/{total} 완료
                        </span>
                      </div>
                      {/* 요일 + 평균 시간 */}
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--pencil-gray)]">
                        <span className="flex gap-0.5">
                          {daysArray.map(d => (
                            <span key={d} className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">
                              {dayLabels[d]}
                            </span>
                          ))}
                        </span>
                        <span>·</span>
                        <span>하루 평균 {avgHoursPerDay}h</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--sticker-mint)] rounded-full"
                          style={{ width: `${(completed / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {existingPlans.length > 3 && (
                  <p className="text-xs text-[var(--pencil-gray)] text-center">
                    외 {existingPlans.length - 3}개 플랜
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-[var(--pencil-gray)]">
                아직 진행 중인 플랜이 없습니다.
                <br />새 커리큘럼을 만들어보세요! ✨
              </div>
            )}
          </div>

          {/* 학습 기간 설정 */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--ink-black)] mb-3">🎯 학습 기간</h3>

            {/* 빠른 선택 버튼 */}
            {(() => {
              // 각 버튼의 예상 날짜 계산
              const suneungDate = '2026-11-19';
              const oneMonthLater = (() => {
                const d = new Date(); d.setMonth(d.getMonth() + 1);
                return d.toISOString().split('T')[0];
              })();
              const threeMonthsLater = (() => {
                const d = new Date(); d.setMonth(d.getMonth() + 3);
                return d.toISOString().split('T')[0];
              })();

              return (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setTargetDate(suneungDate)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      targetDate === suneungDate
                        ? 'bg-[var(--ink-blue)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    수능 D-day
                  </button>
                  <button
                    onClick={() => setTargetDate(oneMonthLater)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      targetDate === oneMonthLater
                        ? 'bg-[var(--ink-blue)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    1개월 후
                  </button>
                  <button
                    onClick={() => setTargetDate(threeMonthsLater)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      targetDate === threeMonthsLater
                        ? 'bg-[var(--ink-blue)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    3개월 후
                  </button>
                </div>
              );
            })()}

            {/* 시작일 / 목표일 입력 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-[var(--pencil-gray)] mb-1">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--paper-lines)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--pencil-gray)] mb-1">목표일</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--paper-lines)] rounded-lg text-sm"
                />
              </div>
            </div>

            {/* 기간 요약 표시 */}
            {startDate && targetDate && (
              <div className="p-3 bg-[var(--highlight-green)] rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--pencil-gray)]">📅 학습 기간</span>
                  <span className="font-medium text-[var(--ink-black)]">
                    {startDate} ~ {targetDate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[var(--pencil-gray)]">📆 총 일수</span>
                  <span className="font-medium text-[var(--ink-blue)]">
                    {(() => {
                      const start = new Date(startDate);
                      const end = new Date(targetDate);
                      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      return diff > 0 ? `${diff}일` : '-';
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('schedule')}
            disabled={!targetDate}
            className="w-full py-4 bg-[var(--ink-blue)] text-white rounded-xl font-medium disabled:opacity-50"
          >
            다음 단계 →
          </button>
        </NotebookPage>
      )}

      {/* Step 2: 과목별 설정 */}
      {step === 'schedule' && (
        <NotebookPage title="📚 과목별 설정" decoration="holes">
          {/* 자동 계산된 일정 요약 */}
          <div className="mb-6 p-4 bg-[var(--highlight-blue)] rounded-xl">
            <h3 className="font-semibold text-[var(--ink-black)] mb-3">📊 자동 계산된 일정</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg text-center">
                <div className="text-2xl font-bold text-[var(--ink-blue)]">{totalDays}일</div>
                <div className="text-xs text-[var(--pencil-gray)]">총 학습 일수</div>
              </div>
              <div className="p-3 bg-white rounded-lg text-center">
                <div className="text-2xl font-bold text-[var(--sticker-mint)]">
                  {selectedDays.map(d => DAY_LABELS[d][0]).join('')}
                </div>
                <div className="text-xs text-[var(--pencil-gray)]">학습 요일 (주 {selectedDays.length}일)</div>
              </div>
            </div>
            {totalDays === 0 && (
              <p className="mt-3 text-sm text-amber-600">
                ⚠️ 과목별 요일을 설정하면 학습 일수가 자동 계산됩니다.
              </p>
            )}
          </div>

          {/* 사용 가이드 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="font-medium text-[var(--ink-black)] mb-2 text-sm">💡 설정 가이드</h4>
            <ul className="text-xs text-[var(--pencil-gray)] space-y-1.5">
              <li>• <b>시간 범위</b>: 하루에 해당 과목을 공부할 최소~최대 시간</li>
              <li>• <b>요일 버튼</b>: 해당 과목을 공부할 요일 선택 (예: 수학은 매일, 국어는 월수금)</li>
              <li>• AI가 선택한 강좌와 시간 범위를 고려해 최적의 일정을 생성합니다</li>
            </ul>
          </div>

          {/* 충돌 경고 */}
          {conflictAnalysis.some(c => c.conflictLevel !== 'none') && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h4 className="font-semibold text-amber-800 mb-2">⚠️ 시간 충돌 안내</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {conflictAnalysis
                  .filter(c => c.conflictLevel !== 'none')
                  .map(c => (
                    <li key={c.day}>
                      • {DAY_LABELS[c.day]}: 기존 {c.existingHours.toFixed(1)}h + 새 플랜 → {c.suggestion}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600">
                💡 AI가 자동으로 시간을 조율합니다.
              </p>
            </div>
          )}

          {/* 과목별 시간 범위 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-[var(--ink-black)]">⏰ 과목별 학습 시간 (하루)</h3>
              <select
                onChange={(e) => {
                  if (e.target.value && !subjectHoursRange[e.target.value]) {
                    addSubject(e.target.value);
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1 text-sm border border-[var(--paper-lines)] rounded-lg"
              >
                <option value="">+ 과목 추가</option>
                {SUBJECT_OPTIONS.filter(s => !subjectHoursRange[s]).map(subject => (
                  <option key={subject} value={subject}>{SUBJECT_LABELS[subject]}</option>
                ))}
              </select>
            </div>
            {Object.entries(subjectHoursRange).map(([subject, range]) => (
              <div key={subject} className="mb-4 p-4 bg-white border border-[var(--paper-lines)] rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{SUBJECT_LABELS[subject] || subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--pencil-gray)]">
                      {range.min}h ~ {range.max}h
                    </span>
                    <button
                      onClick={() => removeSubject(subject)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="5"
                    value={range.min || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const numVal = val === '' ? 0 : parseFloat(val);
                      if (!isNaN(numVal) && numVal >= 0 && numVal <= 5) {
                        updateHoursRange(subject, 'min', numVal);
                        // max가 min보다 작으면 max도 같이 증가
                        if (numVal > range.max) {
                          updateHoursRange(subject, 'max', numVal);
                        }
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value === '') {
                        updateHoursRange(subject, 'min', 0);
                      }
                    }}
                    className="w-20 px-3 py-2 border rounded-lg text-center"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="5"
                    value={range.max || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const numVal = val === '' ? 0 : parseFloat(val);
                      if (!isNaN(numVal) && numVal >= 0 && numVal <= 5) {
                        // max는 min보다 작을 수 없음
                        const finalVal = Math.max(numVal, range.min);
                        updateHoursRange(subject, 'max', finalVal);
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value === '' || parseFloat(e.target.value) < range.min) {
                        updateHoursRange(subject, 'max', range.min);
                      }
                    }}
                    className="w-20 px-3 py-2 border rounded-lg text-center"
                  />
                  <span className="text-sm text-[var(--pencil-gray)]">시간</span>
                </div>
                {/* 과목별 요일 선택 */}
                <div className="mt-3 flex gap-1">
                  {ALL_DAYS.map(day => {
                    const isSelected = subjectDays[subject]?.includes(day);
                    const isWeekend = day === 'sat' || day === 'sun';
                    return (
                      <button
                        key={day}
                        onClick={() => toggleSubjectDay(subject, day)}
                        className={`flex-1 min-w-0 py-1 rounded text-xs transition-all ${
                          isSelected
                            ? isWeekend
                              ? 'bg-[var(--sticker-coral)] text-white'
                              : 'bg-[var(--sticker-mint)] text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {DAY_LABELS[day][0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 시간 체크 요약 */}
          <div className="mb-6 p-4 bg-[var(--highlight-green)] rounded-xl">
            <h4 className="font-semibold text-[var(--ink-black)] mb-2">📊 시간 배분 요약</h4>
            <div className="text-sm space-y-1">
              <p>• 하루 순공시간: {dailyStudyHours}시간</p>
              <p>• 새 플랜 최소: {Object.values(subjectHoursRange).reduce((s, r) => s + r.min, 0)}시간</p>
              <p>• 새 플랜 최대: {Object.values(subjectHoursRange).reduce((s, r) => s + r.max, 0)}시간</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('status')}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-medium"
            >
              ← 이전
            </button>
            <button
              onClick={() => setStep('courses')}
              className="flex-1 py-4 bg-[var(--ink-blue)] text-white rounded-xl font-medium"
            >
              다음 →
            </button>
          </div>
        </NotebookPage>
      )}

      {/* Step 3: 강좌 선택 */}
      {step === 'courses' && (
        <NotebookPage title="📚 강좌 선택" decoration="holes">
          {/* 안내 문구 */}
          <div className="mb-4 p-3 bg-[var(--highlight-blue)] rounded-xl">
            <p className="text-sm text-[var(--ink-black)]">
              📌 이전 단계에서 설정한 과목({availableSubjects.join(', ')})의 강좌만 표시됩니다.
            </p>
          </div>

          {/* 검색 영역 */}
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="강좌명 또는 강사명 검색"
                className="flex-1 px-4 py-3 border border-[var(--paper-lines)] rounded-xl"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-3 bg-[var(--ink-blue)] text-white rounded-xl font-medium disabled:opacity-50"
              >
                {isSearching ? '...' : '검색'}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableSubjects.map(subject => (
                <button
                  key={subject}
                  onClick={() => { setSearchSubject(subject); searchCourses({ query: searchQuery, subject }); }}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                    searchSubject === subject ? 'bg-[var(--ink-blue)] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 결과 */}
          {searchError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ⚠️ {searchError.message}
            </div>
          )}

          <div className="mb-4 h-64 overflow-y-auto space-y-2 border border-[var(--paper-lines)] rounded-xl p-2 bg-gray-50">
            {searchResults.length > 0 ? (
              searchResults.map(course => {
                const isSelected = selectedCourses.some(c => c.id === course.id);
                return (
                  <div
                    key={course.id}
                    onClick={() => isSelected ? deselectCourse(course.id) : selectCourse(course)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--highlight-green)] border-[var(--sticker-mint)]'
                        : 'bg-white border-[var(--paper-lines)] hover:border-[var(--ink-blue)]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{course.courseName}</div>
                        <div className="text-xs text-[var(--pencil-gray)] mt-1">
                          {course.lecturer} · {course.subject} · {course.lectureCount}강
                        </div>
                      </div>
                      {isSelected && <span className="text-[var(--sticker-mint)]">✓</span>}
                    </div>
                  </div>
                );
              })
            ) : !isSearching && (
              <div className="p-6 bg-gray-50 rounded-xl text-center text-sm text-[var(--pencil-gray)]">
                {searchQuery || searchSubject
                  ? '검색 결과가 없습니다. 다른 키워드로 검색해보세요.'
                  : '강좌명이나 강사명을 검색하세요.'}
              </div>
            )}
          </div>

          {/* 선택된 강좌 - 버튼 위에 배치 */}
          {selectedCourses.length > 0 && (
            <div className="mt-4 p-4 bg-[var(--highlight-green)] rounded-xl">
              <h4 className="font-semibold text-[var(--ink-black)] mb-2">✅ 선택한 강좌 ({selectedCourses.length}개)</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {selectedCourses.map(course => (
                  <div key={course.id} className="p-3 bg-white rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block">{course.courseName}</span>
                        <span className="text-xs text-[var(--pencil-gray)]">{course.lecturer} · {course.lectureCount}강</span>
                      </div>
                      <button
                        onClick={() => deselectCourse(course.id)}
                        className="text-red-400 hover:text-red-600 text-sm px-2 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    {/* 이어듣기 시작점 선택 */}
                    {course.chapters && course.chapters.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-[var(--pencil-gray)]">시작:</span>
                        <select
                          value={course.startFromChapter ?? 0}
                          onChange={(e) => updateStartFromChapter(course.id, Number(e.target.value))}
                          className="flex-1 text-xs px-2 py-1.5 border border-[var(--paper-lines)] rounded-lg bg-white"
                        >
                          {course.chapters.map((chapter, idx) => {
                            const title = typeof chapter === 'string' ? chapter : chapter.title;
                            return (
                              <option key={idx} value={idx}>
                                {idx + 1}강. {title.length > 25 ? title.slice(0, 25) + '...' : title}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                    {course.startFromChapter && course.startFromChapter > 0 && (
                      <div className="mt-1 text-xs text-[var(--ink-blue)]">
                        → {course.startFromChapter + 1}강부터 시작 ({(course.lectureCount || course.chapters.length) - course.startFromChapter}강 수강)
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--pencil-gray)]">
                💡 이어듣기 시작점을 선택하면 해당 강의부터 커리큘럼이 생성됩니다.
              </p>
            </div>
          )}

          {/* 선택되지 않은 과목 안내 */}
          {(() => {
            // Step 2에서 선택했지만 아직 강좌가 없는 과목
            const missingSubjects = availableSubjects.filter(
              subject => !selectedCourses.some(c => c.subject === subject)
            );

            if (missingSubjects.length > 0 && selectedCourses.length > 0) {
              return (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-700">
                    ⚠️ 다음 과목의 강좌를 선택해주세요: <b>{missingSubjects.join(', ')}</b>
                  </p>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setStep('schedule')}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-medium"
            >
              ← 이전
            </button>
            <button
              onClick={() => {
                const missingSubjects = availableSubjects.filter(
                  subject => !selectedCourses.some(c => c.subject === subject)
                );
                if (missingSubjects.length > 0) {
                  alert(`다음 과목의 강좌를 선택해주세요: ${missingSubjects.join(', ')}`);
                  return;
                }
                generateQuests();
              }}
              disabled={isGenerating || selectedCourses.length === 0 || availableSubjects.some(
                subject => !selectedCourses.some(c => c.subject === subject)
              )}
              className="flex-1 py-4 bg-[var(--ink-blue)] text-white rounded-xl font-medium disabled:opacity-50"
            >
              {isGenerating ? `생성 중... ${elapsedSeconds}s` : '커리큘럼 생성 →'}
            </button>
          </div>
        </NotebookPage>
      )}

      {/* Step 4: 미리보기 */}
      {step === 'preview' && (
        <NotebookPage title="✨ AI 조정 미리보기" decoration="holes">
          {/* 검증 경고 */}
          {validationResult && validationResult.severity !== 'valid' && (
            <div className={`mb-6 p-4 rounded-xl ${
              validationResult.severity === 'invalid'
                ? 'bg-red-50 border border-red-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <h4 className={`font-semibold mb-2 ${
                validationResult.severity === 'invalid' ? 'text-red-800' : 'text-amber-800'
              }`}>
                {validationResult.severity === 'invalid' ? '❌ 검증 실패' : '⚠️ 검증 경고'}
              </h4>
              <ul className="text-sm space-y-1">
                {validationResult.issues.map((issue, i) => (
                  <li key={i} className={validationResult.severity === 'invalid' ? 'text-red-700' : 'text-amber-700'}>
                    • {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 생성 에러 */}
          {generateError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ⚠️ {generateError.message}
            </div>
          )}

          {/* AI 조정 요약 */}
          {questSummary && (
            <div className="mb-6 p-4 bg-[var(--highlight-blue)] rounded-xl">
              <h3 className="font-semibold text-[var(--ink-black)] mb-3">🤖 AI 생성 요약</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-white rounded-lg">
                  <span className="text-[var(--sticker-mint)]">📚</span> 총 퀘스트: {questSummary.totalQuests || generatedQuests.length}개
                </div>
                <div className="p-3 bg-white rounded-lg">
                  📅 총 학습일: {questSummary.totalDays || '--'}일
                </div>
                <div className="p-3 bg-white rounded-lg col-span-2">
                  📊 평균 일일 학습: {questSummary.averageMinutesPerDay ? Math.round(questSummary.averageMinutesPerDay / 60 * 10) / 10 : '--'}시간
                </div>
              </div>
            </div>
          )}

          {/* 일정 미리보기 */}
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--ink-black)] mb-3">📅 생성된 일정</h3>

            {generatedQuests.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* 날짜별로 그룹화 */}
                {Object.entries(
                  generatedQuests.reduce((acc, quest) => {
                    const date = quest.scheduledDate;
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(quest);
                    return acc;
                  }, {} as Record<string, typeof generatedQuests>)
                ).slice(0, 5).map(([date, quests]) => (
                  <div key={date}>
                    <div className="flex justify-between items-center py-2 border-b border-[var(--paper-lines)]">
                      <span className="font-medium">{date}</span>
                      <span className="text-sm text-[var(--pencil-gray)]">
                        총 {quests.reduce((sum, q) => sum + q.estimatedMinutes, 0)}분
                      </span>
                    </div>
                    <div className="space-y-2 mt-2">
                      {quests.map(quest => (
                        <div key={quest.id} className="p-3 bg-white border border-[var(--paper-lines)] rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{quest.title}</span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {quest.estimatedMinutes}분
                            </span>
                          </div>
                          {quest.description && (
                            <p className="text-xs text-[var(--pencil-gray)] mt-1">{quest.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(
                  generatedQuests.reduce((acc, q) => { acc[q.scheduledDate] = 1; return acc; }, {} as Record<string, number>)
                ).length > 5 && (
                  <p className="text-center text-sm text-[var(--pencil-gray)]">
                    ... 외 {Object.keys(generatedQuests.reduce((acc, q) => { acc[q.scheduledDate] = 1; return acc; }, {} as Record<string, number>)).length - 5}일
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 bg-gray-50 rounded-xl text-center text-sm text-[var(--pencil-gray)]">
                생성된 퀘스트가 없습니다.
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('courses')}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-medium"
            >
              ← 수정하기
            </button>
            <button
              onClick={addToPlannerAndNavigate}
              disabled={generatedQuests.length === 0}
              className="flex-1 py-4 bg-[var(--sticker-mint)] text-white rounded-xl font-medium disabled:opacity-50"
            >
              플랜 저장 ✅
            </button>
          </div>
        </NotebookPage>
      )}
    </>
  );
}
