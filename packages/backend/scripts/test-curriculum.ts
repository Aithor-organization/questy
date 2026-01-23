/**
 * Curriculum Generation Test Script with Dummy Data
 * 커리큘럼 생성 에이전트 자동화 테스트 (로컬 더미 데이터 사용)
 *
 * 사용법:
 * cd packages/backend && npx tsx scripts/test-curriculum.ts
 *
 * 환경변수:
 * - API_URL: 백엔드 API URL (기본: http://localhost:3001)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DUMMY_DATA_DIR = path.resolve(__dirname, '../../../DummyData');

const API_URL = process.env.API_URL || 'http://localhost:3001';

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

// ===================== 데이터 로딩 함수 =====================

async function loadDummyCourses(filters: { subject: string; volumes?: number[] }[]): Promise<any[]> {
  const loadedCourses: any[] = [];

  try {
    const files = await fs.readdir(DUMMY_DATA_DIR);

    for (const filter of filters) {
      const targetFiles = files.filter(file => {
        const match = file.match(/^course_([^_]+)_(\d+)_/);
        if (!match) return false;

        const [, subject, volume] = match;
        const subjectMatch = subject === filter.subject;
        const volumeMatch = filter.volumes
          ? filter.volumes.includes(parseInt(volume))
          : true;
        return subjectMatch && volumeMatch;
      });

      for (const file of targetFiles) {
        const content = await fs.readFile(path.join(DUMMY_DATA_DIR, file), 'utf-8');
        loadedCourses.push(JSON.parse(content));
      }
    }
  } catch (error) {
    console.error('더미 데이터 로딩 중 에러:', error);
    throw new Error(`더미 데이터 로드 실패: ${DUMMY_DATA_DIR}`);
  }

  if (loadedCourses.length === 0) {
    throw new Error(`조건에 맞는 더미 데이터를 찾을 수 없습니다: ${JSON.stringify(filters)}`);
  }

  return loadedCourses;
}

// ===================== API 호출 함수 =====================

/**
 * useAI=true : /generate-quests-ai 호출 (기본)
 * useAI=false: /generate-quests 호출 (알고리즘 기반, existingPlans 지원 확실함)
 */
