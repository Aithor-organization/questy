// Curriculum Generation Hook
// 인강 강좌 검색 및 퀘스트 생성 (questStore 통합)
// 강좌 검색: Supabase 직접 호출 (Railway 부하 감소)

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useQuestStore, type QuestPlan } from '../stores/questStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { refreshSession } from '../lib/session-keepalive';
import { API_BASE_URL } from '../config';

// Supabase 쿼리 로그 헬퍼
const logQuery = (table: string, action: string, details?: string) => {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(
    `%c[Supabase] 📡 ${table}.${action} (${timestamp})${details ? ` - ${details}` : ''}`,
    'color: #06b6d4; font-weight: bold;'
  );
};

const logQueryResult = (table: string, action: string, count: number | null, error?: string) => {
  if (error) {
    console.log(
      `%c[Supabase] ❌ ${table}.${action} 실패: ${error}`,
      'color: #ef4444;'
    );
  } else {
    console.log(
      `%c[Supabase] ✅ ${table}.${action} 완료 (${count ?? 0}건)`,
      'color: #22c55e;'
    );
  }
};
import type {
  Course,
  SelectedCourse,
  SubjectRatio,
  SubjectHours,
  SubjectDays,
  CurriculumOptions,
  CurriculumQuest,
  GenerateQuestsResponse,
  ValidationResult,
  CurriculumReviewResult,
} from '../types/curriculum';

const DEFAULT_SUBJECT_RATIO: SubjectRatio = {
  국어: 20,
  영어: 25,
  수학: 35,
  한국사: 5,
  탐구1: 7.5,
  탐구2: 7.5,
};

const DEFAULT_SUBJECT_HOURS: SubjectHours = {
  국어: null,
  영어: null,
  수학: null,
  한국사: null,
  탐구1: null,
  탐구2: null,
};

// 기본 요일 설정 (모든 요일 선택: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_SUBJECT_DAYS: SubjectDays = {
  국어: [...ALL_DAYS],
  영어: [...ALL_DAYS],
  수학: [...ALL_DAYS],
  한국사: [...ALL_DAYS],
  탐구1: [...ALL_DAYS],
  탐구2: [...ALL_DAYS],
};

const DEFAULT_CURRICULUM_OPTIONS: CurriculumOptions = {
  includeOT: false,
  reviewSettings: {
    enabled: true,
    sameDayReview: true,
    reviewDuration: 15,
  },
  customSchedule: [],
  // 남는 날 활용 옵션 (A2 시나리오: 강의 < 가용일)
  extraDaysOption: {
    enabled: true,           // 기본 활성화
    fillWithReview: true,    // 복습으로 채우기
    fillWithPractice: true,  // 문제풀이로 채우기
  },
};

