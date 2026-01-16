/**
 * 강좌 배치 업데이트 스크립트
 * GitHub Actions에서 매주 실행되어 모든 강좌의 커리큘럼을 최신 상태로 업데이트
 *
 * 사용법:
 *   npx tsx scripts/batch-update.ts
 *
 * 환경변수:
 *   SUPABASE_URL - Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_KEY - Supabase 서비스 키 (service_role)
 *   BATCH_SIZE - 배치 크기 (기본: 5)
 *   BATCH_DELAY - 배치 간 대기 시간 ms (기본: 3000)
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// 환경변수 & 설정
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const BATCH_DELAY = parseInt(process.env.BATCH_DELAY || '3000', 10);
const REQUEST_DELAY = 1500; // 요청 간 딜레이 (ms)

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// 로거
// ============================================

const log = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  warn: (msg: string) => console.log(`[${new Date().toISOString()}] ⚠️  ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
};

// ============================================
// 크롤러 유틸리티 (간소화 버전)
// ============================================

// iconv-lite 동적 import (ESM 호환)
let iconv: typeof import('iconv-lite') | null = null;

async function loadIconv() {
  if (!iconv) {
    iconv = await import('iconv-lite');
  }
  return iconv;
}

/**
 * EUC-KR 인코딩 페이지 fetch
 */
async function fetchHtmlEucKr(url: string, retries = 3): Promise<string | null> {
  const iconvLib = await loadIconv();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(REQUEST_DELAY + Math.random() * 500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return iconvLib.decode(Buffer.from(buffer), 'euc-kr');

    } catch (error) {
      log.warn(`Attempt ${attempt + 1}/${retries} failed for ${url}: ${error}`);
      await delay(2000 * (attempt + 1));
    }
  }

  return null;
}

/**
 * JSON API fetch (미맥용)
 */
async function fetchJson(url: string, body?: Record<string, string>): Promise<unknown | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await delay(REQUEST_DELAY + Math.random() * 500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: body ? new URLSearchParams(body).toString() : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      log.warn(`JSON fetch attempt ${attempt + 1}/3 failed: ${error}`);
      await delay(2000 * (attempt + 1));
    }
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 플랫폼별 크롤링 로직
// ============================================

/**
 * 플랫폼 감지
 */
function detectPlatform(url: string): 'megastudy' | 'mimac' {
  if (url.includes('mimacstudy.com')) return 'mimac';
  return 'megastudy';
}

/**
 * 메가스터디 크롤링
 */
