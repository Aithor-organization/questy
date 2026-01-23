/**
 * useCurriculumBeta Hook
 * 베타 커리큘럼 생성 기능을 위한 훅
 * - 사용자 프로필에서 순공시간 로드
 * - 기존 플랜 충돌 분석
 * - 강좌 검색 (Supabase 직접 호출)
 * - AI 기반 퀘스트 생성
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useQuestStore, type QuestPlan } from '../stores/questStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { refreshSession } from '../lib/session-keepalive';
import { API_BASE_URL } from '../config';
import type { DayOfWeek } from '@questybook/shared';
import type {
  Course,
  SelectedCourse,
  CurriculumQuest,
  GenerateQuestsResponse,
  ValidationResult,
} from '../types/curriculum';
import type { SubjectHoursRange, ConflictAnalysis, BetaStep } from '../pages/generate/types';

// 과목별 기본 시간 범위
const DEFAULT_SUBJECT_HOURS_RANGE: SubjectHoursRange = {
  math: { min: 1.5, max: 3 },
  korean: { min: 1, max: 2 },
  english: { min: 1, max: 1.5 },
};

// 과목별 기본 요일 설정
const DEFAULT_SUBJECT_DAYS: Record<string, DayOfWeek[]> = {
  math: ['mon', 'tue', 'wed', 'thu', 'fri'],
  korean: ['mon', 'wed', 'fri'],
  english: ['tue', 'thu'],
};

export function useCurriculumBeta() {
  const navigate = useNavigate();
  const addPlan = useQuestStore((state) => state.addPlan);
  const existingPlans = useQuestStore((state) => state.plans);
  const isHydrated = useQuestStore((state) => state.isHydrated);
  const userId = useAuthStore((state) => state.user?.id);

  // Step 관리
  const [step, setStep] = useState<BetaStep>('status');

  // Step 1: 기본 설정
  // 시작일 기본값: 오늘 (서울 시간 기준)
  const getSeoulToday = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const seoul = new Date(utc + (9 * 60 * 60000));
    return seoul.toISOString().split('T')[0];
  };
  const [startDate, setStartDate] = useState<string>(getSeoulToday());
  const [targetDate, setTargetDate] = useState<string>('');

  // 사용자 프로필에서 순공시간 로드 (캐시 활용)
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId || !supabase) return { dailyStudyHours: 5 };

      const { data, error } = await supabase
        .from('user_profiles')
        .select('daily_study_hours')
        .eq('id', userId)
        .single();

      if (error || !data?.daily_study_hours) {
        return { dailyStudyHours: 5 };
      }

      return { dailyStudyHours: data.daily_study_hours };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000,   // 10분간 가비지 컬렉션 방지
    placeholderData: { dailyStudyHours: 5 }, // 초기 placeholder
  });

  const dailyStudyHours = userProfile?.dailyStudyHours ?? 5;

  // Step 2: 일정 설정
  const [subjectHoursRange, setSubjectHoursRange] = useState<SubjectHoursRange>(DEFAULT_SUBJECT_HOURS_RANGE);
  const [subjectDays, setSubjectDays] = useState<Record<string, DayOfWeek[]>>(DEFAULT_SUBJECT_DAYS);

  // 학습 요일 = 과목별 요일의 합집합 (자동 계산)
  const selectedDays = useMemo((): DayOfWeek[] => {
    const allDays = new Set<DayOfWeek>();
    Object.values(subjectDays).forEach(days => {
      days.forEach(day => allDays.add(day));
    });
    // 요일 순서대로 정렬
    const dayOrder: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return dayOrder.filter(d => allDays.has(d));
  }, [subjectDays]);

  // 목표 학습 일수 = 시작일부터 목표일까지 학습 요일 카운트 (자동 계산)
  const totalDays = useMemo((): number => {
    if (!startDate || !targetDate || selectedDays.length === 0) return 0;

    // YYYY-MM-DD 형식 파싱
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const target = new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0, 0);

    if (target < start) return 0;

    let count = 0;
    const current = new Date(start);
    const dayToIndex: Record<DayOfWeek, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    const selectedDayIndices = new Set(selectedDays.map(d => dayToIndex[d]));

    while (current <= target) {
      if (selectedDayIndices.has(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }, [startDate, targetDate, selectedDays]);

  // Step 3: 강좌 검색/선택
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<Error | null>(null);
  const searchRequestIdRef = useRef(0);

  // Step 4: 생성 결과
  const [generatedQuests, setGeneratedQuests] = useState<CurriculumQuest[]>([]);
  const [questSummary, setQuestSummary] = useState<GenerateQuestsResponse['summary'] | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);


  // 기존 플랜에서 요일별 사용 시간 계산
  const existingHoursByDay = useMemo(() => {
    const hoursByDay: Record<DayOfWeek, number> = {
      mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
    };

    existingPlans.forEach(plan => {
      plan.dailyQuests.forEach(quest => {
        const date = new Date(quest.date);
        const dayIndex = date.getDay();
        const dayMap: Record<number, DayOfWeek> = {
          0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
        };
        const day = dayMap[dayIndex];
        if (!quest.completed) {
          hoursByDay[day] += (quest.estimatedMinutes || 0) / 60;
        }
      });
    });

    return hoursByDay;
  }, [existingPlans]);

  // 충돌 분석
  const conflictAnalysis = useMemo((): ConflictAnalysis[] => {
    const newPlanMin = Object.values(subjectHoursRange).reduce((sum, range) => sum + range.min, 0);
    const newPlanMax = Object.values(subjectHoursRange).reduce((sum, range) => sum + range.max, 0);

    return selectedDays.map(day => {
      const existing = existingHoursByDay[day];
      const available = dailyStudyHours - existing;

      let conflictLevel: 'none' | 'partial' | 'severe';
      let suggestion: string;

      if (newPlanMax <= available) {
        conflictLevel = 'none';
        suggestion = '충분한 여유 시간';
      } else if (newPlanMin <= available) {
        conflictLevel = 'partial';
        suggestion = `최대 ${available.toFixed(1)}시간까지 가능 (AI 조율)`;
      } else {
        conflictLevel = 'severe';
        suggestion = `${(newPlanMin - available).toFixed(1)}시간 부족`;
      }

      return {
        day,
        existingHours: existing,
        availableHours: available,
        newPlanMin,
        newPlanMax,
        conflictLevel,
        suggestion,
      };
    });
  }, [selectedDays, existingHoursByDay, subjectHoursRange, dailyStudyHours]);

  // 예상 완료일 계산
  const estimatedEndDate = useMemo(() => {
    if (!selectedDays.length) return null;
    const daysPerWeek = selectedDays.length;
    const weeksNeeded = Math.ceil(totalDays / daysPerWeek);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeksNeeded * 7);
    return endDate.toISOString().split('T')[0];
  }, [totalDays, selectedDays]);

  // 강좌 검색 (Supabase 직접 호출)
  const searchCourses = useCallback(async (params: { query?: string; subject?: string }) => {
    const currentRequestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const refreshed = await refreshSession(2);
          if (!refreshed) {
            throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
          }
        }

        let queryBuilder = supabase
          .from('courses')
          .select('*')
          .order('teacher_name')
          .order('name')
          .limit(50);

        if (params.query) {
          queryBuilder = queryBuilder.or(
            `name.ilike.%${params.query}%,teacher_name.ilike.%${params.query}%`
          );
        }

        if (params.subject) {
          queryBuilder = queryBuilder.eq('subject', params.subject);
        }

        const { data, error } = await queryBuilder;

        if (currentRequestId !== searchRequestIdRef.current) return;

        if (error) {
          throw new Error(error.message);
        }

        const courses: Course[] = (data || []).map((course: any) => ({
          id: course.id,
          courseName: course.name,
          lecturer: course.teacher_name,
          subject: course.subject || '',
          platform: course.platform || 'megastudy',
          url: course.url || '',
          chapters: typeof course.lectures === 'string'
            ? JSON.parse(course.lectures || '[]')
            : (course.lectures || []),
          lectureCount: course.lecture_count || 0,
          totalDuration: course.total_duration || '',
          isCompleted: course.is_completed || false,
        }));

        setSearchResults(courses);
        return;
      }

      // Supabase 없으면 백엔드 API 폴백
      const res = await fetch(`${API_BASE_URL}/api/curriculum/search-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (currentRequestId !== searchRequestIdRef.current) return;

      if (!res.ok) throw new Error('강좌 검색 실패');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSearchResults(data.data.courses as Course[]);

    } catch (error) {
      if (currentRequestId !== searchRequestIdRef.current) return;
      console.error('[useCurriculumBeta] Search error:', error);
      setSearchError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      if (currentRequestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  // 강좌 선택/해제
  const selectCourse = useCallback((course: Course) => {
    setSelectedCourses(prev => {
      if (prev.find(c => c.id === course.id)) return prev;
      return [...prev, course];
    });
  }, []);

  const deselectCourse = useCallback((courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  // 이어듣기 시작점 업데이트
  const updateStartFromChapter = useCallback((courseId: string, chapterIndex: number | undefined) => {
    setSelectedCourses(prev =>
      prev.map(c =>
        c.id === courseId ? { ...c, startFromChapter: chapterIndex } : c
      )
    );
  }, []);

  // AI 퀘스트 생성
  const generateMutation = useMutation({
    mutationFn: async () => {
      // 기존 플랜 데이터 변환
      const existingPlanData = existingPlans.map(plan => ({
        id: plan.id,
        materialName: plan.materialName,
        dailyQuests: plan.dailyQuests.map(q => ({
          date: q.date,
          estimatedMinutes: q.estimatedMinutes,
          completed: q.completed,
          unitTitle: q.unitTitle,
        })),
      }));

      // subjectHoursRange를 API 형식으로 변환 (min, max 모두 전달)
      const subjectHoursApi: Record<string, { min: number; max: number }> = {};
      Object.entries(subjectHoursRange).forEach(([subject, range]) => {
        subjectHoursApi[subject] = { min: range.min, max: range.max };
      });

      // subjectDays를 API 형식으로 변환 (number[])
      const subjectDaysApi: Record<string, number[]> = {};
      const dayToNumber: Record<DayOfWeek, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      };
      Object.entries(subjectDays).forEach(([subject, days]) => {
        subjectDaysApi[subject] = days.map(d => dayToNumber[d]);
      });

      const res = await fetch(`${API_BASE_URL}/api/curriculum/generate-quests-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: userId || 'anonymous',
          courseContents: selectedCourses,
          targetDate,
          dailyStudyHours,
          subjectHours: subjectHoursApi,
          subjectDays: subjectDaysApi,
          options: {
            includeOT: false,
            reviewSettings: {
              enabled: false,  // 복습 퀘스트 비활성화
              sameDayReview: false,
              reviewDuration: 0,
            },
          },
          existingPlans: existingPlanData,
        }),
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`응답 파싱 실패: ${responseText.slice(0, 100)}`);
      }

      if (!res.ok || !data.success) {
        if (data.validation) {
          const validationError = new Error(data.error || '커리큘럼 검증 실패') as Error & { validation: ValidationResult };
          validationError.validation = data.validation;
          throw validationError;
        }
        throw new Error(data.error || '퀘스트 생성에 실패했습니다');
      }

      return data.data as GenerateQuestsResponse;
    },
    onSuccess: (data) => {
      setValidationResult(data.validation || null);
      setGeneratedQuests(data.quests);
      setQuestSummary(data.summary);
      setStep('preview');
    },
    onError: (error: Error & { validation?: ValidationResult }) => {
      console.error('[useCurriculumBeta] Generate error:', error);
      if (error.validation) {
        setValidationResult(error.validation);
      }
    },
  });

  // 플래너에 추가
  const addToPlannerAndNavigate = useCallback(() => {
    if (generatedQuests.length === 0) return;

    // ⭐ 강좌별로 퀘스트 그룹화 (과목이 아닌 강좌 단위로 플랜 생성)
    const questsByCourse = generatedQuests.reduce((acc, quest) => {
      const courseId = quest.courseId;
      if (!acc[courseId]) acc[courseId] = [];
      acc[courseId].push(quest);
      return acc;
    }, {} as Record<string, CurriculumQuest[]>);

    // ⭐ 각 강좌별로 플랜 생성
    Object.entries(questsByCourse).forEach(([courseId, quests]) => {
      // 날짜순 정렬
      const sortedQuests = [...quests].sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate)
      );

      const dateSet = [...new Set(sortedQuests.map(q => q.scheduledDate))].sort();
      const dateToDay = new Map(dateSet.map((date, idx) => [date, idx + 1]));

      const dailyQuests = sortedQuests.map((quest, idx) => ({
        id: quest.id || crypto.randomUUID(),
        day: dateToDay.get(quest.scheduledDate) || idx + 1,
        date: quest.scheduledDate,
        unitNumber: idx + 1,
        unitTitle: quest.title,
        range: quest.section || quest.chapter,
        estimatedMinutes: quest.estimatedMinutes,
        completed: false,
        topics: [quest.chapter, quest.section].filter(Boolean) as string[],
        objectives: [quest.description],
        studyTips: quest.studyTips || {
          importance: quest.priority === 'high' ? '중요도 높음' : '일반',
          keyPoints: [`${quest.subject} - ${quest.chapter}`],
          studyMethod: quest.questType === 'lecture' ? '인강 시청' : '문제 풀이',
        },
      }));

      const totalMinutes = sortedQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

      // 강좌 정보 가져오기
      const courseInfo = selectedCourses.find(c => c.id === courseId);
      const courseName = courseInfo?.courseName || sortedQuests[0]?.courseName || '강좌';
      const subject = courseInfo?.subject || sortedQuests[0]?.subject || '';
      const lecturer = courseInfo?.lecturer || sortedQuests[0]?.lecturer || '';

      const plan: Omit<QuestPlan, 'id' | 'createdAt'> = {
        materialName: `📚 [${subject}] ${courseName.slice(0, 30)}${courseName.length > 30 ? '...' : ''}`,
        dailyQuests,
        summary: {
          totalDays: dateSet.length,
          totalUnits: sortedQuests.length,
          averageMinutesPerDay: Math.round(totalMinutes / Math.max(dateSet.length, 1)),
          totalEstimatedHours: Math.round(totalMinutes / 60),
        },
        aiMessage: `${lecturer ? `${lecturer} 선생님의 ` : ''}${courseName} - ${dateSet.length}일간의 학습 계획`,
      };

      addPlan(plan);
    });

    // 초기화 후 이동
    reset();
    navigate('/planner');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedQuests, selectedCourses, addPlan, navigate]);


  // 과목별 요일 토글
  const toggleSubjectDay = useCallback((subject: string, day: DayOfWeek) => {
    setSubjectDays(prev => {
      const current = prev[subject] || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, [subject]: updated };
    });
  }, []);

  // 시간 범위 업데이트
  const updateHoursRange = useCallback((subject: string, field: 'min' | 'max', value: number) => {
    setSubjectHoursRange(prev => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value },
    }));
  }, []);

  // 과목 추가
  const addSubject = useCallback((subject: string) => {
    setSubjectHoursRange(prev => ({
      ...prev,
      [subject]: { min: 1, max: 2 },
    }));
    setSubjectDays(prev => ({
      ...prev,
      [subject]: ['mon', 'tue', 'wed', 'thu', 'fri'],
    }));
  }, []);

  // 과목 제거
  const removeSubject = useCallback((subject: string) => {
    setSubjectHoursRange(prev => {
      const next = { ...prev };
      delete next[subject];
      return next;
    });
    setSubjectDays(prev => {
      const next = { ...prev };
      delete next[subject];
      return next;
    });
  }, []);

  // 에러 초기화
  const clearErrors = useCallback(() => {
    setSearchError(null);
    // generateMutation.reset()은 mutation 상태 전체를 초기화하므로 사용하지 않음
    // generateError는 읽기 전용이므로 mutation을 다시 호출하면 자동으로 초기화됨
  }, []);

  // 스텝 변경 (에러 자동 초기화 포함)
  const changeStep = useCallback((newStep: BetaStep) => {
    clearErrors();
    setStep(newStep);
  }, [clearErrors]);

  // 초기화
  const reset = useCallback(() => {
    setStep('status');
    setStartDate(getSeoulToday());
    setTargetDate('');
    setSubjectHoursRange(DEFAULT_SUBJECT_HOURS_RANGE);
    setSubjectDays(DEFAULT_SUBJECT_DAYS);
    setSearchResults([]);
    setSelectedCourses([]);
    setGeneratedQuests([]);
    setQuestSummary(null);
    setValidationResult(null);
    clearErrors();
  }, [clearErrors]);

  return {
    // Step 관리
    step,
    setStep: changeStep,  // 에러 자동 초기화 포함

    // Step 1: 기본 설정
    startDate,
    setStartDate,
    targetDate,
    setTargetDate,
    dailyStudyHours,  // 캐시된 값 사용
    existingPlans,
    isHydrated,       // 스토어 hydration 상태

    // Step 2: 일정 설정 (자동 계산)
    totalDays,      // 자동 계산됨
    selectedDays,   // 과목별 요일 합집합으로 자동 계산됨
    subjectHoursRange,
    updateHoursRange,
    subjectDays,
    toggleSubjectDay,
    addSubject,
    removeSubject,

    // 분석 결과
    existingHoursByDay,
    conflictAnalysis,
    estimatedEndDate,

    // Step 3: 강좌 검색/선택
    searchResults,
    selectedCourses,
    searchCourses,
    selectCourse,
    deselectCourse,
    updateStartFromChapter,
    isSearching,
    searchError,

    // Step 4: 생성 결과
    generatedQuests,
    questSummary,
    validationResult,

    // 액션
    generateQuests: generateMutation.mutate,
    addToPlannerAndNavigate,
    reset,

    // 로딩 상태
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
  };
}
