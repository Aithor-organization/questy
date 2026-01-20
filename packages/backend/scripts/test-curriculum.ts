/**
 * Curriculum Generation Test Script
 * 커리큘럼 생성 에이전트 자동화 테스트
 *
 * 사용법:
 * cd packages/backend && npx tsx scripts/test-curriculum.ts
 *
 * 환경변수:
 * - API_URL: 백엔드 API URL (기본: http://localhost:3001)
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 테스트 결과 타입
interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details?: Record<string, any>;
}

// 퀘스트 타입
interface Quest {
  id: string;
  scheduledDate: string;
  subject: string;
  courseId: string;
  courseName: string;
  chapter: string;
  questType: string;
  estimatedMinutes: number;
}

// ===================== 검증 함수들 =====================

/**
 * 요일 제약 검증: 지정된 요일에만 퀘스트가 생성되었는지 확인
 */
function validateWeekdayConstraint(
  quests: Quest[],
  subjectDays: Record<string, number[]>
): { passed: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const quest of quests) {
    const questDate = new Date(quest.scheduledDate);
    const dayOfWeek = questDate.getDay(); // 0=일, 1=월, ..., 6=토
    const subject = quest.subject;

    // 해당 과목의 허용된 요일 확인
    const allowedDays = subjectDays[subject];
    if (allowedDays && !allowedDays.includes(dayOfWeek)) {
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      errors.push(
        `[요일 위반] ${quest.scheduledDate} (${dayNames[dayOfWeek]}): ${subject} - ${quest.chapter}`
      );
    }
  }

  return { passed: errors.length === 0, errors };
}

/**
 * 모의고사 날짜 제외 검증
 */
function validateMockExamExclusion(quests: Quest[]): { passed: boolean; errors: string[] } {
  const mockExamDates = new Set([
    // 2025
    '2025-03-13', '2025-06-05', '2025-09-03',
    // 2026
    '2026-03-12', '2026-06-04', '2026-09-02',
    // 2027
    '2027-03-11', '2027-06-03', '2027-09-01',
  ]);

  const errors: string[] = [];

  for (const quest of quests) {
    if (mockExamDates.has(quest.scheduledDate)) {
      errors.push(
        `[모의고사 날짜] ${quest.scheduledDate}: ${quest.subject} - ${quest.chapter}`
      );
    }
  }

  return { passed: errors.length === 0, errors };
}

/**
 * 일일 학습시간 검증
 */
function validateDailyStudyHours(
  quests: Quest[],
  maxDailyMinutes: number
): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 날짜별 학습시간 합계
  const dailyMinutes: Record<string, number> = {};
  for (const quest of quests) {
    const date = quest.scheduledDate;
    dailyMinutes[date] = (dailyMinutes[date] || 0) + quest.estimatedMinutes;
  }

  for (const [date, minutes] of Object.entries(dailyMinutes)) {
    if (minutes > maxDailyMinutes * 1.2) {
      // 20% 초과는 에러
      errors.push(`[시간 초과] ${date}: ${minutes}분 (최대 ${maxDailyMinutes}분)`);
    } else if (minutes > maxDailyMinutes) {
      // 약간 초과는 경고
      warnings.push(`[시간 경고] ${date}: ${minutes}분 (최대 ${maxDailyMinutes}분)`);
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * 목표일 이전 완료 검증
 */
function validateTargetDate(
  quests: Quest[],
  targetDate: string
): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const target = new Date(targetDate);

  for (const quest of quests) {
    const questDate = new Date(quest.scheduledDate);
    if (questDate > target) {
      errors.push(
        `[목표일 초과] ${quest.scheduledDate}: ${quest.subject} - ${quest.chapter}`
      );
    }
  }

  return { passed: errors.length === 0, errors };
}

/**
 * 퀘스트 타입 분포 검증 (복습/문제풀이 포함 여부)
 */
function validateQuestTypes(
  quests: Quest[],
  expectReview: boolean
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];

  const types = new Set(quests.map(q => q.questType));
  const hasReview = types.has('review');
  const hasPractice = types.has('practice') || types.has('problem_set');

  if (expectReview && !hasReview && !hasPractice) {
    warnings.push('복습/문제풀이 퀘스트가 없습니다');
  }

  return { passed: true, warnings };
}

