/**
 * 커리큘럼 생성 모듈 (LLM 기반)
 * 인강 목차를 분석하여 최적의 학습 스케줄 생성
 *
 * Memory Lane 통합:
 * - 학생의 과거 학습 성과 반영
 * - 개인화된 스케줄링
 * - 학습 패턴 기반 최적화
 */

import { v4 as uuidv4 } from 'uuid';
import { format, addDays, differenceInDays, getDay } from 'date-fns';
import type {
  CurriculumGenerationRequest,
  CurriculumGenerationResult,
  CurriculumQuest,
  CurriculumCourse,
  CurriculumChapter,
} from '../types.js';
import type { MemoryContext, PlanPerformanceMemory } from '../../../../types/memory.js';
import { CURRICULUM_GENERATION_PROMPT } from '../prompts.js';

// 학습 전략 상수
const BUFFER_RATIO = 0.80;
const MAX_LECTURE_RATIO = 0.60;
const MAX_LECTURES_PER_DAY_WARNING = 8;
const MAX_LECTURES_PER_DAY_ERROR = 15;

// OT 강의 판별 키워드
const OT_KEYWORDS = ['OT', '오리엔테이션', 'orientation', '오티', '소개', '커리큘럼 소개', '강좌 소개'];

// 모의고사 날짜 (3모, 6모, 9모) - 연도별 설정
// 수능 당일은 목표일이므로 별도 제외 불필요
const MOCK_EXAM_DATES: Record<number, string[]> = {
  2025: ['2025-03-13', '2025-06-05', '2025-09-03'],  // 2025년 모의고사
  2026: ['2026-03-12', '2026-06-04', '2026-09-02'],  // 2026년 모의고사 (예상)
  2027: ['2027-03-11', '2027-06-03', '2027-09-01'],  // 2027년 모의고사 (예상)
};

/**
 * 모의고사 날짜 목록 가져오기
 */
function getMockExamDates(startDate: Date, endDate: Date): Set<string> {
  const mockExamSet = new Set<string>();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    const dates = MOCK_EXAM_DATES[year];
    if (dates) {
      dates.forEach(date => mockExamSet.add(date));
    }
  }

  return mockExamSet;
}

/**
 * 가용 날짜 목록 계산 (subjectDays 기반)
 * 모든 과목의 요일 union을 사용
 * 모의고사 날짜(3모, 6모, 9모) 자동 제외
 */
function calculateAvailableDates(
  startDate: Date,
  endDate: Date,
  subjectDays?: Record<string, number[]>,
  excludeMockExams: boolean = true  // 기본값: 모의고사 날짜 제외
): string[] {
  const availableDates: string[] = [];

  // 모의고사 날짜 목록 가져오기
  const mockExamDates = excludeMockExams ? getMockExamDates(startDate, endDate) : new Set<string>();

  // 날짜가 제외 대상인지 확인하는 헬퍼 함수
  const isExcludedDate = (dateStr: string): boolean => {
    return mockExamDates.has(dateStr);
  };

  // subjectDays가 없거나 비어있으면 모든 날짜 반환 (모의고사 제외)
  if (!subjectDays || Object.keys(subjectDays).length === 0) {
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = format(current, 'yyyy-MM-dd');
      if (!isExcludedDate(dateStr)) {
        availableDates.push(dateStr);
      }
      current = addDays(current, 1);
    }
    return availableDates;
  }

  // 모든 과목의 허용 요일 union 계산
  const allowedDaysSet = new Set<number>();
  for (const days of Object.values(subjectDays)) {
    if (days && days.length > 0 && days.length < 7) {
      // 제한이 있는 경우만 추가
      days.forEach(d => allowedDaysSet.add(d));
    }
  }

  // 모든 과목이 모든 요일을 허용하면 전체 날짜 반환 (모의고사 제외)
  if (allowedDaysSet.size === 0) {
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = format(current, 'yyyy-MM-dd');
      if (!isExcludedDate(dateStr)) {
        availableDates.push(dateStr);
      }
      current = addDays(current, 1);
    }
    return availableDates;
  }

  // 허용된 요일만 필터링 (모의고사 제외)
  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const dayOfWeek = getDay(current);
    if (allowedDaysSet.has(dayOfWeek) && !isExcludedDate(dateStr)) {
      availableDates.push(dateStr);
    }
    current = addDays(current, 1);
  }

  return availableDates;
}

interface LLMScheduleResponse {
  schedule: Array<{
    date: string;
    dayOfWeek: number;
    quests: Array<{
      courseId: string;
      courseName: string;
      lecturer?: string;
      subject: string;
      chapter: string;
      chapterIndex: number;
      estimatedMinutes: number;
      questType: string;
      tip?: string;
    }>;
    totalMinutes: number;
    note?: string;
  }>;
  summary: {
    totalDays: number;
    totalLectures: number;
    averageMinutesPerDay: number;
    lecturesPerDay: number;
  };
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  message: string;
}

/**
 * LLM 기반 커리큘럼 생성
 */
