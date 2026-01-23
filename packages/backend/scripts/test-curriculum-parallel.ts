/**
 * Curriculum Generation Parallel Performance Test
 * 커리큘럼 생성 병렬 성능 테스트 + 결과 검증
 *
 * 기능:
 * 1. Supabase에서 실제 강좌 데이터 로드
 * 2. 다양한 테스트 시나리오 자동 생성
 * 3. 병렬 API 호출로 성능 측정
 * 4. 생성된 커리큘럼 품질 검증
 *
 * 사용법:
 * cd packages/backend && npx tsx scripts/test-curriculum-parallel.ts
 *
 * 옵션:
 * --concurrency=5     # 동시 요청 수 (기본: 3)
 * --scenarios=10      # 테스트 시나리오 수 (기본: 5)
 * --output=results    # 결과 저장 폴더 (기본: ./test-results)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ===================== 설정 =====================

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// CLI 인자 파싱
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || 'true';
  return acc;
}, {} as Record<string, string>);

const CONCURRENCY = parseInt(args.concurrency || '3');
const SCENARIO_COUNT = parseInt(args.scenarios || '5');
const OUTPUT_DIR = args.output || './test-results';

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ===================== 타입 정의 =====================

interface Course {
  id: string;
  course_name: string;
  lecturer: string;
  subject: string;
  platform: string;
  chapters: ChapterData[];
  total_duration_minutes?: number;
}

interface ChapterData {
  num?: number;
  title: string;
  duration?: string;
}

interface TestScenario {
  id: string;
  name: string;
  courseContents: any[];
  targetDate: string;
  dailyStudyHours: number;
  subjectHours?: Record<string, number | null>;
  subjectDays?: Record<string, number[]>;
  options?: any;
}

interface TestResult {
  scenarioId: string;
  scenarioName: string;
  success: boolean;
  responseTimeMs: number;
  questCount: number;
  validation: ValidationResult;
  error?: string;
  summary?: any;
}

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

interface PerformanceMetrics {
  totalTests: number;
  successCount: number;
  failureCount: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  p95ResponseTimeMs: number;
  avgQuestCount: number;
  avgValidationScore: number;
}

// ===================== Supabase 데이터 로드 =====================

async function loadCoursesFromSupabase(): Promise<Course[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('⚠️ Supabase 환경변수가 없습니다. API fallback 사용', 'yellow');
    return loadCoursesFromAPI();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .limit(100);

  if (error) {
    log(`Supabase 에러: ${error.message}`, 'red');
    return loadCoursesFromAPI();
  }

  log(`✅ Supabase에서 ${data.length}개 강좌 로드`, 'green');
  return data as Course[];
}

async function loadCoursesFromAPI(): Promise<Course[]> {
  const subjects = ['국어', '영어', '수학', '물리학Ⅰ', '화학Ⅰ', '생명과학Ⅰ', '지구과학Ⅰ', '사회문화', '생활과윤리'];
  const allCourses: Course[] = [];

  for (const subject of subjects) {
    try {
      const response = await fetch(`${API_URL}/api/curriculum/search-courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, limit: 10 }),
      });

      const data = await response.json();
      if (data.success && data.data?.courses) {
        allCourses.push(...data.data.courses);
      }
    } catch (e) {
      // 무시
    }
  }

  log(`✅ API에서 ${allCourses.length}개 강좌 로드`, 'green');
  return allCourses;
}

// ===================== 테스트 시나리오 생성 =====================

function generateTestScenarios(courses: Course[], count: number): TestScenario[] {
  const scenarios: TestScenario[] = [];
  const subjects = [...new Set(courses.map(c => c.subject))];

  // 과목별 강좌 그룹화
  const coursesBySubject: Record<string, Course[]> = {};
  for (const course of courses) {
    if (!coursesBySubject[course.subject]) {
      coursesBySubject[course.subject] = [];
    }
    coursesBySubject[course.subject].push(course);
  }

  // 시나리오 템플릿
  const templates = [
    // 단일 과목 시나리오
    { name: '단일 과목 - 빠른 완주', subjectCount: 1, months: 1, dailyHours: 8 },
    { name: '단일 과목 - 여유로운 완주', subjectCount: 1, months: 3, dailyHours: 4 },

    // 다중 과목 시나리오
    { name: '2과목 조합', subjectCount: 2, months: 2, dailyHours: 6 },
    { name: '3과목 조합', subjectCount: 3, months: 3, dailyHours: 8 },
    { name: '전과목 시뮬레이션', subjectCount: 6, months: 6, dailyHours: 10 },

    // 요일 제약 시나리오
    { name: '평일만 학습', subjectCount: 2, months: 2, dailyHours: 6, weekdaysOnly: true },
    { name: '월수금 학습', subjectCount: 1, months: 2, dailyHours: 6, specificDays: [1, 3, 5] },

    // 시간 제약 시나리오
    { name: '과목별 시간 제한', subjectCount: 2, months: 3, dailyHours: 5, withSubjectHours: true },

    // 극단적 시나리오
    { name: '촉박한 일정', subjectCount: 2, months: 0.5, dailyHours: 10 },
    { name: '장기 플랜', subjectCount: 4, months: 6, dailyHours: 6 },
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const selectedSubjects = shuffleArray(subjects).slice(0, template.subjectCount);
    const selectedCourses: Course[] = [];

    for (const subject of selectedSubjects) {
      const subjectCourses = coursesBySubject[subject] || [];
      if (subjectCourses.length > 0) {
        selectedCourses.push(subjectCourses[Math.floor(Math.random() * subjectCourses.length)]);
      }
    }

    if (selectedCourses.length === 0) continue;

    // 목표일 계산
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + Math.ceil(template.months));

    const scenario: TestScenario = {
      id: `scenario-${i + 1}`,
      name: `${template.name} (${selectedSubjects.join(', ')})`,
      courseContents: selectedCourses.map(c => ({
        id: c.id,
        courseName: c.course_name,
        lecturer: c.lecturer,
        subject: c.subject,
        chapters: c.chapters,
        platform: c.platform,
      })),
      targetDate: targetDate.toISOString().split('T')[0],
      dailyStudyHours: template.dailyHours,
    };

    // 요일 제약 추가
    if (template.weekdaysOnly) {
      scenario.subjectDays = {};
      for (const course of selectedCourses) {
        scenario.subjectDays[course.subject] = [1, 2, 3, 4, 5]; // 월~금
      }
    } else if (template.specificDays) {
      scenario.subjectDays = {};
      for (const course of selectedCourses) {
        scenario.subjectDays[course.subject] = template.specificDays;
      }
    }

    // 과목별 시간 제한 추가
    if (template.withSubjectHours) {
      scenario.subjectHours = {};
      for (const course of selectedCourses) {
        scenario.subjectHours[course.subject] = Math.floor(template.dailyHours / selectedCourses.length);
      }
    }

    scenarios.push(scenario);
  }

  return scenarios;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ===================== API 호출 =====================

async function callGenerateAPI(scenario: TestScenario): Promise<{
  success: boolean;
  quests?: any[];
  summary?: any;
  validation?: any;
  error?: string;
  responseTimeMs: number;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/api/curriculum/generate-quests-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'test-parallel',
        ...scenario,
      }),
    });

    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;

    return {
      success: data.success,
      quests: data.data?.quests,
      summary: data.data?.summary,
      validation: data.data?.validation,
      error: data.error,
      responseTimeMs,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

// ===================== 커리큘럼 검증 =====================

function validateCurriculum(
  scenario: TestScenario,
  quests: any[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  if (!quests || quests.length === 0) {
    return {
      isValid: false,
      score: 0,
      issues: [{ severity: 'error', code: 'NO_QUESTS', message: '퀘스트가 생성되지 않음' }],
    };
  }

  // 1. 요일 제약 검증
  if (scenario.subjectDays) {
    for (const quest of quests) {
      const questDate = new Date(quest.scheduledDate);
      const dayOfWeek = questDate.getDay();
      const allowedDays = scenario.subjectDays[quest.subject];

      if (allowedDays && !allowedDays.includes(dayOfWeek)) {
        issues.push({
          severity: 'error',
          code: 'WEEKDAY_VIOLATION',
          message: `${quest.scheduledDate}: ${quest.subject} 요일 위반`,
        });
        score -= 5;
      }
    }
  }

  // 2. 목표일 검증
  const targetDate = new Date(scenario.targetDate);
  for (const quest of quests) {
    const questDate = new Date(quest.scheduledDate);
    if (questDate > targetDate) {
      issues.push({
        severity: 'error',
        code: 'TARGET_DATE_EXCEEDED',
        message: `${quest.scheduledDate}: 목표일 ${scenario.targetDate} 초과`,
      });
      score -= 10;
    }
  }

  // 3. 일일 학습시간 검증
  const dailyMinutes: Record<string, number> = {};
  for (const quest of quests) {
    const date = quest.scheduledDate;
    dailyMinutes[date] = (dailyMinutes[date] || 0) + quest.estimatedMinutes;
  }

  const maxAllowedMinutes = scenario.dailyStudyHours * 60 * 1.2; // 20% 여유
  for (const [date, minutes] of Object.entries(dailyMinutes)) {
    if (minutes > maxAllowedMinutes) {
      issues.push({
        severity: 'warning',
        code: 'DAILY_HOURS_EXCEEDED',
        message: `${date}: ${minutes}분 (최대 ${maxAllowedMinutes}분)`,
      });
      score -= 2;
    }
  }

  // 4. 과목별 시간 제한 검증
  if (scenario.subjectHours) {
    const dailySubjectMinutes: Record<string, Record<string, number>> = {};
    for (const quest of quests) {
      const date = quest.scheduledDate;
      const subject = quest.subject;
      if (!dailySubjectMinutes[date]) dailySubjectMinutes[date] = {};
      dailySubjectMinutes[date][subject] = (dailySubjectMinutes[date][subject] || 0) + quest.estimatedMinutes;
    }

    for (const [date, subjects] of Object.entries(dailySubjectMinutes)) {
      for (const [subject, minutes] of Object.entries(subjects)) {
        const maxMinutes = (scenario.subjectHours[subject] || 10) * 60;
        if (minutes > maxMinutes * 1.2) {
          issues.push({
            severity: 'warning',
            code: 'SUBJECT_HOURS_EXCEEDED',
            message: `${date} ${subject}: ${minutes}분 (최대 ${maxMinutes}분)`,
          });
          score -= 2;
        }
      }
    }
  }

  // 5. 모의고사 날짜 검증
  const mockExamDates = new Set([
    '2025-03-13', '2025-06-05', '2025-09-03',
    '2026-03-12', '2026-06-04', '2026-09-02',
    '2027-03-11', '2027-06-03', '2027-09-01',
  ]);

  for (const quest of quests) {
    if (mockExamDates.has(quest.scheduledDate)) {
      issues.push({
        severity: 'error',
        code: 'MOCK_EXAM_DATE',
        message: `모의고사 날짜 ${quest.scheduledDate}에 퀘스트 배정`,
      });
      score -= 10;
    }
  }

  // 6. 퀘스트 품질 검증
  for (const quest of quests) {
    if (!quest.title || quest.title.trim() === '') {
      issues.push({
        severity: 'warning',
        code: 'EMPTY_TITLE',
        message: `퀘스트 ID ${quest.id}: 제목 없음`,
      });
      score -= 1;
    }
    if (!quest.estimatedMinutes || quest.estimatedMinutes <= 0) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_DURATION',
        message: `퀘스트 ID ${quest.id}: 유효하지 않은 시간`,
      });
      score -= 1;
    }
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

// ===================== 병렬 실행 =====================

async function runParallelTests(
  scenarios: TestScenario[],
  concurrency: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const queue = [...scenarios];
  const inProgress: Promise<void>[] = [];

  log(`\n🚀 ${scenarios.length}개 시나리오를 동시 ${concurrency}개씩 실행`, 'cyan');

  async function processScenario(scenario: TestScenario): Promise<void> {
    const startLog = `  ▶ [${scenario.id}] ${scenario.name}`;
    process.stdout.write(`${colors.blue}${startLog}${colors.reset}`);

    const response = await callGenerateAPI(scenario);
    const validation = response.success && response.quests
      ? validateCurriculum(scenario, response.quests)
      : { isValid: false, score: 0, issues: [] };

    const result: TestResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      success: response.success,
      responseTimeMs: response.responseTimeMs,
      questCount: response.quests?.length || 0,
      validation,
      error: response.error,
      summary: response.summary,
    };

    results.push(result);

    // 결과 출력
    const status = result.success && result.validation.isValid
      ? `${colors.green}✅ PASS${colors.reset}`
      : result.success
        ? `${colors.yellow}⚠️ WARN${colors.reset}`
        : `${colors.red}❌ FAIL${colors.reset}`;

    console.log(` → ${status} (${result.responseTimeMs}ms, ${result.questCount}개, 점수: ${result.validation.score})`);
  }

  while (queue.length > 0 || inProgress.length > 0) {
    // 동시 실행 수 유지
    while (inProgress.length < concurrency && queue.length > 0) {
      const scenario = queue.shift()!;
      const promise = processScenario(scenario).then(() => {
        const index = inProgress.indexOf(promise);
        if (index > -1) inProgress.splice(index, 1);
      });
      inProgress.push(promise);
    }

    // 하나라도 완료될 때까지 대기
    if (inProgress.length > 0) {
      await Promise.race(inProgress);
    }
  }

  return results;
}

// ===================== 성능 분석 =====================

function analyzePerformance(results: TestResult[]): PerformanceMetrics {
  const successResults = results.filter(r => r.success);
  const responseTimes = results.map(r => r.responseTimeMs).sort((a, b) => a - b);

  const p95Index = Math.floor(responseTimes.length * 0.95);

  return {
    totalTests: results.length,
    successCount: successResults.length,
    failureCount: results.length - successResults.length,
    avgResponseTimeMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
    minResponseTimeMs: responseTimes[0] || 0,
    maxResponseTimeMs: responseTimes[responseTimes.length - 1] || 0,
    p95ResponseTimeMs: responseTimes[p95Index] || 0,
    avgQuestCount: Math.round(successResults.reduce((a, r) => a + r.questCount, 0) / (successResults.length || 1)),
    avgValidationScore: Math.round(successResults.reduce((a, r) => a + r.validation.score, 0) / (successResults.length || 1)),
  };
}

// ===================== 결과 저장 =====================

function saveResults(results: TestResult[], metrics: PerformanceMetrics, scenarios: TestScenario[]): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(OUTPUT_DIR);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 전체 결과 JSON
  const fullReport = {
    timestamp: new Date().toISOString(),
    config: {
      apiUrl: API_URL,
      concurrency: CONCURRENCY,
      scenarioCount: SCENARIO_COUNT,
    },
    metrics,
    results: results.map(r => ({
      ...r,
      scenario: scenarios.find(s => s.id === r.scenarioId),
    })),
  };

  const jsonPath = path.join(outputDir, `report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(fullReport, null, 2));

  // 요약 마크다운
  const mdContent = `# 커리큘럼 생성 테스트 결과

**실행 시간**: ${new Date().toLocaleString('ko-KR')}

## 성능 요약

| 지표 | 값 |
|------|-----|
| 총 테스트 | ${metrics.totalTests}개 |
| 성공 | ${metrics.successCount}개 (${Math.round(metrics.successCount / metrics.totalTests * 100)}%) |
| 실패 | ${metrics.failureCount}개 |
| 평균 응답시간 | ${metrics.avgResponseTimeMs}ms |
| 최소 응답시간 | ${metrics.minResponseTimeMs}ms |
| 최대 응답시간 | ${metrics.maxResponseTimeMs}ms |
| P95 응답시간 | ${metrics.p95ResponseTimeMs}ms |
| 평균 퀘스트 수 | ${metrics.avgQuestCount}개 |
| 평균 검증 점수 | ${metrics.avgValidationScore}/100 |

## 테스트 결과

| 시나리오 | 상태 | 응답시간 | 퀘스트 | 점수 |
|---------|------|---------|-------|------|
${results.map(r => `| ${r.scenarioName} | ${r.success ? (r.validation.isValid ? '✅' : '⚠️') : '❌'} | ${r.responseTimeMs}ms | ${r.questCount}개 | ${r.validation.score}/100 |`).join('\n')}

## 검증 이슈

${results.filter(r => r.validation.issues.length > 0).map(r => `
### ${r.scenarioName}
${r.validation.issues.map(i => `- [${i.severity}] ${i.code}: ${i.message}`).join('\n')}
`).join('\n')}
`;

  const mdPath = path.join(outputDir, `report-${timestamp}.md`);
  fs.writeFileSync(mdPath, mdContent);

  log(`\n📁 결과 저장됨:`, 'green');
  log(`   JSON: ${jsonPath}`, 'reset');
  log(`   MD: ${mdPath}`, 'reset');
}

// ===================== 메인 =====================

async function main() {
  log('\n═══════════════════════════════════════════════════════════', 'blue');
  log('   커리큘럼 생성 병렬 성능 테스트', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');
  log(`\n📍 API URL: ${API_URL}`);
  log(`📊 동시 실행: ${CONCURRENCY}개`);
  log(`🎯 시나리오: ${SCENARIO_COUNT}개`);

  // 서버 연결 확인
  try {
    const healthCheck = await fetch(`${API_URL}/api/curriculum/stats`);
    if (!healthCheck.ok) throw new Error('서버 응답 없음');
    log('✅ 서버 연결 확인\n', 'green');
  } catch {
    log('❌ 서버에 연결할 수 없습니다. 백엔드를 먼저 실행하세요.', 'red');
    log('   cd packages/backend && npm run dev', 'yellow');
    process.exit(1);
  }

  // 1. 강좌 데이터 로드
  log('📚 강좌 데이터 로드 중...', 'cyan');
  const courses = await loadCoursesFromSupabase();

  if (courses.length === 0) {
    log('❌ 테스트용 강좌 데이터가 없습니다.', 'red');
    process.exit(1);
  }

  // 2. 테스트 시나리오 생성
  log('🎲 테스트 시나리오 생성 중...', 'cyan');
  const scenarios = generateTestScenarios(courses, SCENARIO_COUNT);
  log(`✅ ${scenarios.length}개 시나리오 생성됨\n`, 'green');

  // 3. 병렬 테스트 실행
  const startTime = Date.now();
  const results = await runParallelTests(scenarios, CONCURRENCY);
  const totalTime = Date.now() - startTime;

  // 4. 성능 분석
  const metrics = analyzePerformance(results);

  // 5. 결과 출력
  log('\n═══════════════════════════════════════════════════════════', 'blue');
  log('   테스트 결과 요약', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');

  log(`\n⏱️  총 실행 시간: ${(totalTime / 1000).toFixed(1)}초`, 'cyan');
  log(`\n📊 성능 지표:`, 'magenta');
  log(`   총 테스트: ${metrics.totalTests}개`);
  log(`   성공: ${metrics.successCount}개 (${Math.round(metrics.successCount / metrics.totalTests * 100)}%)`, 'green');
  log(`   실패: ${metrics.failureCount}개`, metrics.failureCount > 0 ? 'red' : 'reset');
  log(`\n⚡ 응답 시간:`, 'magenta');
  log(`   평균: ${metrics.avgResponseTimeMs}ms`);
  log(`   최소: ${metrics.minResponseTimeMs}ms`);
  log(`   최대: ${metrics.maxResponseTimeMs}ms`);
  log(`   P95: ${metrics.p95ResponseTimeMs}ms`);
  log(`\n📈 품질 지표:`, 'magenta');
  log(`   평균 퀘스트 수: ${metrics.avgQuestCount}개`);
  log(`   평균 검증 점수: ${metrics.avgValidationScore}/100`);

  // 6. 결과 저장
  saveResults(results, metrics, scenarios);

  // 7. 실패한 테스트 상세
  const failedTests = results.filter(r => !r.success || !r.validation.isValid);
  if (failedTests.length > 0) {
    log('\n⚠️ 문제가 있는 테스트:', 'yellow');
    for (const test of failedTests.slice(0, 5)) {
      log(`\n  ${test.scenarioName}:`, 'yellow');
      if (test.error) {
        log(`    에러: ${test.error}`, 'red');
      }
      for (const issue of test.validation.issues.slice(0, 3)) {
        log(`    [${issue.severity}] ${issue.code}: ${issue.message}`, issue.severity === 'error' ? 'red' : 'yellow');
      }
      if (test.validation.issues.length > 3) {
        log(`    ... 외 ${test.validation.issues.length - 3}개 이슈`, 'yellow');
      }
    }
    if (failedTests.length > 5) {
      log(`\n  ... 외 ${failedTests.length - 5}개 테스트`, 'yellow');
    }
  }

  log('\n');
  process.exit(metrics.failureCount > 0 ? 1 : 0);
}

main().catch(console.error);