async function crawlMegastudy(url: string): Promise<CrawlResult> {
  try {
    const html = await fetchHtmlEucKr(url);
    if (!html) {
      return { success: false, error: 'Failed to fetch HTML' };
    }

    // 간단한 파싱 (cheerio 없이)
    const titleMatch = html.match(/<h3[^>]*class="[^"]*tit[^"]*"[^>]*>([^<]+)<\/h3>/i)
      || html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // 강의 목록 파싱 (li 태그에서 추출)
    const curriculum: string[] = [];
    const lecturePattern = /<li[^>]*>[\s\S]*?<span[^>]*class="[^"]*num[^"]*"[^>]*>(\d+)<\/span>[\s\S]*?<span[^>]*class="[^"]*tit[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?(?:<span[^>]*class="[^"]*time[^"]*"[^>]*>([^<]*)<\/span>)?/gi;
    let match;
    while ((match = lecturePattern.exec(html)) !== null) {
      const num = match[1];
      const lecTitle = match[2].trim();
      const duration = match[3]?.trim() || '';
      curriculum.push(`${num}. ${lecTitle}${duration ? ` (${duration})` : ''}`);
    }

    // 완강 여부 체크
    const isCompleted = /완강|종강|마감/i.test(html);

    return {
      success: true,
      title,
      curriculum,
      isCompleted,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * 미맥 크롤링
 */
async function crawlMimac(url: string): Promise<CrawlResult> {
  try {
    const html = await fetchHtmlEucKr(url);
    if (!html) {
      return { success: false, error: 'Failed to fetch HTML' };
    }

    // pid 추출
    const pidMatch = url.match(/pid=([A-Z]+\d+)/) || html.match(/pid['"]\s*:\s*['"]([A-Z]+\d+)['"]/);
    const pid = pidMatch ? pidMatch[1] : null;

    // 제목 파싱
    const titleMatch = html.match(/<h3[^>]*class="[^"]*tit[^"]*"[^>]*>([^<]+)<\/h3>/i)
      || html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // 커리큘럼 API 호출
    let curriculum: string[] = [];
    if (pid) {
      const data = await fetchJson('https://www.mimacstudy.com/tcher/lctr/crclmList.ds', { pid });
      if (data && Array.isArray((data as any).crclmList)) {
        curriculum = (data as any).crclmList.map((item: any, idx: number) => {
          const num = item.crclmOrd || idx + 1;
          const lecTitle = item.crclmNm || item.title || '';
          const duration = item.crclmTm || '';
          return `${num}. ${lecTitle}${duration ? ` (${duration})` : ''}`;
        });
      }
    }

    // 완강 여부 체크
    const isCompleted = /완강|종강|마감/i.test(html) ||
      curriculum.some(c => /완강|종강|마감/.test(c));

    return {
      success: true,
      title,
      curriculum,
      isCompleted,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

interface CrawlResult {
  success: boolean;
  title?: string;
  curriculum?: string[];
  isCompleted?: boolean;
  error?: string;
}

/**
 * URL로 크롤링 (플랫폼 자동 감지)
 */
async function crawlUrl(url: string): Promise<CrawlResult> {
  const platform = detectPlatform(url);

  if (platform === 'mimac') {
    return crawlMimac(url);
  }
  return crawlMegastudy(url);
}

// ============================================
// 배치 업데이트 메인 로직
// ============================================

interface Course {
  id: string;
  name: string;
  url: string;
  teacher_name: string;
  lecture_count: number;
  is_completed: boolean;
}

/**
 * 커리큘럼 문자열 파싱
 */
function parseCurriculumItem(item: string, idx: number): { num: string; title: string; duration: string } {
  const match = item.match(/^(\d+)\.\s*(.+?)(?:\s+\(([^)]+)\))?$/);
  if (match) {
    return {
      num: match[1],
      title: match[2].trim(),
      duration: match[3] || '',
    };
  }
  return { num: String(idx + 1), title: item, duration: '' };
}

/**
 * 메인 배치 업데이트 함수
 */
async function runBatchUpdate() {
  log.info('='.repeat(50));
  log.info('강좌 배치 업데이트 시작');
  log.info(`배치 크기: ${BATCH_SIZE}, 배치 딜레이: ${BATCH_DELAY}ms`);
  log.info('='.repeat(50));

  // 1. 업데이트 대상 강좌 조회
  log.info('Supabase에서 강좌 목록 조회 중...');

  const { data: courses, error: fetchError } = await supabase
    .from('courses')
    .select('id, name, url, teacher_name, lecture_count, is_completed')
    .not('url', 'is', null)
    .eq('is_completed', false)
    .order('teacher_name');

  if (fetchError) {
    log.error(`강좌 조회 실패: ${fetchError.message}`);
    process.exit(1);
  }

  const coursesToUpdate = (courses || []) as Course[];
  const total = coursesToUpdate.length;

  log.info(`업데이트 대상: ${total}개 강좌`);

  if (total === 0) {
    log.success('업데이트할 강좌가 없습니다.');
    return;
  }

  // 2. 배치 처리
  let completed = 0;
  let updated = 0;
  let failed = 0;

  // 업데이트 상세 기록
  const updateDetails: { name: string; teacher: string; diff: number; newCount: number; isCompleted: boolean }[] = [];
  const failedCourses: { name: string; teacher: string; error: string }[] = [];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = coursesToUpdate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    log.info(`\n📦 배치 ${batchNum}/${totalBatches} 처리 중 (${batch.length}개)...`);

    // 배치 내 병렬 처리
    const results = await Promise.allSettled(
      batch.map(async (course) => {
        const prevCount = course.lecture_count || 0;

        try {
          const result = await crawlUrl(course.url);

          if (!result.success) {
            return { course, success: false, error: result.error };
          }

          // 커리큘럼 파싱
          const lectures = result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || [];

          // Supabase 업데이트
          const { error: updateError } = await supabase
            .from('courses')
            .update({
              lectures,
              lecture_count: lectures.length,
              is_completed: result.isCompleted || false,
              last_crawled_at: new Date().toISOString(),
            })
            .eq('id', course.id);

          if (updateError) {
            return { course, success: false, error: updateError.message };
          }

          const diff = lectures.length - prevCount;
          return {
            course,
            success: true,
            diff,
            isCompleted: result.isCompleted,
          };

        } catch (err) {
          return { course, success: false, error: String(err) };
        }
      })
    );

    // 결과 처리
    for (const result of results) {
      completed++;

      if (result.status === 'fulfilled') {
        const { course, success, diff, isCompleted, error } = result.value;

        if (success) {
          updated++;
          const diffStr = diff !== undefined ? (diff > 0 ? `+${diff}` : diff === 0 ? '±0' : `${diff}`) : '';
          const completedStr = isCompleted ? ' [완강]' : '';
          log.success(`[${completed}/${total}] ${course.name} (${course.teacher_name}) ${diffStr}${completedStr}`);

          // 상세 기록 저장
          if (diff !== undefined) {
            updateDetails.push({
              name: course.name,
              teacher: course.teacher_name,
              diff,
              newCount: course.lecture_count + diff,
              isCompleted: isCompleted || false,
            });
          }
        } else {
          failed++;
          log.error(`[${completed}/${total}] ${course.name} - ${error}`);
          failedCourses.push({ name: course.name, teacher: course.teacher_name, error: error || 'Unknown error' });
        }
      } else {
        failed++;
        log.error(`[${completed}/${total}] 처리 실패: ${result.reason}`);
      }
    }

    // 배치 간 딜레이
    if (i + BATCH_SIZE < total) {
      log.info(`⏳ 다음 배치까지 ${BATCH_DELAY / 1000}초 대기...`);
      await delay(BATCH_DELAY);
    }
  }

  // 3. 결과 요약
  log.info('\n' + '='.repeat(50));
  log.info('📊 배치 업데이트 완료');
  log.info('='.repeat(50));
  log.info(`총 처리: ${total}개`);
  log.success(`성공: ${updated}개`);
  if (failed > 0) {
    log.error(`실패: ${failed}개`);
  }

  // 새 강의 추가된 강좌
  const coursesWithNewLectures = updateDetails.filter(d => d.diff > 0);
  if (coursesWithNewLectures.length > 0) {
    log.info('\n📚 새 강의가 추가된 강좌:');
    coursesWithNewLectures.forEach(d => {
      log.info(`  • ${d.name} (${d.teacher}) - +${d.diff}개 (총 ${d.newCount}강)`);
    });
  }

  // 완강된 강좌
  const completedCourses = updateDetails.filter(d => d.isCompleted);
  if (completedCourses.length > 0) {
    log.info('\n🎉 완강 처리된 강좌:');
    completedCourses.forEach(d => {
      log.info(`  • ${d.name} (${d.teacher}) - 총 ${d.newCount}강`);
    });
  }

  // 변경 없는 강좌 수
  const noChangeCourses = updateDetails.filter(d => d.diff === 0 && !d.isCompleted);
  if (noChangeCourses.length > 0) {
    log.info(`\n📋 변경 없음: ${noChangeCourses.length}개 강좌`);
  }

  // 실패한 강좌
  if (failedCourses.length > 0) {
    log.info('\n❌ 실패한 강좌:');
    failedCourses.forEach(d => {
      log.error(`  • ${d.name} (${d.teacher}) - ${d.error}`);
    });
  }

  log.info('\n' + '='.repeat(50));

  // 실패가 있으면 exit code 1
  if (failed > 0) {
    process.exit(1);
  }
}

// 실행
runBatchUpdate().catch((err) => {
  log.error(`치명적 오류: ${err}`);
  process.exit(1);
});