export async function generateCurriculumWithAI(
  request: CurriculumGenerationRequest,
  memoryContext: MemoryContext | null,
  pastPerformance: PlanPerformanceMemory[],
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<CurriculumGenerationResult> {
  const { courses, targetDate, dailyStudyHours, subjectHours, subjectDays, options } = request;

  // 유효성 검사
  if (!courses || courses.length === 0) {
    return createErrorResult('선택된 강좌가 없습니다.');
  }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  const totalCalendarDays = differenceInDays(endDate, startDate);

  if (totalCalendarDays <= 0) {
    return createErrorResult('목표일은 오늘 이후여야 합니다.');
  }

  // ⭐ 가용 날짜 계산 (subjectDays 기반 - 선택된 요일만)
  const availableDates = calculateAvailableDates(startDate, endDate, subjectDays);
  const effectiveDays = availableDates.length;

  console.log(`[CurriculumGenerator] Available dates: ${effectiveDays} days out of ${totalCalendarDays} calendar days`);
  console.log(`[CurriculumGenerator] Date range: ${availableDates[0]} ~ ${availableDates[availableDates.length - 1]}`);

  if (effectiveDays === 0) {
    return createErrorResult('선택한 요일에 해당하는 날짜가 없습니다. 요일 설정을 확인해주세요.');
  }

  // 강의 목록 추출
  const lectures = extractLectures(courses, options?.includeOt ?? false);

  if (lectures.length === 0) {
    return createErrorResult('강의 목록이 비어있습니다.');
  }

  // 개인화 정보 빌드
  const personalizationInfo = buildPersonalizationInfo(memoryContext, pastPerformance);

  // 디버그: 요일 제약 로그
  if (subjectDays) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    console.log('[CurriculumGenerator] Subject days constraints:');
    for (const [subject, days] of Object.entries(subjectDays)) {
      const dayStr = days?.length > 0 && days.length < 7 ? days.map(d => dayNames[d]).join(', ') : '모든 요일';
      console.log(`  - ${subject}: ${dayStr}`);
    }
  }

  // LLM 호출을 위한 프롬프트 구성 (가용 일수만 전달, 요일 정보 제거)
  const userPrompt = buildCurriculumPrompt(
    courses,
    lectures,
    targetDate,
    effectiveDays,  // 가용 일수만 전달
    dailyStudyHours,
    subjectHours,
    undefined,  // subjectDays 제거 - 더 이상 LLM에 전달하지 않음
    personalizationInfo
  );

  try {
    // LLM 호출
    const response = await generateResponse(
      CURRICULUM_GENERATION_PROMPT,
      userPrompt,
      { model: 'gpt-5-nano', temperature: 0.3, maxTokens: 16384 }
    );

    // JSON 파싱
    const llmResult = parseLLMResponse(response);

    if (!llmResult) {
      console.warn('[CurriculumGenerator] LLM 응답 파싱 실패, 폴백으로 전환');
      return generateFallbackCurriculum(request, lectures, totalDays, startDate);
    }

    // 검증 (요일/시간 제약 포함)
    const validation = validateLLMSchedule(llmResult, lectures.length, dailyStudyHours, subjectHours, subjectDays);

    console.log('[CurriculumGenerator] Validation result:', {
      severity: validation.severity,
      issues: validation.issues.length,
      dayViolations: validation.issues.filter(i => i.code === 'SUBJECT_DAY_VIOLATION').length,
    });

    if (validation.severity === 'invalid') {
      console.warn('[CurriculumGenerator] LLM 결과 검증 실패, 폴백으로 전환:', validation.issues.map(i => i.message).join(', '));
      return generateFallbackCurriculum(request, lectures, totalCalendarDays, startDate, availableDates);
    }

    // Quest 객체로 변환 (⭐ 가용 날짜로 재매핑)
    const quests = convertToQuests(llmResult, courses, options, availableDates);

    // 요약 생성
    const summary = generateSummary(quests, effectiveDays);

    return {
      success: true,
      quests,
      summary,
      validation: validation.issues.length > 0 ? validation : undefined,
      message: llmResult.message || '학습 커리큘럼이 생성되었습니다.',
    };
  } catch (error) {
    console.error('[CurriculumGenerator] LLM 기반 생성 실패:', error);
    return generateFallbackCurriculum(request, lectures, totalCalendarDays, startDate, availableDates);
  }
}

/**
 * 강의 목록 추출
 */
function extractLectures(
  courses: CurriculumCourse[],
  includeOt: boolean
): Array<{
  courseId: string;
  courseName: string;
  lecturer: string;
  subject: string;
  chapter: CurriculumChapter;
  chapterIndex: number;
  totalChapters: number;
}> {
  const lectures: Array<{
    courseId: string;
    courseName: string;
    lecturer: string;
    subject: string;
    chapter: CurriculumChapter;
    chapterIndex: number;
    totalChapters: number;
  }> = [];

  for (const course of courses) {
    const chapters = course.chapters || [];
    const startFrom = course.startFromChapter ?? 0;

    for (let i = startFrom; i < chapters.length; i++) {
      const chapter = chapters[i];
      const title = chapter.title || `강의 ${i + 1}`;

      // OT 강의 필터링
      if (!includeOt && isOtLecture(title)) {
        continue;
      }

      lectures.push({
        courseId: course.id,
        courseName: course.courseName,
        lecturer: course.lecturer || '',
        subject: course.subject,
        chapter,
        chapterIndex: i + 1,
        totalChapters: chapters.length,
      });
    }
  }

  return lectures;
}

/**
 * OT 강의 여부 판별
 */