// ===================== API 호출 함수들 =====================

async function searchCourses(subject: string, limit = 5): Promise<any[]> {
  const response = await fetch(`${API_URL}/api/curriculum/search-courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, limit }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`강좌 검색 실패: ${data.error}`);
  }

  return data.data.courses;
}

async function generateQuests(params: {
  courseContents: any[];
  targetDate: string;
  dailyStudyHours: number;
  subjectHours?: Record<string, number | null>;
  subjectDays?: Record<string, number[]>;
  options?: any;
}): Promise<{ success: boolean; quests?: Quest[]; error?: string; validation?: any }> {
  const response = await fetch(`${API_URL}/api/curriculum/generate-quests-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 'test-user',
      ...params,
    }),
  });

  const data = await response.json();
  return {
    success: data.success,
    quests: data.data?.quests,
    error: data.error,
    validation: data.data?.validation,
  };
}

// ===================== 테스트 시나리오들 =====================

async function runTest(
  name: string,
  testFn: () => Promise<TestResult>
): Promise<TestResult> {
  log(`\n▶ ${name}`, 'cyan');
  try {
    const result = await testFn();
    if (result.passed) {
      log(`  ✅ PASSED`, 'green');
    } else {
      log(`  ❌ FAILED`, 'red');
      result.errors.forEach(e => log(`     ${e}`, 'red'));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => log(`     ⚠️ ${w}`, 'yellow'));
    }
    return result;
  } catch (error: any) {
    log(`  ❌ ERROR: ${error.message}`, 'red');
    return {
      name,
      passed: false,
      errors: [error.message],
      warnings: [],
    };
  }
}