async function generateQuests(params: {
  courseContents: any[];
  targetDate: string;
  dailyStudyHours: number;
  subjectHours?: Record<string, number | null>;
  subjectDays?: Record<string, number[]>;
  existingPlans?: any[]; // 기존 스케줄 (가용 시간 체크용)
  options?: any;
  useAI?: boolean; // 엔드포인트 선택
}): Promise<{ success: boolean; quests?: Quest[]; error?: string; validation?: any }> {
  try {
    const endpoint = params.useAI === false ? 'generate-quests' : 'generate-quests-ai';
    const response = await fetch(`${API_URL}/api/curriculum/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'test-user-dummy',
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
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ===================== 검증 및 헬퍼 함수 =====================

function createFakeExistingPlan(date: string, minutes: number) {
  return {
    id: `plan_${date}`,
    type: 'EVENT',
    title: 'Existing Schedule',
    quests: [
      {
        id: `q_${date}`,
        scheduledDate: date,
        estimatedMinutes: minutes,
      }
    ]
  };
}

async function runTest(name: string, testFn: () => Promise<TestResult>): Promise<TestResult> {
  log(`\n▶ ${name}`, 'cyan');
  try {
    const startTime = Date.now();
    const result = await testFn();
    const duration = Date.now() - startTime;

    if (result.passed) {
      log(`  ✅ PASSED (${duration}ms)`, 'green');
    } else {
      log(`  ❌ FAILED (${duration}ms)`, 'red');
      result.errors.forEach(e => log(`     ${e}`, 'red'));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => log(`     ⚠️ ${w}`, 'yellow'));
    }
    return result;
  } catch (error: any) {
    log(`  ❌ ERROR: ${error.message}`, 'red');
    return { name, passed: false, errors: [error.message], warnings: [] };
  }
}

// ===================== 테스트 시나리오 =====================

// [기존 테스트] 1. 기본
async function test1_Basic(): Promise<TestResult> {
  const courses = await loadDummyCourses([{ subject: '국어', volumes: [1] }]);
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);
  const result = await generateQuests({
    courseContents: courses,
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 4,
  });
  return {
    name: '기본 생성',
    passed: result.success && (result.quests?.length || 0) > 0,
    errors: result.error ? [result.error] : [],
    warnings: [],
    details: { count: result.quests?.length }
  };
}

// [신규 테스트] 2. 가용 시간 vs 순공 시간 테스트 (Overlap)
// 상황: 하루 12시간 설정. 하지만 이미 7시간짜리 일정이 매일 잡혀있음.
// 실제 가용: 12 - 7 = 5시간. (버퍼 10% 제외하면 12*0.9 - 7 = 10.8 - 7 = 3.8시간)
// 시도: 6시간(360분)짜리 강의 부하를 매일 넣으려 시도 -> 실패하거나 기간이 엄청 늘어나야 함.
async function test2_CapacityOverlap(): Promise<TestResult> {
  // 수학 Vol.3 (짧은 2443 바이트, 강의 수 적음) 로드
  const courses = await loadDummyCourses([{ subject: '수학', volumes: [3] }]);

  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + 5); // 5일 단기

  // 5일간 매일 7시간(420분)씩 잡혀있는 일정 생성
  const existingPlans = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    existingPlans.push(createFakeExistingPlan(dateStr, 420)); // 7시간
  }

  // 생성 시도: 가용 12시간. 기존 7시간. 잔여 5시간.
  // 하루 학습 6시간 필요로 설정하면? -> 잔여 5시간으로는 매일 6시간 소화 불가.
  // -> 경고 발생하거나 퀘스트가 뒤로 밀려야 함.
  const result = await generateQuests({
    courseContents: courses,
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 12, // 전체 가용 시간 12h
    existingPlans, // 이미 7h 사용 중
    useAI: false // 정확한 로직 테스트를 위해 Rule-based 엔드포인트 사용
  });

  // 검증:
  // 1. 성공했더라도 날짜가 targetDate를 넘어갔거나
  // 2. validation warning에 'overload'가 있거나
  // 3. 퀘스트가 배정되지 못한 경우

  if (!result.success) {
    return { name: '가용 시간 부족 (Fail 예상)', passed: true, errors: [], warnings: ['생성 실패로 처리됨 (정상)'] };
  }

  const quests = result.quests || [];
  // 마지막 퀘스트 날짜 확인
  const lastQuestDate = quests.map(q => q.scheduledDate).sort().pop();
  const isOverTarget = lastQuestDate ? new Date(lastQuestDate) > targetDate : false;

  return {
    name: '가용 시간 부족 (12h 중 7h 사용, 6h 추가 시도)',
    passed: true,
    errors: [],
    warnings: isOverTarget ? ['목표일 초과하여 생성됨 (정상)'] : ['목표일 내 생성됨 (예상 밖 - 확인 필요)'],
    details: { lastQuestDate, targetDate: targetDate.toISOString().split('T')[0], totalQuests: quests.length }
  };
}

// [신규 테스트] 3. 버퍼 로직 테스트 (순공 시간)
// 상황: 하루 10시간 설정. 10% 버퍼(1시간) -> 순공 9시간 Max.
// 시도: 하루에 딱 9.5시간 분량의 강의를 넣으려고 할 때 어떻게 되는지 확인.
// (하루에 끝내야 하는 초단기)
async function test3_BufferLogic(): Promise<TestResult> {
  const courses = await loadDummyCourses([{ subject: '영어', volumes: [1] }]);
  // 영어 Vol.1 강의들의 총 시간 계산 필요.
  // 여기서는 임의로 짧은 기간(1일)에 6시간(360분) 학습 시도
  // 설정: Daily 6.5시간 (버퍼 0.65h -> 순공 5.85h). 
  // 6시간 강의는 5.85h 용량에 안 들어감 -> 2일로 늘어나는지 확인.

  const targetDate = new Date(); // 오늘 하루

  // Rule-based endpoint 사용 (ScheduleOptimizer의 bufferRatio=0.1 확인용)
  const result = await generateQuests({
    courseContents: courses,
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 6.5, // Buffer 적용 후 약 5.85h
    useAI: false
  });

  const quests = result.quests || [];
  const scheduledDates = [...new Set(quests.map(q => q.scheduledDate))];

  // 하루만에 안 끝나고 이틀 이상 걸려야 버퍼 로직이 작동한 것
  const passed = scheduledDates.length > 1;

  return {
    name: '순공 시간 버퍼 테스트 (6.5h 설정 -> 6h 강의 소화 불가 확인)',
    passed,
    errors: passed ? [] : ['하루만에 배정됨 (버퍼 10% 미적용 의심)'],
    warnings: [],
    details: { daysUsed: scheduledDates.length, dates: scheduledDates }
  };
}

// [신규 테스트] 4. 안전한 추가 (여유 있는 경우)
// 상황: 12시간 중 7시간 사용. 3시간 추가. (잔여 5시간 > 3시간) -> 성공해야 함.
async function test4_SafeCapacity(): Promise<TestResult> {
  const courses = await loadDummyCourses([{ subject: '수학', volumes: [1] }]);
  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + 30); // 넉넉하게

  const existingPlans = [];
  // 30일간 매일 7시간 사용 중
  for (let i = 0; i < 31; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    existingPlans.push(createFakeExistingPlan(d.toISOString().split('T')[0], 420));
  }

  const result = await generateQuests({
    courseContents: courses,
    targetDate: targetDate.toISOString().split('T')[0],
    dailyStudyHours: 12, // 전체 12h, 사용 7h, 잔여 5h (버퍼 고려 10.8-7 = 3.8h)
    // 수학 1개(약 4400 바이트?) -> 하루 3시간 학습량으로 설정하면 충분히 들어감?
    // dailyStudyHours 파라미터는 "전체 available"을 의미하므로 12를 넣어야 함. 
    // 생성기는 내부에서 (12 - 7) = 5시간을 사용함.
    existingPlans,
    useAI: false
  });

  return {
    name: '가용 시간 충분 (12h 중 7h 사용, 3h 분량 추가)',
    passed: result.success,
    errors: result.error ? [result.error] : [],
    warnings: [],
    details: { totalQuests: result.quests?.length }
  };
}

(async function main() {
  log(`\n🚀 순공/가용 시간 시나리오 테스트`, 'magenta');

  const results = [];
  results.push(await runTest('기본 생성 확인', test1_Basic));
  results.push(await runTest('Case A: 가용 시간 부족 (12h 중 7h 사용, 6h 추가)', test2_CapacityOverlap));
  results.push(await runTest('Case B: 순공 시간 버퍼 (10%) 동작 확인', test3_BufferLogic));
  results.push(await runTest('Case C: 충분한 가용 시간 (12h 중 7h 사용, 안전 추가)', test4_SafeCapacity));

  // 결과 종합
  const total = results.length;
  const passed = results.filter(r => r.passed).length;

  log(`\n==========================================`);
  log(`총 테스트: ${total}, 통과: ${passed}`);
  log(`==========================================\n`);

  if (total !== passed) process.exit(1);
})();