function isOtLecture(title: string): boolean {
  const titleLower = title.toLowerCase();
  return OT_KEYWORDS.some(kw => titleLower.includes(kw.toLowerCase()));
}

/**
 * 강의 시간 파싱 (분 단위)
 */
function parseDuration(durationStr?: string): number {
  if (!durationStr) return 45;

  const parts = durationStr.trim().split(':');
  try {
    if (parts.length === 2) {
      // MM:SS
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return Math.max(5, Math.min(180, minutes + (seconds >= 30 ? 1 : 0)));
    } else if (parts.length === 3) {
      // H:MM:SS
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      return Math.max(5, Math.min(180, hours * 60 + minutes + (seconds >= 30 ? 1 : 0)));
    }
  } catch {
    // 파싱 실패
  }
  return 45;
}

/**
 * 개인화 정보 빌드
 */
function buildPersonalizationInfo(
  memoryContext: MemoryContext | null,
  pastPerformance: PlanPerformanceMemory[]
): string {
  if (!pastPerformance || pastPerformance.length === 0) {
    return '';
  }

  const avgCompletion = pastPerformance.reduce((sum, p) => sum + p.completionRate, 0) / pastPerformance.length;
  const dropOffDays = pastPerformance
    .filter(p => p.dropOffDay)
    .map(p => p.dropOffDay as number);
  const avgStudyTime = pastPerformance.reduce((sum, p) => sum + p.averageStudyTime, 0) / pastPerformance.length;

  let info = `\n## 학생 개인화 정보 (과거 성과 기반)\n`;
  info += `- 평균 플랜 완료율: ${(avgCompletion * 100).toFixed(1)}%\n`;

  if (dropOffDays.length > 0) {
    const avgDropOff = dropOffDays.reduce((a, b) => a + b, 0) / dropOffDays.length;
    info += `- 평균 이탈 시점: ${avgDropOff.toFixed(0)}일차 (이 시점에 휴식/복습일 배치 권장)\n`;
  }

  if (avgStudyTime > 0) {
    info += `- 실제 평균 학습 시간: ${avgStudyTime.toFixed(0)}분/일\n`;
  }

  // 숙달도 정보 추가
  if (memoryContext?.masteryInfo && memoryContext.masteryInfo.length > 0) {
    const weakSubjects = memoryContext.masteryInfo
      .filter(m => m.masteryScore < 5)
      .map(m => m.subject);

    if (weakSubjects.length > 0) {
      info += `- 보강 필요 과목: ${[...new Set(weakSubjects)].join(', ')}\n`;
    }
  }

  return info;
}

/**
 * LLM 프롬프트 구성
 */
function buildCurriculumPrompt(
  courses: CurriculumCourse[],
  lectures: ReturnType<typeof extractLectures>,
  targetDate: string,
  totalDays: number,
  dailyStudyHours: number,
  subjectHours?: Record<string, number | null>,
  subjectDays?: Record<string, number[]>,
  personalizationInfo?: string
): string {
  const today = format(new Date(), 'yyyy-MM-dd');

  let prompt = `## 커리큘럼 생성 요청

### 기본 정보
- 오늘 날짜: ${today}
- 목표 완료일: ${targetDate}
- 총 학습 기간: ${totalDays}일
- 일일 학습 시간: ${dailyStudyHours}시간 (${dailyStudyHours * 60}분)

### 강좌 목록
`;

  for (const course of courses) {
    const chapters = course.chapters || [];
    const startFrom = course.startFromChapter ?? 0;
    const totalLectures = chapters.length - startFrom;
    const totalMinutes = chapters
      .slice(startFrom)
      .reduce((sum, ch) => sum + parseDuration(ch.duration), 0);

    prompt += `\n#### ${course.courseName} (${course.lecturer || '강사 미상'})
- 과목: ${course.subject}
- 총 강의: ${totalLectures}개
- 총 시간: ${Math.round(totalMinutes / 60 * 10) / 10}시간
${startFrom > 0 ? `- 이어듣기: ${startFrom + 1}강부터 시작\n` : ''}`;
  }

  // 과목별 학습 시간 설정
  if (subjectHours && Object.values(subjectHours).some(v => v !== null && v > 0)) {
    prompt += `\n### 과목별 일일 학습 시간 설정\n`;
    for (const [subject, hours] of Object.entries(subjectHours)) {
      if (hours !== null && hours > 0) {
        prompt += `- ${subject}: ${hours}시간/일\n`;
      }
    }
  }

  // 과목별 학습 요일 설정
  if (subjectDays && Object.keys(subjectDays).length > 0) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    prompt += `\n### 과목별 학습 요일 설정 (중요!)\n`;
    for (const [subject, days] of Object.entries(subjectDays)) {
      if (days && days.length > 0) {
        const dayStr = days.map(d => dayNames[d]).join(', ');
        prompt += `- ${subject}: ${dayStr}요일에만 배치\n`;
      }
    }
    prompt += `\n⚠️ 위 요일 설정을 반드시 준수하세요. 해당 과목은 지정된 요일에만 강의를 배치해야 합니다.\n`;
  }

  // 강의 상세 목록
  prompt += `\n### 배치할 강의 목록 (총 ${lectures.length}개)\n`;

  let currentCourseId = '';
  for (const lec of lectures) {
    if (lec.courseId !== currentCourseId) {
      prompt += `\n**${lec.courseName}**\n`;
      currentCourseId = lec.courseId;
    }
    const duration = parseDuration(lec.chapter.duration);
    prompt += `- ${lec.chapterIndex}강: ${lec.chapter.title} (${duration}분)\n`;
  }

  // 개인화 정보
  if (personalizationInfo) {
    prompt += personalizationInfo;
  }

  prompt += `\n### 생성 규칙
1. 모든 강의를 ${targetDate}까지 배치하세요
2. 같은 강좌의 강의는 순서대로 배치하세요 (1강→2강→3강...)
3. 과목별 학습 요일이 설정된 경우 반드시 해당 요일에만 배치하세요
4. 하루 최대 ${MAX_LECTURES_PER_DAY_WARNING}개 이하로 강의를 배치하세요
5. 강의가 일찍 끝나면 남은 날은 복습일로 비워두세요

JSON 형식으로만 응답하세요.`;

  return prompt;
}

