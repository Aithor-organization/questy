/**
 * OnboardingPage
 * 회원가입 후 필수 온보딩 - 사용자 프로필 수집
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Sparkles, User, Target, BookOpen, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// authStore에서 함수들 직접 접근용
const getSetOnboardingCompleted = () => useAuthStore.getState().setOnboardingCompleted;
const getLoadMembership = () => useAuthStore.getState().loadMembership;

// 고정 과목 (필수)
const FIXED_SUBJECTS = ['국어', '수학', '영어', '한국사'] as const;

// 탐구 과목 옵션
const SOCIAL_SUBJECTS = [
  '생활과윤리', '윤리와사상', '한국지리', '세계지리',
  '동아시아사', '세계사', '경제', '정치와법', '사회문화'
] as const;

const SCIENCE_SUBJECTS = [
  '물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ',
  '생명과학Ⅰ', '생명과학Ⅱ', '지구과학Ⅰ', '지구과학Ⅱ'
] as const;

// ALL_TAMGU_SUBJECTS는 추후 확장용으로 유지
// const ALL_TAMGU_SUBJECTS = [...SOCIAL_SUBJECTS, ...SCIENCE_SUBJECTS];

// 등급 옵션
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// N수생 옵션
const EXAM_YEAR_OPTIONS = [
  { value: 0, label: '현역 (고3)' },
  { value: 1, label: '재수생 (N+1)' },
  { value: 2, label: '삼수생 (N+2)' },
  { value: 3, label: '그 이상' },
];

// 인강 사이트 옵션
const PLATFORM_OPTIONS = [
  { id: 'megastudy', name: '메가스터디' },
  { id: 'etoos', name: '이투스' },
  { id: 'daesung', name: '대성마이맥' },
  { id: 'ebsi', name: 'EBSi' },
  { id: 'skyedu', name: '스카이에듀' },
  { id: 'jinhak', name: '진학사' },
  { id: 'other', name: '기타' },
];

// 유입 경로 옵션
const REFERRAL_OPTIONS = [
  { id: 'orbi', name: '오르비' },
  { id: 'open_chat', name: '오픈채팅방' },
  { id: 'friend', name: '지인' },
  { id: 'other_community', name: '기타 커뮤니티홍보' },
] as const;

// 온보딩 데이터 타입
interface OnboardingData {
  age: number | null;
  examYear: number;
  targetUniversity: string;
  targetGrades: Record<string, number>;
  currentGrades: Record<string, number>;
  selectedTamgu1: string; // 탐구1 선택 과목
  selectedTamgu2: string; // 탐구2 선택 과목
  subscribedPlatforms: string[];
  subscribedPlatformDetail: string; // 기타 인강 사이트 세부 내용
  dailyStudyHours: number;
  referralSource: string; // 유입 경로
  referralSourceDetail: string; // 기타 커뮤니티 세부 내용
}

const INITIAL_DATA: OnboardingData = {
  age: null,
  examYear: 0,
  targetUniversity: '',
  targetGrades: {},
  currentGrades: {},
  selectedTamgu1: '',
  selectedTamgu2: '',
  subscribedPlatforms: [],
  subscribedPlatformDetail: '',
  dailyStudyHours: 8,
  referralSource: '',
  referralSourceDetail: '',
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 5;

  // 선택된 과목 목록 (고정 과목 + 선택한 탐구)
  const getSelectedSubjects = (): string[] => {
    const subjects: string[] = [...FIXED_SUBJECTS];
    if (data.selectedTamgu1) subjects.push(data.selectedTamgu1);
    if (data.selectedTamgu2) subjects.push(data.selectedTamgu2);
    return subjects;
  };

  // 단계별 유효성 검사
  const isStepValid = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return data.age !== null && data.age >= 15 && data.age <= 99;
      case 2:
        // 탐구 과목 2개 선택 + 필수 과목 등급 입력 (최소 4과목)
        return data.selectedTamgu1 !== '' &&
               data.selectedTamgu2 !== '' &&
               data.selectedTamgu1 !== data.selectedTamgu2 &&
               Object.keys(data.currentGrades).length >= 4;
      case 3:
        return data.targetUniversity.trim().length > 0;
      case 4:
        return data.subscribedPlatforms.length > 0;
      case 5:
        // 유입 경로 선택 필수, 기타일 경우 상세 내용 입력 필수
        if (!data.referralSource) return false;
        if (data.referralSource === 'other_community' && !data.referralSourceDetail.trim()) return false;
        return true;
      default:
        return true;
    }
  };

  // 다음 단계
  const handleNext = () => {
    if (step < totalSteps && isStepValid(step)) {
      setError(null);  // 스텝 이동 시 에러 초기화
      setStep(step + 1);
    }
  };

  // 이전 단계
  const handleBack = () => {
    if (step > 1) {
      setError(null);  // 스텝 이동 시 에러 초기화
      setStep(step - 1);
    }
  };

  // 등급 선택
  const handleGradeChange = (
    type: 'target' | 'current',
    subject: string,
    grade: number
  ) => {
    if (type === 'target') {
      setData(prev => ({
        ...prev,
        targetGrades: { ...prev.targetGrades, [subject]: grade },
      }));
    } else {
      setData(prev => ({
        ...prev,
        currentGrades: { ...prev.currentGrades, [subject]: grade },
      }));
    }
  };

  // 플랫폼 토글
  const togglePlatform = (platformId: string) => {
    setData(prev => ({
      ...prev,
      subscribedPlatforms: prev.subscribedPlatforms.includes(platformId)
        ? prev.subscribedPlatforms.filter(p => p !== platformId)
        : [...prev.subscribedPlatforms, platformId],
    }));
  };

  // 제출
  const handleSubmit = async () => {
    if (!user || !supabase) {
      setError('로그인이 필요합니다');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          age: data.age,
          exam_year: data.examYear,
          target_university: data.targetUniversity,
          target_grades: data.targetGrades,
          current_grades: data.currentGrades,
          selected_tamgu1: data.selectedTamgu1,
          selected_tamgu2: data.selectedTamgu2,
          subscribed_platforms: data.subscribedPlatforms,
          subscribed_platform_detail: data.subscribedPlatforms.includes('other') ? data.subscribedPlatformDetail : null,
          daily_study_hours: data.dailyStudyHours,
          referral_source: data.referralSource,
          referral_source_detail: data.referralSource === 'other_community' ? data.referralSourceDetail : null,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error('[Onboarding] Save error:', upsertError);
        setError('저장에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      // 베타테스터로 멤버십 활성화
      const { data: membershipResult, error: membershipError } = await supabase
        .rpc('activate_beta_membership');

      if (membershipError) {
        console.error('[Onboarding] Membership activation error:', membershipError);
        // 멤버십 활성화 실패해도 프로필은 저장됨 - pending 페이지로 이동
        getSetOnboardingCompleted()(true);
        navigate('/pending', { replace: true });
        return;
      }

      console.log('[Onboarding] Membership activation result:', membershipResult);

      // RPC 결과 확인 (success: false인 경우도 처리)
      if (membershipResult && !membershipResult.success) {
        console.warn('[Onboarding] Membership activation failed:', membershipResult.error);
        // 실패한 경우에도 프로필은 저장됨 - pending 페이지로 이동
        getSetOnboardingCompleted()(true);
        navigate('/pending', { replace: true });
        return;
      }

      // 성공 - 로컬 상태 업데이트
      getSetOnboardingCompleted()(true);

      // 멤버십 데이터 새로고침 (베타테스터 상태 반영)
      const loadedMembership = await getLoadMembership()();
      console.log('[Onboarding] Membership data reloaded:', loadedMembership);

      // 베타테스터로 활성화되었으므로 메인 페이지로 이동
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      setError('오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen notebook-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* 노트북 페이지 */}
        <div className="notebook-page relative">
          <div className="notebook-holes hidden sm:flex">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="notebook-hole" />
            ))}
          </div>

          <div className="p-6 sm:p-8 sm:pl-20">
            {/* 헤더 */}
            <div className="text-center mb-6">
              <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
                환영합니다! 🎉
              </h1>
              <p className="text-[var(--pencil-gray)] text-sm mt-1">
                맞춤형 학습을 위해 몇 가지 정보가 필요해요
              </p>
            </div>

            {/* 진행 바 */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-[var(--pencil-gray)] mb-2">
                <span>Step {step} / {totalSteps}</span>
                <span>{Math.round((step / totalSteps) * 100)}%</span>
              </div>
              <div className="h-2 bg-[var(--paper-lines)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--sticker-mint)] transition-all duration-300"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>

            {/* Step 1: 기본 정보 */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[var(--ink-blue)] font-medium mb-4">
                  <User className="w-5 h-5" />
                  <span>기본 정보</span>
                </div>

                {/* 나이 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    나이(만)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={99}
                    step={1}
                    value={data.age || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 정수만 허용 (소수점 입력 방지)
                      const intValue = value ? Math.floor(Number(value)) : null;
                      setData(prev => ({ ...prev, age: intValue }));
                    }}
                    onKeyDown={(e) => {
                      // 소수점 입력 차단
                      if (e.key === '.' || e.key === ',') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="예: 19"
                    className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none"
                  />
                </div>

                {/* N수생 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    수험 년차
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXAM_YEAR_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setData(prev => ({ ...prev, examYear: option.value }))}
                        className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${
                          data.examYear === option.value
                            ? 'border-[var(--ink-blue)] bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
                            : 'border-[var(--paper-lines)] bg-white hover:border-[var(--pencil-gray)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: 현재 실력 (탐구 과목 선택 + 현재 등급) */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[var(--ink-blue)] font-medium mb-4">
                  <BookOpen className="w-5 h-5" />
                  <span>현재 실력</span>
                </div>

                {/* 탐구 과목 선택 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    탐구 과목 선택
                  </label>
                  <p className="text-xs text-[var(--pencil-gray)] mb-3">
                    응시할 탐구 과목 2개를 선택해주세요
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 1</label>
                      <select
                        value={data.selectedTamgu1}
                        onChange={(e) => setData(prev => ({ ...prev, selectedTamgu1: e.target.value }))}
                        className="w-full px-3 py-2 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none text-sm"
                      >
                        <option value="">선택하세요</option>
                        <optgroup label="사회탐구">
                          {SOCIAL_SUBJECTS.map(subj => (
                            <option key={subj} value={subj} disabled={subj === data.selectedTamgu2}>
                              {subj}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="과학탐구">
                          {SCIENCE_SUBJECTS.map(subj => (
                            <option key={subj} value={subj} disabled={subj === data.selectedTamgu2}>
                              {subj}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 2</label>
                      <select
                        value={data.selectedTamgu2}
                        onChange={(e) => setData(prev => ({ ...prev, selectedTamgu2: e.target.value }))}
                        className="w-full px-3 py-2 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none text-sm"
                      >
                        <option value="">선택하세요</option>
                        <optgroup label="사회탐구">
                          {SOCIAL_SUBJECTS.map(subj => (
                            <option key={subj} value={subj} disabled={subj === data.selectedTamgu1}>
                              {subj}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="과학탐구">
                          {SCIENCE_SUBJECTS.map(subj => (
                            <option key={subj} value={subj} disabled={subj === data.selectedTamgu1}>
                              {subj}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 현재 등급 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    현재 등급 (최근 모의고사 기준)
                  </label>
                  <div className="space-y-2">
                    {getSelectedSubjects().map(subject => (
                      <div key={subject} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-[var(--pencil-gray)] truncate">{subject}</span>
                        <div className="flex gap-1 flex-wrap">
                          {GRADES.map(grade => (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => handleGradeChange('current', subject, grade)}
                              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                                data.currentGrades[subject] === grade
                                  ? 'bg-[var(--sticker-coral)] text-white'
                                  : 'bg-[var(--paper-cream)] border border-[var(--paper-lines)] hover:border-[var(--pencil-gray)]'
                              }`}
                            >
                              {grade}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: 목표 설정 */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[var(--ink-blue)] font-medium mb-4">
                  <Target className="w-5 h-5" />
                  <span>목표 설정</span>
                </div>

                {/* 목표 대학 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    목표 대학
                  </label>
                  <input
                    type="text"
                    value={data.targetUniversity}
                    onChange={(e) => setData(prev => ({ ...prev, targetUniversity: e.target.value }))}
                    placeholder="예: 서울대학교 경영학과"
                    className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none"
                  />
                </div>

                {/* 목표 등급 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    목표 등급 (과목별)
                  </label>
                  <p className="text-xs text-[var(--pencil-gray)] mb-3">
                    선택한 과목: {getSelectedSubjects().join(', ')}
                  </p>
                  <div className="space-y-2">
                    {getSelectedSubjects().map(subject => (
                      <div key={subject} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-[var(--pencil-gray)] truncate">{subject}</span>
                        <div className="flex gap-1 flex-wrap">
                          {GRADES.map(grade => (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => handleGradeChange('target', subject, grade)}
                              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                                data.targetGrades[subject] === grade
                                  ? 'bg-[var(--sticker-mint)] text-white'
                                  : 'bg-[var(--paper-cream)] border border-[var(--paper-lines)] hover:border-[var(--pencil-gray)]'
                              }`}
                            >
                              {grade}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: 학습 환경 */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[var(--ink-blue)] font-medium mb-4">
                  <Clock className="w-5 h-5" />
                  <span>학습 환경</span>
                </div>

                {/* 구독 인강 사이트 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    구독 중인 인강 사이트
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORM_OPTIONS.map(platform => (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => togglePlatform(platform.id)}
                        className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${
                          data.subscribedPlatforms.includes(platform.id)
                            ? 'border-[var(--ink-blue)] bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
                            : 'border-[var(--paper-lines)] bg-white hover:border-[var(--pencil-gray)]'
                        }`}
                      >
                        {platform.name}
                      </button>
                    ))}
                  </div>

                  {/* 기타 인강 사이트 선택 시 입력 필드 */}
                  {data.subscribedPlatforms.includes('other') && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={data.subscribedPlatformDetail}
                        onChange={(e) => setData(prev => ({ ...prev, subscribedPlatformDetail: e.target.value }))}
                        placeholder="사용 중인 인강 사이트를 입력해주세요"
                        className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* 하루 순공 시간 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    하루 순공 시간
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={16}
                      value={data.dailyStudyHours}
                      onChange={(e) => setData(prev => ({ ...prev, dailyStudyHours: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-[var(--paper-lines)] rounded-lg appearance-none cursor-pointer accent-[var(--ink-blue)]"
                    />
                    <span className="w-20 text-center font-bold text-[var(--ink-blue)]">
                      {data.dailyStudyHours}시간
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: 유입 경로 */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[var(--ink-blue)] font-medium mb-4">
                  <Sparkles className="w-5 h-5" />
                  <span>마지막 질문!</span>
                </div>

                {/* 유입 경로 선택 */}
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                    퀘스티를 어떻게 알게 되셨나요?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {REFERRAL_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setData(prev => ({
                          ...prev,
                          referralSource: option.id,
                          // 기타가 아닌 경우 상세 내용 초기화
                          referralSourceDetail: option.id !== 'other_community' ? '' : prev.referralSourceDetail,
                        }))}
                        className={`px-4 py-3 border-2 rounded-lg text-sm font-medium transition-all ${
                          data.referralSource === option.id
                            ? 'border-[var(--ink-blue)] bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
                            : 'border-[var(--paper-lines)] bg-white hover:border-[var(--pencil-gray)]'
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 기타 커뮤니티 선택 시 상세 입력 */}
                {data.referralSource === 'other_community' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
                      어떤 커뮤니티인가요?
                    </label>
                    <input
                      type="text"
                      value={data.referralSourceDetail}
                      onChange={(e) => setData(prev => ({ ...prev, referralSourceDetail: e.target.value }))}
                      placeholder="예: 수만휘, 에브리타임 등"
                      className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none"
                    />
                  </div>
                )}

                <p className="text-xs text-[var(--pencil-gray)] mt-2">
                  💡 더 나은 서비스를 제공하기 위해 활용됩니다
                </p>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="mt-4 p-3 bg-[var(--highlight-pink)] border border-[var(--ink-red)] rounded-lg text-[var(--ink-red)] text-sm">
                {error}
              </div>
            )}

            {/* 네비게이션 버튼 */}
            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2 text-[var(--pencil-gray)] hover:text-[var(--ink-black)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전
                </button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid(step)}
                  className={`flex items-center gap-1 px-6 py-2 rounded-lg font-medium transition-all ${
                    isStepValid(step)
                      ? 'bg-[var(--ink-blue)] text-white hover:opacity-90'
                      : 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                  }`}
                >
                  다음
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isStepValid(step) || isSubmitting}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                    isStepValid(step) && !isSubmitting
                      ? 'bg-[var(--sticker-mint)] text-white hover:opacity-90'
                      : 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isSubmitting ? '저장 중...' : '시작하기'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 하단 메시지 */}
        <p className="text-center text-[var(--pencil-gray)] text-xs mt-6 handwrite">
          💡 입력한 정보는 맞춤형 학습 추천에 활용됩니다
        </p>
      </div>
    </div>
  );
}