export function useCurriculumGeneration() {
  const navigate = useNavigate();
  const addPlan = useQuestStore((state) => state.addPlan);
  const existingPlans = useQuestStore((state) => state.plans);
  const userId = useAuthStore((state) => state.user?.id);

  // 임시 상태 (Hook 내부에서 관리)
  const [searchResults, setSearchResults] = useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [subjectRatio, setSubjectRatio] = useState<SubjectRatio>(DEFAULT_SUBJECT_RATIO);
  const [subjectHours, setSubjectHours] = useState<SubjectHours>(DEFAULT_SUBJECT_HOURS);
  const [subjectDays, setSubjectDays] = useState<SubjectDays>(DEFAULT_SUBJECT_DAYS);
  const [curriculumOptions, setCurriculumOptions] = useState<CurriculumOptions>(DEFAULT_CURRICULUM_OPTIONS);
  const [targetDate, setTargetDate] = useState<string>('');
  const [dailyStudyHours, setDailyStudyHours] = useState<number>(8);  // 기본값 (프로필에서 로드 전)
  const [profileStudyHours, setProfileStudyHours] = useState<number>(8);  // 프로필에서 로드된 초기값 (reset용)

  // 사용자 프로필에서 순공시간 로드
  useEffect(() => {
    async function loadUserStudyHours() {
      if (!userId || !supabase) return;

      try {
        logQuery('user_profiles', 'select', 'daily_study_hours');

        const { data, error } = await supabase
          .from('user_profiles')
          .select('daily_study_hours')
          .eq('id', userId)
          .single();

        if (error) {
          logQueryResult('user_profiles', 'select', null, error.message);
          console.log('[useCurriculumGeneration] No profile found, using default');
          return;
        }

        if (data?.daily_study_hours) {
          logQueryResult('user_profiles', 'select', 1);
          setDailyStudyHours(data.daily_study_hours);
          setProfileStudyHours(data.daily_study_hours);  // 초기값 저장
        }
      } catch (err) {
        console.error('[useCurriculumGeneration] Failed to load study hours:', err);
      }
    }

    loadUserStudyHours();
  }, [userId]);
  const [showTimeExceededWarning, setShowTimeExceededWarning] = useState(false);
  const [requiredHoursPerDay, setRequiredHoursPerDay] = useState<number>(0);
  const [generatedQuests, setGeneratedQuests] = useState<CurriculumQuest[]>([]);
  const [questSummary, setQuestSummary] = useState<GenerateQuestsResponse['summary'] | null>(null);
  // 검증 결과 상태
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationError, setShowValidationError] = useState(false);
  // AI 에이전트 리뷰 결과
  const [reviewResult, setReviewResult] = useState<CurriculumReviewResult | null>(null);

  // 강좌 검색 (Supabase 직접 호출 - Railway 부하 감소)
  const [isSearchingCourses, setIsSearchingCourses] = useState(false);
  const [searchErrorState, setSearchErrorState] = useState<Error | null>(null);

  // Race condition 방지를 위한 요청 카운터
  const searchRequestIdRef = useRef(0);

  const searchCoursesDirectly = useCallback(async (params: { query?: string; subject?: string }) => {
    // 새 요청 ID 생성 (이전 요청 무효화)
    const currentRequestId = ++searchRequestIdRef.current;

    setIsSearchingCourses(true);
    setSearchErrorState(null);
    // 즉시 결과 초기화 (이전 결과 제거)
    setSearchResults([]);

    try {
      const searchDetails = params.query
        ? `query="${params.query}"${params.subject ? `, subject=${params.subject}` : ''}`
        : params.subject ? `subject=${params.subject}` : '전체';
      logQuery('courses', 'select', searchDetails);

      // Supabase 사용 가능한 경우 직접 호출 (빠름)
      if (supabase) {
        // 세션 상태 확인 및 갱신 (만료 시 갱신 시도)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('[useCurriculumGeneration] No active session, attempting refresh...');
          const refreshed = await refreshSession(2);
          if (!refreshed) {
            // 세션 갱신 실패 - 사용자에게 재로그인 필요 알림
            throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
          }
        }

        let queryBuilder = supabase
          .from('courses')
          .select('*')
          .order('teacher_name')
          .order('name')
          .limit(50);  // 20 → 50으로 증가

        // 강사명 필터
        if (params.query) {
          queryBuilder = queryBuilder.or(
            `name.ilike.%${params.query}%,teacher_name.ilike.%${params.query}%`
          );
        }

        // 과목 필터
        if (params.subject) {
          queryBuilder = queryBuilder.eq('subject', params.subject);
        }

        const { data, error } = await queryBuilder;

        // Race condition 체크: 이 요청이 가장 최신 요청인지 확인
        if (currentRequestId !== searchRequestIdRef.current) {
          console.log('[useCurriculumGeneration] Ignoring stale response for requestId:', currentRequestId);
          return;
        }

        if (error) {
          logQueryResult('courses', 'select', null, error.message);

          // 세션 관련 에러인 경우 세션 갱신 후 재시도
          const isSessionError = error.message?.includes('JWT') ||
                                  error.message?.includes('token') ||
                                  error.message?.includes('session') ||
                                  error.code === 'PGRST301' || // JWT expired
                                  error.code === '401';

          if (isSessionError) {
            console.log('[useCurriculumGeneration] Session error detected, refreshing and retrying...');
            const refreshed = await refreshSession(2);
            if (refreshed) {
              // 세션 갱신 성공 → 재시도
              const retryResult = await supabase
                .from('courses')
                .select('*')
                .order('teacher_name')
                .order('name')
                .limit(50);

              if (!retryResult.error) {
                // 성공적으로 재시도됨
                const courses: Course[] = (retryResult.data || []).map((course: any) => ({
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
                console.log('[useCurriculumGeneration] Retry successful:', courses.length);
                setSearchResults(courses);
                return;
              }
            }
          }

          throw new Error(error.message);
        }

        // Supabase 응답을 Course 형식으로 변환
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

        logQueryResult('courses', 'select', courses.length);
        setSearchResults(courses);
        return;
      }

      // Supabase 없으면 백엔드 폴백 (로컬 개발 등)
      console.log('[useCurriculumGeneration] Fallback to backend API');
      const res = await fetch(`${API_BASE_URL}/api/curriculum/search-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      // Race condition 체크
      if (currentRequestId !== searchRequestIdRef.current) {
        console.log('[useCurriculumGeneration] Ignoring stale API response for requestId:', currentRequestId);
        return;
      }

      if (!res.ok) throw new Error('강좌 검색 실패');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSearchResults(data.data.courses as Course[]);

    } catch (error) {
      // Race condition 체크: 오류도 최신 요청만 처리
      if (currentRequestId !== searchRequestIdRef.current) {
        return;
      }
      console.error('[useCurriculumGeneration] Search error:', error);
      setSearchErrorState(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      // Race condition 체크: 로딩 상태도 최신 요청만 처리
      if (currentRequestId === searchRequestIdRef.current) {
        setIsSearchingCourses(false);
      }
    }
  }, []);

  // 퀘스트 생성
  const generateMutation = useMutation({
    mutationFn: async () => {
      console.log('[useCurriculumGeneration] Starting quest generation...');
      console.log('[useCurriculumGeneration] API URL:', `${API_BASE_URL}/api/curriculum/generate-quests-ai`);
      console.log('[useCurriculumGeneration] Selected courses:', selectedCourses.length);
      console.log('[useCurriculumGeneration] Target date:', targetDate);
      console.log('[useCurriculumGeneration] Daily study hours:', dailyStudyHours);

      // 기존 플랜의 일별 퀘스트 정보 추출 (가용 시간 계산용)
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

      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/api/curriculum/generate-quests-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedCourseIds: selectedCourses.map(c => c.id),
            courseContents: selectedCourses, // 강좌 정보 직접 전달
            targetDate,
            dailyStudyHours,
            subjectRatio,
            // 새로운 옵션들
            subjectHours,
            subjectDays,
            options: curriculumOptions,
            // 기존 플랜 정보 (가용 시간 계산용)
            existingPlans: existingPlanData,
          }),
        });
      } catch (networkError) {
        console.error('[useCurriculumGeneration] Network error:', networkError);
        throw new Error(`네트워크 오류: 백엔드 서버에 연결할 수 없습니다 (${API_BASE_URL})`);
      }

      // 에러 응답도 JSON으로 파싱 시도 (검증 결과 포함 가능)
      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        // JSON 파싱 실패 시 일반 에러
        if (!res.ok) {
          console.error('[useCurriculumGeneration] API error:', res.status, responseText);
          throw new Error(`퀘스트 생성 실패 (${res.status}): ${responseText}`);
        }
        throw new Error('응답 파싱 실패');
      }

      console.log('[useCurriculumGeneration] API response:', data);

      // 검증 실패로 인한 에러 응답 (400) - validation 정보 포함
      if (!res.ok || !data.success) {
        // 검증 결과가 있는 경우 ValidationError로 처리
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
      // 검증 결과 저장
      setValidationResult(data.validation || null);
      // AI 에이전트 리뷰 결과 저장
      setReviewResult(data.review || null);

      // 검증 실패 시 (INVALID) 에러 표시
      if (data.validation?.severity === 'invalid') {
        console.log('[useCurriculumGeneration] Validation failed:', data.validation);
        setShowValidationError(true);
        setGeneratedQuests([]);
        setQuestSummary(null);
        return;
      }

      // 검증 통과 또는 경고만 있는 경우 정상 처리
      setShowValidationError(false);
      setGeneratedQuests(data.quests);
      setQuestSummary(data.summary);

      // 리뷰 결과 로깅
      if (data.review) {
        console.log('[useCurriculumGeneration] AI Review:', data.review.summary, 'Score:', data.review.overallScore);
      }

      // 일별 최대 시간 초과 여부 체크
      const avgMinutesPerDay = data.summary.averageMinutesPerDay || 0;
      const currentLimitMinutes = dailyStudyHours * 60 * 0.8; // 80% 버퍼 적용

      if (avgMinutesPerDay > currentLimitMinutes) {
        // 필요한 시간 계산 (버퍼 포함)
        const neededHours = Math.ceil(avgMinutesPerDay / 60 / 0.8);
        setRequiredHoursPerDay(Math.min(neededHours, 14)); // 최대 14시간
        setShowTimeExceededWarning(true);
      } else {
        setShowTimeExceededWarning(false);
        setRequiredHoursPerDay(0);
      }
    },
    onError: (error: Error & { validation?: ValidationResult }) => {
      console.error('[useCurriculumGeneration] Mutation error:', error);
      console.error('[useCurriculumGeneration] Error message:', error.message);

      // 검증 에러인 경우 모달로 표시
      if (error.validation) {
        console.log('[useCurriculumGeneration] Validation error detected:', error.validation);
        setValidationResult(error.validation);
        setShowValidationError(true);
        setGeneratedQuests([]);
        setQuestSummary(null);
      }
    },
  });

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

  // 이어듣기: 시작 챕터 설정
  const updateCourseStartChapter = useCallback((courseId: string, chapterIndex: number | undefined) => {
    setSelectedCourses(prev =>
      prev.map(course =>
        course.id === courseId
          ? { ...course, startFromChapter: chapterIndex }
          : course
      )
    );
  }, []);

  // 강좌(lecture)와 복습(review) 퀘스트를 하나로 병합
  const mergeRelatedQuests = useCallback((quests: CurriculumQuest[]): CurriculumQuest[] => {
    const merged: CurriculumQuest[] = [];
    const processedIds = new Set<string>();

    for (const quest of quests) {
      if (processedIds.has(quest.id)) continue;

      // lecture 퀘스트인 경우, 같은 날짜/챕터의 review 퀘스트 찾기
      if (quest.questType === 'lecture') {
        const relatedReview = quests.find(q =>
          q.questType === 'review' &&
          q.scheduledDate === quest.scheduledDate &&
          q.chapter === quest.chapter &&
          q.courseId === quest.courseId &&
          !processedIds.has(q.id)
        );

        if (relatedReview) {
          // 강좌 + 복습 병합
          processedIds.add(quest.id);
          processedIds.add(relatedReview.id);

          merged.push({
            ...quest,
            id: quest.id, // 원본 강좌 ID 유지
            title: `${quest.title} + 복습`,
            description: `${quest.description} | 복습: ${relatedReview.description}`,
            estimatedMinutes: quest.estimatedMinutes + relatedReview.estimatedMinutes,
            questType: 'lecture', // 타입은 lecture로 유지
            studyTips: quest.studyTips ? {
              ...quest.studyTips,
              studyMethod: '인강 시청 + 복습',
            } : undefined,
          });
        } else {
          // 복습이 없는 강좌는 그대로
          processedIds.add(quest.id);
          merged.push(quest);
        }
      } else if (quest.questType === 'review') {
        // 단독 review (이미 병합되지 않은 경우)
        if (!processedIds.has(quest.id)) {
          processedIds.add(quest.id);
          merged.push(quest);
        }
      } else {
        // 다른 타입(problem_set, practice 등)은 그대로
        processedIds.add(quest.id);
        merged.push(quest);
      }
    }

    return merged;
  }, []);

  // 매일 문제풀이(자습) 퀘스트가 있는지 확인하고, 없으면 추가
  const ensureDailyPractice = useCallback((
    quests: CurriculumQuest[],
    subject: string
  ): CurriculumQuest[] => {
    // 날짜별로 그룹화
    const questsByDate = new Map<string, CurriculumQuest[]>();
    for (const quest of quests) {
      const existing = questsByDate.get(quest.scheduledDate) || [];
      questsByDate.set(quest.scheduledDate, [...existing, quest]);
    }

    const result: CurriculumQuest[] = [...quests];

    // 각 날짜에 문제풀이 퀘스트가 있는지 확인
    for (const [date, dayQuests] of questsByDate) {
      const hasPractice = dayQuests.some(q =>
        q.questType === 'practice' || q.questType === 'problem_set'
      );

      if (!hasPractice) {
        // 해당 날짜의 강의 정보를 기반으로 문제풀이 퀘스트 생성
        const lectureQuest = dayQuests.find(q => q.questType === 'lecture');

        result.push({
          id: crypto.randomUUID(),
          title: `📝 ${subject} 자습`,
          description: lectureQuest
            ? `${lectureQuest.chapter} 관련 문제 풀이 및 복습`
            : `${subject} 개념 정리 및 문제 풀이`,
          questType: 'practice',
          subject,
          courseId: lectureQuest?.courseId || '',
          courseName: lectureQuest?.courseName || subject,
          lecturer: lectureQuest?.lecturer || '',
          chapter: lectureQuest?.chapter || '자습',
          section: null,
          scheduledDate: date,
          estimatedMinutes: 0, // 자습은 시간 지정 안함
          status: 'pending',
          priority: 'medium',
          editable: true,
          practiceNote: '', // 사용자가 메모 작성 가능
        });
      }
    }

    // 날짜순 정렬
    return result.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, []);

  // 과목별 퀘스트를 플랜으로 변환
  const convertToQuestPlanForSubject = useCallback((
    subject: string,
    quests: CurriculumQuest[]
  ): Omit<QuestPlan, 'id' | 'createdAt'> => {
    // 해당 과목의 강좌 이름
    const subjectCourses = selectedCourses.filter(c => c.subject === subject);
    const courseNames = subjectCourses.map(c => c.courseName).join(', ');
    const lecturers = [...new Set(subjectCourses.map(c => c.lecturer))].join(', ');

    // 강좌+복습 병합
    const mergedQuests = mergeRelatedQuests(quests);

    // 매일 문제풀이(자습) 퀘스트 보장
    const questsWithPractice = ensureDailyPractice(mergedQuests, subject);

    // 날짜별로 그룹화하여 day 번호 계산
    const dateSet = [...new Set(questsWithPractice.map(q => q.scheduledDate))].sort();
    const dateToDay = new Map(dateSet.map((date, idx) => [date, idx + 1]));

    // questStore의 DailyQuest 형식으로 변환
    const dailyQuests = questsWithPractice.map((quest, idx) => ({
      id: quest.id || crypto.randomUUID(),  // 백엔드 ID 사용 또는 새로 생성
      day: dateToDay.get(quest.scheduledDate) || idx + 1,
      date: quest.scheduledDate,
      unitNumber: idx + 1,
      unitTitle: quest.title,
      range: quest.section || quest.chapter,
      estimatedMinutes: quest.estimatedMinutes,
      completed: false,
      topics: [quest.chapter, quest.section].filter(Boolean) as string[],
      objectives: [quest.description],
      // 백엔드에서 생성한 학습 팁 사용 (없으면 기본값)
      studyTips: quest.studyTips || {
        importance: quest.priority === 'high' ? '중요도 높음' : '일반',
        keyPoints: [`${quest.subject} - ${quest.chapter}`],
        studyMethod: quest.questType === 'lecture' ? '인강 시청' :
                     quest.questType === 'review' ? '복습' : '문제 풀이',
      },
    }));

    const totalMinutes = questsWithPractice.reduce((sum, q) => sum + q.estimatedMinutes, 0);

    return {
      materialName: `📚 ${subject}: ${courseNames.length > 25 ? courseNames.slice(0, 25) + '...' : courseNames}`,
      dailyQuests,
      summary: {
        totalDays: dateSet.length,
        totalUnits: questsWithPractice.length,
        averageMinutesPerDay: Math.round(totalMinutes / Math.max(dateSet.length, 1)),
        totalEstimatedHours: Math.round(totalMinutes / 60),
      },
      aiMessage: `${lecturers || subject} - ${dateSet.length}일간의 학습 계획이 생성되었습니다.`,
    };
  }, [selectedCourses, mergeRelatedQuests, ensureDailyPractice]);

  // 플래너에 추가 (과목별로 분리하여 각각 저장)
  const addToPlannerAndNavigate = useCallback(() => {
    if (generatedQuests.length === 0) {
      console.warn('[useCurriculumGeneration] No quests to add');
      return;
    }

    // 과목별로 퀘스트 그룹화
    const questsBySubject = generatedQuests.reduce((acc, quest) => {
      const subject = quest.subject;
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(quest);
      return acc;
    }, {} as Record<string, CurriculumQuest[]>);

    console.log('[useCurriculumGeneration] Grouped quests by subject:',
      Object.keys(questsBySubject).map(s => `${s}: ${questsBySubject[s].length} quests`));

    // 각 과목별로 별도의 플랜 생성 및 추가
    Object.entries(questsBySubject).forEach(([subject, quests]) => {
      const plan = convertToQuestPlanForSubject(subject, quests);
      console.log(`[useCurriculumGeneration] Adding plan for ${subject}:`, plan.materialName);
      addPlan(plan);
    });

    // 상태 초기화
    setSelectedCourses([]);
    setGeneratedQuests([]);
    setQuestSummary(null);

    // 플래너 페이지로 이동
    navigate('/planner');
  }, [convertToQuestPlanForSubject, addPlan, navigate, generatedQuests]);

  // 문제풀이 퀘스트 메모 업데이트
  const updatePracticeNote = useCallback((questId: string, note: string) => {
    setGeneratedQuests(prev =>
      prev.map(quest =>
        quest.id === questId
          ? { ...quest, practiceNote: note }
          : quest
      )
    );
  }, []);

  // 일일 학습 시간 조정 (10~14시간 범위 제한)
  const adjustDailyStudyHours = useCallback((hours: number) => {
    const bounded = Math.max(10, Math.min(14, hours));
    setDailyStudyHours(bounded);
    setShowTimeExceededWarning(false);
  }, []);

  // 경고 닫기
  const dismissTimeWarning = useCallback(() => {
    setShowTimeExceededWarning(false);
  }, []);

  // 검증 오류 닫기
  const dismissValidationError = useCallback(() => {
    setShowValidationError(false);
  }, []);

  // 초기화
  const reset = useCallback(() => {
    setSearchResults([]);
    setSelectedCourses([]);
    setSubjectRatio(DEFAULT_SUBJECT_RATIO);
    setSubjectHours(DEFAULT_SUBJECT_HOURS);
    setSubjectDays(DEFAULT_SUBJECT_DAYS);
    setCurriculumOptions(DEFAULT_CURRICULUM_OPTIONS);
    setTargetDate('');
    setDailyStudyHours(profileStudyHours);  // 프로필에서 로드된 값으로 리셋
    setShowTimeExceededWarning(false);
    setRequiredHoursPerDay(0);
    setGeneratedQuests([]);
    setQuestSummary(null);
    // 검증 상태 초기화
    setValidationResult(null);
    setShowValidationError(false);
  }, [profileStudyHours]);

  return {
    // 상태
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

    // 시간 초과 경고 상태
    showTimeExceededWarning,
    requiredHoursPerDay,

    // 검증 결과 상태
    validationResult,
    showValidationError,
    // AI 에이전트 리뷰 결과
    reviewResult,

    // 상태 변경
    setSubjectRatio,
    setSubjectHours,
    setSubjectDays,
    setCurriculumOptions,
    setTargetDate,
    setDailyStudyHours,
    selectCourse,
    deselectCourse,
    updateCourseStartChapter,

    // 액션
    searchCourses: searchCoursesDirectly,
    generateQuests: generateMutation.mutate,
    addToPlannerAndNavigate,
    updatePracticeNote,
    adjustDailyStudyHours,
    dismissTimeWarning,
    dismissValidationError,
    reset,

    // 로딩 상태
    isSearching: isSearchingCourses,
    isGenerating: generateMutation.isPending,
    searchError: searchErrorState,
    generateError: generateMutation.error,
  };
}