/**
 * LLM 응답 파싱
 */
function parseLLMResponse(response: string): LLMScheduleResponse | null {
  try {
    // JSON 블록 추출
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 필수 필드 검증
    if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
      return null;
    }

    return parsed as LLMScheduleResponse;
  } catch (error) {
    console.error('[CurriculumGenerator] JSON 파싱 오류:', error);
    return null;
  }
}

/**
 * LLM 스케줄 검증 (요일/시간 제약 포함)
 */
function validateLLMSchedule(
  llmResult: LLMScheduleResponse,
  totalLectures: number,
  dailyStudyHours: number,
  subjectHours?: Record<string, number | null>,
  subjectDays?: Record<string, number[]>
): CurriculumGenerationResult['validation'] & { severity: 'valid' | 'warning' | 'invalid' } {
  const issues: Array<{ severity: 'valid' | 'warning' | 'invalid'; code: string; message: string }> = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // 요일 이름 맵핑
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 배치된 총 강의 수 확인
  let placedLectures = 0;
  let maxLecturesInDay = 0;
  let maxMinutesInDay = 0;

  for (const day of llmResult.schedule) {
    const lectureCount = day.quests.filter(q => q.questType === 'lecture').length;
    placedLectures += lectureCount;

    if (lectureCount > maxLecturesInDay) {
      maxLecturesInDay = lectureCount;
    }

    if (day.totalMinutes > maxMinutesInDay) {
      maxMinutesInDay = day.totalMinutes;
    }

    // 하루 강의 수 체크
    if (lectureCount > MAX_LECTURES_PER_DAY_ERROR) {
      issues.push({
        severity: 'invalid',
        code: 'EXCESSIVE_DAILY_LECTURES',
        message: `${day.date}에 강의 ${lectureCount}개 배치됨 (최대 ${MAX_LECTURES_PER_DAY_ERROR}개)`,
      });
      errors.push(`${day.date}: 강의 ${lectureCount}개 초과`);
    } else if (lectureCount > MAX_LECTURES_PER_DAY_WARNING) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_DAILY_LECTURES',
        message: `${day.date}에 강의 ${lectureCount}개 배치됨 (권장 ${MAX_LECTURES_PER_DAY_WARNING}개 이하)`,
      });
      warnings.push(`${day.date}: 강의 ${lectureCount}개 (많음)`);
    }

    // 일일 학습 시간 체크
    const maxDailyMinutes = dailyStudyHours * 60;
    if (day.totalMinutes > maxDailyMinutes * 2) {
      issues.push({
        severity: 'invalid',
        code: 'EXCESSIVE_DAILY_TIME',
        message: `${day.date}에 ${day.totalMinutes}분 배치됨 (최대 ${maxDailyMinutes * 2}분)`,
      });
      errors.push(`${day.date}: ${day.totalMinutes}분 초과`);
    }

    // ⭐ 과목별 요일 제약 검증
    if (subjectDays && Object.keys(subjectDays).length > 0) {
      // LLM이 반환한 dayOfWeek를 신뢰하지 않고 날짜에서 직접 계산
      const dateObj = new Date(day.date);
      const dayOfWeek = getDay(dateObj);

      for (const quest of day.quests) {
        if (quest.questType !== 'lecture') continue;

        const allowedDays = subjectDays[quest.subject];
        // 모든 요일이 선택된 경우([0,1,2,3,4,5,6]) 제약 없음으로 처리
        const hasRestriction = allowedDays && allowedDays.length > 0 && allowedDays.length < 7;

        if (hasRestriction && !allowedDays.includes(dayOfWeek)) {
          issues.push({
            severity: 'invalid',
            code: 'SUBJECT_DAY_VIOLATION',
            message: `${quest.subject} 과목이 ${day.date}(${dayNames[dayOfWeek]})에 배치됨 - 허용 요일: ${allowedDays.map(d => dayNames[d]).join(', ')}`,
          });
          errors.push(`${quest.subject}: 요일 제약 위반`);
        }
      }
    }

    // ⭐ 과목별 일일 시간 제약 검증
    if (subjectHours && Object.keys(subjectHours).length > 0) {
      const subjectMinutesToday: Record<string, number> = {};

      for (const quest of day.quests) {
        if (quest.questType !== 'lecture') continue;

        subjectMinutesToday[quest.subject] = (subjectMinutesToday[quest.subject] || 0) + quest.estimatedMinutes;
      }

      for (const [subject, minutes] of Object.entries(subjectMinutesToday)) {
        const maxHours = subjectHours[subject];
        if (maxHours !== null && maxHours !== undefined && maxHours > 0) {
          const maxMinutes = maxHours * 60;
          if (minutes > maxMinutes * 1.5) { // 50% 초과 시 에러
            issues.push({
              severity: 'invalid',
              code: 'SUBJECT_TIME_VIOLATION',
              message: `${subject} 과목이 ${day.date}에 ${minutes}분 배치됨 - 최대 ${maxMinutes}분`,
            });
            errors.push(`${subject}: 시간 제약 위반 (${minutes}분 > ${maxMinutes}분)`);
          }
        }
      }
    }
  }

  // 전체 강의 배치 확인 (미배치는 무조건 실패)
  if (placedLectures < totalLectures) {
    issues.push({
      severity: 'invalid',
      code: 'INCOMPLETE_PLACEMENT',
      message: `${totalLectures}개 중 ${placedLectures}개만 배치됨 - 모든 강의 배치 필수`,
    });
    errors.push(`강의 ${totalLectures - placedLectures}개 미배치 - 목표일 연장 필요`);
  }

  // 심각도 결정
  let severity: 'valid' | 'warning' | 'invalid' = 'valid';
  if (errors.length > 0) {
    severity = 'invalid';
  } else if (warnings.length > 0) {
    severity = 'warning';
  }

  return {
    isValid: severity !== 'invalid',
    severity,
    issues,
    suggestions: generateSuggestions(issues, llmResult.schedule.length, dailyStudyHours),
  };
}