// 테스트 1: 월/수/금 요일 제약
async function testWeekdayConstraint(): Promise<TestResult> {
  const courses = await searchCourses('국어', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  const subjectDays = {
    '국어': [1, 3, 5], // 월, 수, 금
  };

  // 2개월 후 목표
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);

  const result = await generateQuests({
    courseContents: courses.slice(0, 1),
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6,
    subjectDays,
  });

  if (!result.success || !result.quests) {
    return {
      name: '월/수/금 요일 제약',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateWeekdayConstraint(result.quests, subjectDays);

  return {
    name: '월/수/금 요일 제약',
    passed: validation.passed,
    errors: validation.errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      dates: [...new Set(result.quests.map(q => q.scheduledDate))].slice(0, 10),
    },
  };
}

// 테스트 2: 모의고사 날짜 제외
async function testMockExamExclusion(): Promise<TestResult> {
  const courses = await searchCourses('수학', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  // 모의고사 날짜를 포함하는 기간 설정 (2026-03-01 ~ 2026-03-31)
  // 2026년 3월 모의고사: 2026-03-12
  const targetDate = '2026-03-31';

  const result = await generateQuests({
    courseContents: courses.slice(0, 1),
    targetDate,
    dailyStudyHours: 8,
  });

  if (!result.success || !result.quests) {
    return {
      name: '모의고사 날짜 제외',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateMockExamExclusion(result.quests);

  return {
    name: '모의고사 날짜 제외 (3월 모의고사: 2026-03-12)',
    passed: validation.passed,
    errors: validation.errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      marchDates: result.quests
        .filter(q => q.scheduledDate.startsWith('2025-03'))
        .map(q => q.scheduledDate)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    },
  };
}

// 테스트 3: 일일 학습시간 제한
async function testDailyStudyHoursLimit(): Promise<TestResult> {
  const courses = await searchCourses('영어', 3);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  const dailyStudyHours = 4;
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 1);

  const result = await generateQuests({
    courseContents: courses.slice(0, 2),
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours,
  });

  if (!result.success || !result.quests) {
    return {
      name: '일일 학습시간 제한',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateDailyStudyHours(result.quests, dailyStudyHours * 60);

  return {
    name: `일일 학습시간 제한 (${dailyStudyHours}시간)`,
    passed: validation.passed,
    errors: validation.errors,
    warnings: validation.warnings,
    details: {
      totalQuests: result.quests.length,
    },
  };
}

// 테스트 4: 복합 시나리오 - 다중 과목 + 요일 제약
async function testMultiSubjectWithDays(): Promise<TestResult> {
  const koreanCourses = await searchCourses('국어', 2);
  const mathCourses = await searchCourses('수학', 2);

  if (koreanCourses.length === 0 || mathCourses.length === 0) {
    throw new Error('테스트용 강좌를 찾을 수 없습니다');
  }

  const subjectDays = {
    '국어': [1, 3], // 월, 수
    '수학': [2, 4, 6], // 화, 목, 토
  };

  // 3개월 후 목표 (충분한 시간 확보)
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 3);

  const result = await generateQuests({
    courseContents: [...koreanCourses.slice(0, 1), ...mathCourses.slice(0, 1)],
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6,
    subjectDays,
  });

  if (!result.success || !result.quests) {
    return {
      name: '다중 과목 요일 제약',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateWeekdayConstraint(result.quests, subjectDays);

  return {
    name: '다중 과목 요일 제약 (국어: 월/수, 수학: 화/목/토)',
    passed: validation.passed,
    errors: validation.errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      koreanQuests: result.quests.filter(q => q.subject === '국어').length,
      mathQuests: result.quests.filter(q => q.subject === '수학').length,
    },
  };
}

// 테스트 5: 목표일 준수
async function testTargetDateCompliance(): Promise<TestResult> {
  const courses = await searchCourses('국어', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 1);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  const result = await generateQuests({
    courseContents: courses.slice(0, 1),
    targetDate: targetDateStr,
    dailyStudyHours: 8,
  });

  if (!result.success || !result.quests) {
    return {
      name: '목표일 준수',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateTargetDate(result.quests, targetDateStr);

  return {
    name: `목표일 준수 (${targetDateStr})`,
    passed: validation.passed,
    errors: validation.errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      lastQuestDate: result.quests.length > 0
        ? result.quests.map(q => q.scheduledDate).sort().pop()
        : null,
    },
  };
}

// ===================== 추가 테스트 시나리오 =====================

// 테스트 6: 주말 제외 (평일만)
async function testWeekdaysOnly(): Promise<TestResult> {
  const courses = await searchCourses('국어', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  // 모든 과목 평일만 (월~금)
  const subjectDays = {
    '국어': [1, 2, 3, 4, 5], // 월~금
  };

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);

  const result = await generateQuests({
    courseContents: courses.slice(0, 1),
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6,
    subjectDays,
  });

  if (!result.success || !result.quests) {
    return {
      name: '주말 제외',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 주말(토=6, 일=0) 검사
  const weekendQuests = result.quests.filter(q => {
    const day = new Date(q.scheduledDate).getDay();
    return day === 0 || day === 6;
  });

  const errors = weekendQuests.map(q => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = new Date(q.scheduledDate).getDay();
    return `[주말 위반] ${q.scheduledDate} (${dayNames[day]}): ${q.chapter}`;
  });

  return {
    name: '주말 제외 (평일만)',
    passed: errors.length === 0,
    errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      weekendQuests: weekendQuests.length,
    },
  };
}

// 테스트 7: 과목별 학습시간 제한 (subjectHours)
async function testSubjectHours(): Promise<TestResult> {
  const koreanCourses = await searchCourses('국어', 2);
  const mathCourses = await searchCourses('수학', 2);

  if (koreanCourses.length === 0 || mathCourses.length === 0) {
    throw new Error('테스트용 강좌를 찾을 수 없습니다');
  }

  // 국어 2시간, 수학 3시간
  const subjectHours = {
    '국어': 2,
    '수학': 3,
  };

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);

  const result = await generateQuests({
    courseContents: [...koreanCourses.slice(0, 1), ...mathCourses.slice(0, 1)],
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 5,
    subjectHours,
  });

  if (!result.success || !result.quests) {
    return {
      name: '과목별 학습시간',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 날짜별 과목별 시간 검사
  const dailySubjectMinutes: Record<string, Record<string, number>> = {};
  for (const quest of result.quests) {
    const date = quest.scheduledDate;
    const subject = quest.subject;
    if (!dailySubjectMinutes[date]) dailySubjectMinutes[date] = {};
    dailySubjectMinutes[date][subject] = (dailySubjectMinutes[date][subject] || 0) + quest.estimatedMinutes;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [date, subjects] of Object.entries(dailySubjectMinutes)) {
    for (const [subject, minutes] of Object.entries(subjects)) {
      const maxMinutes = (subjectHours[subject as keyof typeof subjectHours] || 5) * 60;
      if (minutes > maxMinutes * 1.2) {
        errors.push(`[${subject} 시간 초과] ${date}: ${minutes}분 (최대 ${maxMinutes}분)`);
      } else if (minutes > maxMinutes) {
        warnings.push(`[${subject} 경고] ${date}: ${minutes}분 (최대 ${maxMinutes}분)`);
      }
    }
  }

  return {
    name: '과목별 학습시간 (국어 2h, 수학 3h)',
    passed: errors.length === 0,
    errors,
    warnings,
    details: {
      totalQuests: result.quests.length,
      koreanQuests: result.quests.filter(q => q.subject === '국어').length,
      mathQuests: result.quests.filter(q => q.subject === '수학').length,
    },
  };
}

// 테스트 8: 불가능한 일정 처리 (에러 반환 확인)
async function testImpossibleSchedule(): Promise<TestResult> {
  const courses = await searchCourses('국어', 5);
  if (courses.length < 3) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  // 매우 짧은 기간 (3일) + 많은 강좌
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);

  const result = await generateQuests({
    courseContents: courses.slice(0, 3), // 3개 강좌
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 2, // 하루 2시간만
  });

  // 이 경우 에러가 발생하거나 경고가 있어야 정상
  const expectError = !result.success ||
    (result.validation?.severity === 'invalid') ||
    (result.validation?.severity === 'warning');

  return {
    name: '불가능한 일정 처리',
    passed: expectError,
    errors: expectError ? [] : ['불가능한 일정에 대한 에러/경고가 없습니다'],
    warnings: [],
    details: {
      success: result.success,
      error: result.error || null,
      validationSeverity: result.validation?.severity || null,
    },
  };
}

// 테스트 9: 이어듣기 (startFromChapter)
async function testContinueFromChapter(): Promise<TestResult> {
  const courses = await searchCourses('국어', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  // 첫 번째 강좌만 사용, 5강부터 시작
  const course = courses[0];
  const startFromChapter = 5;

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);

  const result = await generateQuests({
    courseContents: [{
      ...course,
      startFromChapter,
    }],
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6,
  });

  if (!result.success || !result.quests) {
    return {
      name: '이어듣기',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 퀘스트 중 강의 번호가 5 미만인 것이 있으면 실패
  const errors: string[] = [];
  const lectureQuests = result.quests.filter(q => q.questType === 'lecture');

  for (const quest of lectureQuests) {
    // 챕터에서 번호 추출 시도 (예: "1강. 제목" → 1)
    const match = quest.chapter.match(/^(\d+)/);
    if (match) {
      const chapterNum = parseInt(match[1]);
      if (chapterNum < startFromChapter) {
        errors.push(`[이어듣기 위반] ${chapterNum}강 포함됨 (${startFromChapter}강부터 시작해야 함)`);
      }
    }
  }

  return {
    name: `이어듣기 (${startFromChapter}강부터)`,
    passed: errors.length === 0,
    errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      lectureQuests: lectureQuests.length,
      totalChaptersInCourse: course.chapters?.length || 0,
    },
  };
}

// 테스트 10: 복습 퀘스트 포함
async function testReviewQuestsIncluded(): Promise<TestResult> {
  const courses = await searchCourses('수학', 2);
  if (courses.length === 0) throw new Error('테스트용 강좌를 찾을 수 없습니다');

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);

  const result = await generateQuests({
    courseContents: courses.slice(0, 1),
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6,
    options: {
      reviewSettings: {
        enabled: true,
        sameDayReview: true,
        reviewDuration: 15,
      },
    },
  });

  if (!result.success || !result.quests) {
    return {
      name: '복습 퀘스트',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 퀘스트 타입별 개수
  const questTypes: Record<string, number> = {};
  for (const quest of result.quests) {
    questTypes[quest.questType] = (questTypes[quest.questType] || 0) + 1;
  }

  const hasReviewOrPractice =
    (questTypes['review'] || 0) > 0 ||
    (questTypes['practice'] || 0) > 0 ||
    (questTypes['problem_set'] || 0) > 0;

  // 복습 설정이 켜져 있으면 복습/문제풀이 퀘스트가 있어야 함 (경고만)
  const warnings = hasReviewOrPractice ? [] : ['복습/문제풀이 퀘스트가 없습니다'];

  return {
    name: '복습 퀘스트 포함',
    passed: true, // 경고만, 실패는 아님
    errors: [],
    warnings,
    details: {
      totalQuests: result.quests.length,
      questTypes,
    },
  };
}

// 테스트 11: 같은 과목 강좌 2개 (subjectHours 합산 검증)
async function testSameSubjectMultipleCourses(): Promise<TestResult> {
  // 국어 강좌 2개 검색
  const courses = await searchCourses('국어', 5);
  if (courses.length < 2) throw new Error('테스트용 국어 강좌 2개를 찾을 수 없습니다');

  // 국어 하루 최대 2시간 (120분)
  const subjectHours = {
    '국어': 2,
  };

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 3); // 3개월 후

  const result = await generateQuests({
    courseContents: courses.slice(0, 2), // 국어 강좌 2개
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 4,
    subjectHours,
  });

  if (!result.success || !result.quests) {
    return {
      name: '같은 과목 강좌 2개',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 날짜별 국어 총 학습시간 검증 (2개 강좌 합산)
  const dailyMinutes: Record<string, number> = {};
  const courseDistribution: Record<string, number> = {};

  for (const quest of result.quests) {
    const date = quest.scheduledDate;
    dailyMinutes[date] = (dailyMinutes[date] || 0) + quest.estimatedMinutes;

    // 강좌별 분포 확인
    const courseKey = quest.courseId;
    courseDistribution[courseKey] = (courseDistribution[courseKey] || 0) + 1;
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const maxMinutes = subjectHours['국어'] * 60; // 120분

  // 날짜별 초과 검사
  for (const [date, minutes] of Object.entries(dailyMinutes)) {
    if (minutes > maxMinutes * 1.2) {
      errors.push(`[국어 시간 초과] ${date}: ${minutes}분 (최대 ${maxMinutes}분, 강좌 2개 합산)`);
    } else if (minutes > maxMinutes) {
      warnings.push(`[국어 경고] ${date}: ${minutes}분 (최대 ${maxMinutes}분)`);
    }
  }

  // 두 강좌 모두 포함되었는지 확인
  const courseIds = Object.keys(courseDistribution);
  if (courseIds.length < 2) {
    warnings.push(`강좌가 ${courseIds.length}개만 포함됨 (2개 예상)`);
  }

  return {
    name: '같은 과목 강좌 2개 (국어 2시간 제한)',
    passed: errors.length === 0,
    errors,
    warnings,
    details: {
      totalQuests: result.quests.length,
      coursesIncluded: courseIds.length,
      questsPerCourse: courseDistribution,
      maxDailyMinutes: Math.max(...Object.values(dailyMinutes)),
      avgDailyMinutes: Math.round(Object.values(dailyMinutes).reduce((a, b) => a + b, 0) / Object.keys(dailyMinutes).length),
    },
  };
}

// 테스트 12: 세분화된 탐구 과목별 요일 제약 (물리학Ⅰ + 사회문화)
async function testExplorationSubjectDays(): Promise<TestResult> {
  // 물리학Ⅰ, 사회문화 강좌 검색
  const physicsCourses = await searchCourses('물리학Ⅰ', 2);
  const socialCourses = await searchCourses('사회문화', 2);

  if (physicsCourses.length === 0 || socialCourses.length === 0) {
    return {
      name: '세분화된 탐구 과목별 요일 제약',
      passed: false,
      errors: ['물리학Ⅰ 또는 사회문화 강좌를 찾을 수 없습니다'],
      warnings: [],
    };
  }

  // 물리학Ⅰ: 화/목 (2, 4), 사회문화: 월/수/금 (1, 3, 5)
  const subjectDays = {
    '물리학Ⅰ': [2, 4], // 화, 목
    '사회문화': [1, 3, 5], // 월, 수, 금
  };

  // 탐구 과목은 강의 수가 많아서 4개월 필요
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 4);

  const result = await generateQuests({
    courseContents: [physicsCourses[0], socialCourses[0]],
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 4,
    subjectDays,
  });

  if (!result.success || !result.quests) {
    return {
      name: '세분화된 탐구 과목별 요일 제약',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  const validation = validateWeekdayConstraint(result.quests, subjectDays);

  const physicsQuests = result.quests.filter(q => q.subject === '물리학Ⅰ');
  const socialQuests = result.quests.filter(q => q.subject === '사회문화');

  return {
    name: '세분화된 탐구 과목별 요일 제약 (물리Ⅰ: 화/목, 사문: 월/수/금)',
    passed: validation.passed,
    errors: validation.errors,
    warnings: [],
    details: {
      totalQuests: result.quests.length,
      physicsQuests: physicsQuests.length,
      socialQuests: socialQuests.length,
    },
  };
}

// 테스트 13: 세분화된 탐구 과목별 학습시간 제한
async function testExplorationSubjectHours(): Promise<TestResult> {
  const physicsCourses = await searchCourses('물리학Ⅰ', 2);
  const chemistryCourses = await searchCourses('화학Ⅰ', 2);

  if (physicsCourses.length === 0 || chemistryCourses.length === 0) {
    return {
      name: '세분화된 탐구 과목별 학습시간',
      passed: false,
      errors: ['물리학Ⅰ 또는 화학Ⅰ 강좌를 찾을 수 없습니다'],
      warnings: [],
    };
  }

  // 물리학Ⅰ: 2시간, 화학Ⅰ: 1.5시간
  const subjectHours = {
    '물리학Ⅰ': 2,
    '화학Ⅰ': 1.5,
  };

  // 탐구 과목은 강의 수가 많아서 6개월 + 일일 5시간 필요
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 6);

  const result = await generateQuests({
    courseContents: [physicsCourses[0], chemistryCourses[0]],
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 5,
    subjectHours,
  });

  if (!result.success || !result.quests) {
    return {
      name: '세분화된 탐구 과목별 학습시간',
      passed: false,
      errors: [result.error || '퀘스트 생성 실패'],
      warnings: [],
    };
  }

  // 날짜별 과목별 시간 검사
  const dailySubjectMinutes: Record<string, Record<string, number>> = {};
  for (const quest of result.quests) {
    const date = quest.scheduledDate;
    const subject = quest.subject;
    if (!dailySubjectMinutes[date]) dailySubjectMinutes[date] = {};
    dailySubjectMinutes[date][subject] = (dailySubjectMinutes[date][subject] || 0) + quest.estimatedMinutes;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [date, subjects] of Object.entries(dailySubjectMinutes)) {
    for (const [subject, minutes] of Object.entries(subjects)) {
      const maxMinutes = (subjectHours[subject as keyof typeof subjectHours] || 4) * 60;
      if (minutes > maxMinutes * 1.2) {
        errors.push(`[${subject} 시간 초과] ${date}: ${minutes}분 (최대 ${maxMinutes}분)`);
      } else if (minutes > maxMinutes) {
        warnings.push(`[${subject} 경고] ${date}: ${minutes}분 (최대 ${maxMinutes}분)`);
      }
    }
  }

  const physicsQuests = result.quests.filter(q => q.subject === '물리학Ⅰ');
  const chemistryQuests = result.quests.filter(q => q.subject === '화학Ⅰ');

  return {
    name: '세분화된 탐구 과목별 학습시간 (물리Ⅰ 2h, 화학Ⅰ 1.5h)',
    passed: errors.length === 0,
    errors,
    warnings,
    details: {
      totalQuests: result.quests.length,
      physicsQuests: physicsQuests.length,
      chemistryQuests: chemistryQuests.length,
    },
  };
}

// ===================== 메인 실행 =====================

async function main() {
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('   커리큘럼 생성 에이전트 자동화 테스트', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');
  log(`\n📍 API URL: ${API_URL}`);

  // 서버 연결 확인
  try {
    const healthCheck = await fetch(`${API_URL}/api/curriculum/stats`);
    if (!healthCheck.ok) throw new Error('서버 응답 없음');
    log('✅ 서버 연결 확인', 'green');
  } catch {
    log('❌ 서버에 연결할 수 없습니다. 백엔드를 먼저 실행하세요.', 'red');
    log('   cd packages/backend && npm run dev', 'yellow');
    process.exit(1);
  }

  const results: TestResult[] = [];

  // 테스트 실행 - 기본 테스트
  log('\n📋 기본 테스트', 'blue');
  results.push(await runTest('테스트 1: 월/수/금 요일 제약', testWeekdayConstraint));
  results.push(await runTest('테스트 2: 모의고사 날짜 제외', testMockExamExclusion));
  results.push(await runTest('테스트 3: 일일 학습시간 제한', testDailyStudyHoursLimit));
  results.push(await runTest('테스트 4: 다중 과목 요일 제약', testMultiSubjectWithDays));
  results.push(await runTest('테스트 5: 목표일 준수', testTargetDateCompliance));

  // 추가 테스트
  log('\n📋 추가 테스트', 'blue');
  results.push(await runTest('테스트 6: 주말 제외', testWeekdaysOnly));
  results.push(await runTest('테스트 7: 과목별 학습시간', testSubjectHours));
  results.push(await runTest('테스트 8: 불가능한 일정 처리', testImpossibleSchedule));
  results.push(await runTest('테스트 9: 이어듣기', testContinueFromChapter));
  results.push(await runTest('테스트 10: 복습 퀘스트', testReviewQuestsIncluded));
  results.push(await runTest('테스트 11: 같은 과목 강좌 2개', testSameSubjectMultipleCourses));

  // 결과 요약
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('   테스트 결과 요약', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  log(`\n총 ${total}개 테스트: `, 'reset');
  log(`  ✅ 통과: ${passed}`, 'green');
  if (failed > 0) {
    log(`  ❌ 실패: ${failed}`, 'red');
  }

  // 실패한 테스트 상세
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    log('\n실패한 테스트:', 'red');
    failedTests.forEach(t => {
      log(`  - ${t.name}`, 'red');
      t.errors.slice(0, 3).forEach(e => log(`    ${e}`, 'red'));
      if (t.errors.length > 3) {
        log(`    ... 외 ${t.errors.length - 3}개`, 'red');
      }
    });
  }

  // 상세 정보 출력
  log('\n상세 정보:', 'cyan');
  results.forEach(r => {
    if (r.details) {
      log(`  ${r.name}:`, 'cyan');
      Object.entries(r.details).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          log(`    ${key}: [${value.slice(0, 5).join(', ')}${value.length > 5 ? '...' : ''}]`, 'reset');
        } else {
          log(`    ${key}: ${value}`, 'reset');
        }
      });
    }
  });

  log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