/**
 * 개선 제안 생성
 */
function generateSuggestions(
  issues: Array<{ severity: string; code: string; message: string }>,
  totalDays: number,
  dailyStudyHours: number
): string[] {
  const suggestions: string[] = [];

  for (const issue of issues) {
    if (issue.code === 'EXCESSIVE_DAILY_LECTURES') {
      suggestions.push('목표일을 더 늘려서 일별 강의 수를 줄여보세요.');
    } else if (issue.code === 'EXCESSIVE_DAILY_TIME') {
      suggestions.push('일일 학습 시간을 늘리거나 목표일을 연장해보세요.');
    } else if (issue.code === 'INCOMPLETE_PLACEMENT') {
      suggestions.push('일부 강의가 배치되지 않았습니다. 목표일을 연장하거나 학습 시간을 늘려보세요.');
    }
  }

  return [...new Set(suggestions)];
}

/**
 * Quest 객체로 변환 (가용 날짜에 재매핑)
 * @param availableDates - 실제 가용 날짜 목록 (월, 수, 금 등 선택된 요일만)
 */
function convertToQuests(
  llmResult: LLMScheduleResponse,
  courses: CurriculumCourse[],
  options: CurriculumGenerationRequest['options'] | undefined,
  availableDates: string[]  // ⭐ 가용 날짜 목록 추가
): CurriculumQuest[] {
  const quests: CurriculumQuest[] = [];

  // ⭐ LLM 결과의 각 day를 가용 날짜에 순차 매핑
  for (let dayIndex = 0; dayIndex < llmResult.schedule.length; dayIndex++) {
    const day = llmResult.schedule[dayIndex];

    // LLM이 생성한 날짜 대신 가용 날짜 사용
    const actualDate = availableDates[dayIndex] || day.date;

    for (const quest of day.quests) {
      const course = courses.find(c => c.id === quest.courseId);

      quests.push({
        id: uuidv4(),
        title: `[${quest.subject}] ${quest.chapter}`,
        description: quest.lecturer
          ? `${quest.lecturer} 선생님의 ${quest.courseName} 강의를 시청하세요.`
          : `${quest.courseName} 강의를 시청하세요.`,
        questType: (quest.questType as CurriculumQuest['questType']) || 'lecture',
        subject: quest.subject,
        courseId: quest.courseId,
        courseName: quest.courseName,
        lecturer: quest.lecturer,
        chapter: quest.chapter,
        section: null,
        scheduledDate: actualDate,  // ⭐ 가용 날짜로 재매핑
        estimatedMinutes: quest.estimatedMinutes,
        status: 'pending',
        priority: quest.chapterIndex === 1 ? 'high' : 'medium',
        studyTips: quest.tip
          ? {
              importance: '일반',
              keyPoints: [quest.tip],
              studyMethod: '인강 시청',
            }
          : undefined,
      });
    }

    // 문제풀이 퀘스트 추가 (강의가 있는 날에 필수)
    const lectureQuests = day.quests.filter(q => q.questType === 'lecture');
    if (lectureQuests.length > 0) {
      const lectureSubjects = [...new Set(lectureQuests.map(q => q.subject))];

      for (const subject of lectureSubjects) {
        const subjectLectures = lectureQuests.filter(q => q.subject === subject);

        quests.push({
          id: uuidv4(),
          title: `[${subject}] 문제풀이`,
          description: `오늘 학습한 ${subject} 내용을 문제로 확인하세요.`,
          questType: 'practice',
          subject,
          courseId: subjectLectures[0]?.courseId || '',
          courseName: subjectLectures[0]?.courseName || '',
          lecturer: subjectLectures[0]?.lecturer,
          chapter: '문제풀이',
          section: null,
          scheduledDate: actualDate,  // ⭐ 가용 날짜로 재매핑
          estimatedMinutes: 30,
          status: 'pending',
          priority: 'medium',
          studyTips: {
            importance: '확인 학습',
            keyPoints: ['오늘 배운 내용 문제 풀기', '틀린 문제 복습'],
            studyMethod: '문제 풀이',
          },
        });
      }
    }

    // 복습 퀘스트 추가 (옵션 활성화 시)
    if (options?.reviewSettings?.enabled && lectureQuests.length > 0) {
      const lectureSubjects = [...new Set(lectureQuests.map(q => q.subject))];

      for (const subject of lectureSubjects) {
        const reviewDuration = options.reviewSettings.reviewDuration || 15;
        const subjectLectures = lectureQuests.filter(q => q.subject === subject);

        quests.push({
          id: uuidv4(),
          title: `[${subject}] 복습`,
          description: `오늘 학습한 ${subject} 내용을 복습하세요.`,
          questType: 'review',
          subject,
          courseId: subjectLectures[0]?.courseId || '',
          courseName: subjectLectures[0]?.courseName || '',
          lecturer: subjectLectures[0]?.lecturer,
          chapter: '복습',
          section: null,
          scheduledDate: actualDate,  // ⭐ 가용 날짜로 재매핑
          estimatedMinutes: reviewDuration,
          status: 'pending',
          priority: 'medium',
          studyTips: {
            importance: '복습',
            keyPoints: ['오늘 배운 내용 정리', '이해 안 되는 부분 체크', '핵심 개념 요약'],
            studyMethod: '복습',
          },
        });
      }
    }
  }

  return quests;
}

/**
 * 요약 생성
 */
function generateSummary(
  quests: CurriculumQuest[],
  totalDays: number
): CurriculumGenerationResult['summary'] {
  const lectureQuests = quests.filter(q => q.questType === 'lecture');
  const totalMinutes = quests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

  const subjectDistribution: Record<string, number> = {};
  for (const quest of lectureQuests) {
    subjectDistribution[quest.subject] = (subjectDistribution[quest.subject] || 0) + 1;
  }

  const uniqueDates = new Set(quests.map(q => q.scheduledDate));

  return {
    totalQuests: quests.length,
    totalDays: uniqueDates.size,
    averageMinutesPerDay: uniqueDates.size > 0 ? Math.round(totalMinutes / uniqueDates.size) : 0,
    subjectDistribution,
  };
}

/**
 * 폴백 커리큘럼 생성 (LLM 실패 시)
 * ⭐ 가용 날짜 기반: 선택된 요일의 날짜에만 강의 배치
 */
function generateFallbackCurriculum(
  request: CurriculumGenerationRequest,
  lectures: ReturnType<typeof extractLectures>,
  totalCalendarDays: number,
  startDate: Date,
  availableDates: string[]  // ⭐ 가용 날짜 목록 (이미 계산됨)
): CurriculumGenerationResult {
  const { dailyStudyHours, subjectHours, subjectDays, options } = request;
  const quests: CurriculumQuest[] = [];

  // 가용 날짜가 없으면 에러
  if (availableDates.length === 0) {
    return {
      success: false,
      quests: [],
      summary: {
        totalQuests: 0,
        totalDays: 0,
        averageMinutesPerDay: 0,
        subjectDistribution: {},
      },
      validation: {
        isValid: false,
        severity: 'invalid',
        issues: [{
          severity: 'invalid',
          code: 'NO_AVAILABLE_DAYS',
          message: '선택한 요일에 해당하는 날짜가 없습니다. 요일 설정을 확인해주세요.',
        }],
        suggestions: ['학습 요일을 최소 1개 이상 선택해주세요.'],
      },
      message: '선택한 요일에 해당하는 날짜가 없습니다.',
    };
  }

  console.log(`[FallbackCurriculum] Using ${availableDates.length} available dates`);

  // 일별 시간 계산
  const dailyMinutes = dailyStudyHours * 60 * BUFFER_RATIO;
  const maxLectureMinutes = dailyMinutes * MAX_LECTURE_RATIO;

  // 과목별 일일 최대 강의 시간 (분) 계산
  const subjectMaxMinutesPerDay: Map<string, number> = new Map();
  if (subjectHours) {
    for (const [subject, hours] of Object.entries(subjectHours)) {
      if (hours !== null && hours > 0) {
        // 과목별 시간의 60%만 강의에 사용 (나머지는 복습/문제풀이)
        subjectMaxMinutesPerDay.set(subject, hours * 60 * MAX_LECTURE_RATIO);
      }
    }
  }

  // 과목별 강의 큐 생성 (강좌 순서 유지)
  const lectureQueues: Map<string, typeof lectures> = new Map();
  for (const lec of lectures) {
    const queue = lectureQueues.get(lec.subject) || [];
    queue.push(lec);
    lectureQueues.set(lec.subject, queue);
  }

  // 모든 강의가 배치될 때까지 반복
  let totalPlaced = 0;
  const totalToPlace = lectures.length;
  const effectiveDays = availableDates.length;

  // availableDates를 직접 순회 (이미 선택된 요일만 포함됨)
  for (let dayIndex = 0; dayIndex < effectiveDays && totalPlaced < totalToPlace; dayIndex++) {
    const dateStr = availableDates[dayIndex];
    const dayOfWeek = getDay(new Date(dateStr));

    let dayMinutes = 0;
    let dayLectures = 0;
    const lecturesPerDay = Math.ceil((totalToPlace - totalPlaced) / (effectiveDays - dayIndex));

    // 과목별 오늘 사용한 시간 추적
    const subjectTodayMinutes: Map<string, number> = new Map();

    // 오늘 배치 가능한 과목 확인 (availableDates는 이미 필터링됨, 하지만 과목별 추가 제약 확인)
    const allowedSubjects = Array.from(lectureQueues.keys()).filter(subject => {
      // 요일 설정이 없으면 모든 날 가능
      if (!subjectDays?.[subject] || subjectDays[subject].length === 0 || subjectDays[subject].length === 7) {
        return true;
      }
      // 설정된 요일에만 배치 (과목별 추가 제약)
      return subjectDays[subject].includes(dayOfWeek);
    });

    // 오늘 배치 가능한 과목 없으면 다음 날로 (과목별 요일 제약)
    if (allowedSubjects.length === 0) {
      continue;
    }

    // 각 과목에서 라운드로빈 방식으로 강의 배치
    let placedThisRound = true;
    while (
      placedThisRound &&
      dayLectures < lecturesPerDay &&
      dayMinutes < maxLectureMinutes
    ) {
      placedThisRound = false;

      for (const subject of allowedSubjects) {
        const queue = lectureQueues.get(subject);
        if (!queue || queue.length === 0) continue;
        if (dayLectures >= lecturesPerDay || dayMinutes >= maxLectureMinutes) break;

        // 과목별 일일 시간 제한 체크
        const subjectMaxMinutes = subjectMaxMinutesPerDay.get(subject);
        const subjectUsedMinutes = subjectTodayMinutes.get(subject) || 0;
        if (subjectMaxMinutes !== undefined && subjectUsedMinutes >= subjectMaxMinutes) {
          continue; // 이 과목은 오늘 시간 초과, 다음 과목으로
        }

        const lec = queue[0]; // peek first
        const duration = parseDuration(lec.chapter.duration);

        // 이 강의를 추가하면 과목별 시간 초과하는지 체크
        if (subjectMaxMinutes !== undefined && subjectUsedMinutes + duration > subjectMaxMinutes) {
          continue; // 시간 초과 예상, 다음 과목으로
        }

        // 강의 배치
        queue.shift();

        quests.push({
          id: uuidv4(),
          title: `[${lec.subject}] ${lec.chapter.title}`,
          description: lec.lecturer
            ? `${lec.lecturer} 선생님의 ${lec.courseName} 강의를 시청하세요.`
            : `${lec.courseName} 강의를 시청하세요.`,
          questType: 'lecture',
          subject: lec.subject,
          courseId: lec.courseId,
          courseName: lec.courseName,
          lecturer: lec.lecturer,
          chapter: lec.chapter.title,
          section: null,
          scheduledDate: dateStr,
          estimatedMinutes: duration,
          originalDuration: lec.chapter.duration,
          status: 'pending',
          priority: lec.chapterIndex === 1 ? 'high' : 'medium',
        });

        dayMinutes += duration;
        dayLectures++;
        totalPlaced++;
        placedThisRound = true;

        // 과목별 오늘 사용 시간 업데이트
        subjectTodayMinutes.set(lec.subject, (subjectTodayMinutes.get(lec.subject) || 0) + duration);
      }
    }

    // 문제풀이 퀘스트 추가 (강의가 있는 날에 필수)
    if (dayLectures > 0) {
      const todaySubjects = [...new Set(quests.filter(q => q.scheduledDate === dateStr).map(q => q.subject))];

      for (const subject of todaySubjects) {
        const subjectLectures = quests.filter(q => q.scheduledDate === dateStr && q.subject === subject && q.questType === 'lecture');

        quests.push({
          id: uuidv4(),
          title: `[${subject}] 문제풀이`,
          description: `오늘 학습한 ${subject} 내용을 문제로 확인하세요.`,
          questType: 'practice',
          subject,
          courseId: subjectLectures[0]?.courseId || '',
          courseName: subjectLectures[0]?.courseName || '',
          lecturer: subjectLectures[0]?.lecturer,
          chapter: '문제풀이',
          section: null,
          scheduledDate: dateStr,
          estimatedMinutes: 30,
          status: 'pending',
          priority: 'medium',
          studyTips: {
            importance: '확인 학습',
            keyPoints: ['오늘 배운 내용 문제 풀기', '틀린 문제 복습'],
            studyMethod: '문제 풀이',
          },
        });
      }
    }

    // 복습 퀘스트 추가
    if (options?.reviewSettings?.enabled && dayLectures > 0) {
      const reviewDuration = options.reviewSettings.reviewDuration || 15;
      const subjects = [...new Set(quests.filter(q => q.scheduledDate === dateStr && q.questType === 'lecture').map(q => q.subject))];

      for (const subject of subjects) {
        quests.push({
          id: uuidv4(),
          title: `[${subject}] 복습`,
          description: `오늘 학습한 ${subject} 내용을 복습하세요.`,
          questType: 'review',
          subject,
          courseId: '',
          courseName: '',
          chapter: '복습',
          section: null,
          scheduledDate: dateStr,
          estimatedMinutes: reviewDuration,
          status: 'pending',
          priority: 'medium',
        });
      }
    }
  }

  // 미배치 강의 확인
  const remainingLectures = Array.from(lectureQueues.values()).flat();
  if (remainingLectures.length > 0) {
    console.warn(`[CurriculumGenerator] ${remainingLectures.length}개 강의 미배치 - 목표일 연장 필요`);
    return {
      success: false,
      quests: [],
      summary: {
        totalQuests: 0,
        totalDays: 0,
        averageMinutesPerDay: 0,
        subjectDistribution: {},
      },
      validation: {
        isValid: false,
        severity: 'invalid',
        issues: [{
          severity: 'invalid',
          code: 'INCOMPLETE_PLACEMENT',
          message: `${totalToPlace}개 중 ${totalPlaced}개만 배치 가능 (${remainingLectures.length}개 미배치)`,
        }],
        suggestions: [
          '목표일을 연장해주세요.',
          `최소 ${Math.ceil(remainingLectures.length / 3)}일 추가 권장`,
        ],
      },
      message: `강의를 모두 배치할 수 없습니다. 목표일을 연장해주세요. (${remainingLectures.length}개 미배치)`,
    };
  }

  // A2 시나리오: 남는 날 활용 (강의가 일찍 끝난 경우)
  const extraDaysOption = options?.extraDaysOption;
  if (extraDaysOption?.enabled !== false) {
    const fillWithReview = extraDaysOption?.fillWithReview ?? true;
    const fillWithPractice = extraDaysOption?.fillWithPractice ?? true;

    if (fillWithReview || fillWithPractice) {
      // 이미 퀘스트가 있는 날짜들
      const daysWithQuests = new Set(quests.map(q => q.scheduledDate));
      // 학습한 과목 목록
      const studiedSubjects = [...new Set(quests.filter(q => q.questType === 'lecture').map(q => q.subject))];

      if (studiedSubjects.length > 0) {
        // 남은 날들에 복습/문제풀이 퀘스트 추가 (availableDates 사용)
        for (const dateStr of availableDates) {
          // 이미 퀘스트가 있는 날은 건너뜀
          if (daysWithQuests.has(dateStr)) continue;

          const dayOfWeek = getDay(new Date(dateStr));

          // 이 날에 학습 가능한 과목 확인 (요일 설정 준수)
          const allowedSubjectsForDay = studiedSubjects.filter(subject => {
            if (!subjectDays?.[subject] || subjectDays[subject].length === 0 || subjectDays[subject].length === 7) return true;
            return subjectDays[subject].includes(dayOfWeek);
          });

          if (allowedSubjectsForDay.length === 0) continue;

          // 각 과목에 대해 복습/문제풀이 추가
          for (const subject of allowedSubjectsForDay) {
            // 해당 과목의 강의 정보 찾기
            const subjectLectures = quests.filter(q => q.subject === subject && q.questType === 'lecture');
            const courseInfo = subjectLectures[0];

            if (fillWithPractice) {
              quests.push({
                id: uuidv4(),
                title: `[${subject}] 복습 문제풀이`,
                description: `이전에 학습한 ${subject} 내용을 문제로 복습하세요.`,
                questType: 'practice',
                subject,
                courseId: courseInfo?.courseId || '',
                courseName: courseInfo?.courseName || '',
                lecturer: courseInfo?.lecturer,
                chapter: '복습 문제풀이',
                section: null,
                scheduledDate: dateStr,
                estimatedMinutes: 45,
                status: 'pending',
                priority: 'medium',
                studyTips: {
                  importance: '복습 강화',
                  keyPoints: ['이전 내용 복습', '오답 정리', '취약점 보완'],
                  studyMethod: '문제 풀이',
                },
              });
            }

            if (fillWithReview) {
              quests.push({
                id: uuidv4(),
                title: `[${subject}] 개념 복습`,
                description: `이전에 학습한 ${subject} 개념을 다시 정리하세요.`,
                questType: 'review',
                subject,
                courseId: courseInfo?.courseId || '',
                courseName: courseInfo?.courseName || '',
                lecturer: courseInfo?.lecturer,
                chapter: '개념 복습',
                section: null,
                scheduledDate: dateStr,
                estimatedMinutes: 30,
                status: 'pending',
                priority: 'medium',
                studyTips: {
                  importance: '개념 정리',
                  keyPoints: ['핵심 개념 요약', '노트 정리', '암기 필요 사항 확인'],
                  studyMethod: '복습',
                },
              });
            }
          }
        }
      }
    }
  }

  return {
    success: true,
    quests,
    summary: generateSummary(quests, effectiveDays),
    message: '기본 알고리즘으로 학습 커리큘럼이 생성되었습니다.',
  };
}

/**
 * 에러 결과 생성
 */
function createErrorResult(
  message: string,
  validation?: CurriculumGenerationResult['validation']
): CurriculumGenerationResult {
  return {
    success: false,
    quests: [],
    summary: {
      totalQuests: 0,
      totalDays: 0,
      averageMinutesPerDay: 0,
      subjectDistribution: {},
    },
    validation,
    message,
  };
}
