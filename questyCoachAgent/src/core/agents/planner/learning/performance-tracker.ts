/**
 * 학습 성과 추적 모듈
 * 과거 성과 학습 및 개인화 정보 생성
 *
 * Supabase plan_performance 테이블과 연동
 */

import type { Subject, PlanPerformanceMemory, LearnedOptimalValues } from '../../../../types/memory.js';
import {
  fetchPastPerformance,
  calculateOptimalValues,
  storePlanPerformance,
} from './supabase-performance-client.js';

// 성과 캐시 관리 (빠른 조회용)
const performanceCache = new Map<string, PlanPerformanceMemory[]>();
const optimalValuesCache = new Map<string, LearnedOptimalValues>();

// 캐시 TTL (5분)
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

/**
 * 캐시 유효성 확인
 */
function isCacheValid(cacheKey: string): boolean {
  const timestamp = cacheTimestamps.get(cacheKey);
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL_MS;
}

/**
 * 과거 플랜 성과 로드 (Supabase 연동)
 */
export async function loadPastPerformance(
  studentId: string,
  subject?: Subject
): Promise<PlanPerformanceMemory[]> {
  const cacheKey = `${studentId}-${subject || 'all'}`;

  // 캐시 확인
  if (performanceCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return performanceCache.get(cacheKey)!;
  }

  // Supabase에서 조회
  const performances = await fetchPastPerformance(studentId, subject);

  // 캐시 업데이트
  performanceCache.set(cacheKey, performances);
  cacheTimestamps.set(cacheKey, Date.now());

  console.log(`[PerformanceTracker] Loaded ${performances.length} past performances for student ${studentId}`);
  return performances;
}

/**
 * 최적값 학습 (과거 성과 기반, Supabase 연동)
 */
export async function learnOptimalValues(
  studentId: string,
  performances: PlanPerformanceMemory[],
  subject?: Subject
): Promise<LearnedOptimalValues | null> {
  // 성과 데이터가 부족하면 null 반환
  if (performances.length < 2) {
    console.log(`[PerformanceTracker] Insufficient data for student ${studentId} (${performances.length} records)`);
    return null;
  }

  const cacheKey = `optimal-${studentId}-${subject || 'all'}`;

  // 캐시 확인
  if (optimalValuesCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return optimalValuesCache.get(cacheKey)!;
  }

  // Supabase에서 최적값 계산
  const optimalValues = await calculateOptimalValues(studentId, subject);

  if (optimalValues) {
    // 캐시 업데이트
    optimalValuesCache.set(cacheKey, optimalValues);
    cacheTimestamps.set(cacheKey, Date.now());

    console.log(`[PerformanceTracker] Learned optimal values for student ${studentId}:`, {
      dailyMinutes: optimalValues.optimalDailyMinutes,
      sessionLength: optimalValues.optimalSessionLength,
      dropOffRiskDays: optimalValues.dropOffRiskDays,
      dataPoints: optimalValues.dataPoints,
    });
  }

  return optimalValues;
}

/**
 * 공통 이탈 일차 분석 (로컬 계산용)
 */
export function findCommonDropOffDays(dropOffDays: number[]): number[] {
  if (dropOffDays.length === 0) return [];

  const frequency: Record<number, number> = {};
  dropOffDays.forEach(day => {
    const bucket = Math.round(day / 5) * 5; // 5일 단위 버킷팅
    frequency[bucket] = (frequency[bucket] || 0) + 1;
  });

  // 2회 이상 발생한 일차만 반환
  return Object.entries(frequency)
    .filter(([_, count]) => count >= 2)
    .map(([day]) => parseInt(day))
    .sort((a, b) => a - b);
}

/**
 * 개인화 정보 문자열 구성 (프롬프트 주입용)
 */
export function buildPersonalizationInfo(
  optimalValues: LearnedOptimalValues | null,
  pastPerformance: PlanPerformanceMemory[]
): string {
  if (!optimalValues && pastPerformance.length === 0) {
    return '## 개인화 정보\n신규 학생입니다. 기본 설정을 사용합니다.';
  }

  let info = '## 개인화 정보 (과거 학습 기반)\n';

  if (optimalValues) {
    info += `- 학습된 최적 일일 학습 시간: ${optimalValues.optimalDailyMinutes}분\n`;
    info += `- 최적 세션 길이: ${optimalValues.optimalSessionLength}분\n`;
    info += `- 선호 학습 시간대: ${optimalValues.preferredStudyHour}시\n`;
    if (optimalValues.dropOffRiskDays.length > 0) {
      info += `- ⚠️ 이탈 위험 일차: ${optimalValues.dropOffRiskDays.join(', ')}일 (휴식일 권장)\n`;
    }
    info += `- 데이터 기반: ${optimalValues.dataPoints}개 과거 플랜\n`;
  }

  if (pastPerformance.length > 0) {
    const avgCompletion = pastPerformance.reduce((sum, p) => sum + p.completionRate, 0) / pastPerformance.length;
    info += `- 평균 플랜 완료율: ${(avgCompletion * 100).toFixed(0)}%\n`;

    // 최근 플랜 정보 (가장 최신)
    const recentPlan = pastPerformance[0]; // fetchPastPerformance는 최신순 정렬
    info += `- 최근 플랜: ${recentPlan.materialName} (완료율 ${(recentPlan.completionRate * 100).toFixed(0)}%)\n`;

    // 난이도 인식 통계
    const perceptions = pastPerformance.map(p => p.difficultyPerception).filter(d => d !== 'UNKNOWN');
    if (perceptions.length > 0) {
      const tooHard = perceptions.filter(d => d === 'TOO_HARD').length;
      const tooEasy = perceptions.filter(d => d === 'TOO_EASY').length;
      if (tooHard > tooEasy) {
        info += `- 💡 학생 피드백: 난이도가 높다고 느끼는 경향\n`;
      } else if (tooEasy > tooHard) {
        info += `- 💡 학생 피드백: 난이도가 낮다고 느끼는 경향\n`;
      }
    }
  }

  return info;
}

/**
 * 플랜 성과 기록 (Supabase 저장)
 */
export async function recordPlanPerformance(
  performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
): Promise<string> {
  console.log(`[PerformanceTracker] Recording performance for plan ${performance.planId}: ${(performance.completionRate * 100).toFixed(0)}% completion`);

  // Supabase에 저장
  const performanceId = await storePlanPerformance(performance);

  // 캐시 무효화
  const cacheKey = `${performance.studentId}-${performance.subject}`;
  const allCacheKey = `${performance.studentId}-all`;
  const optimalCacheKey = `optimal-${performance.studentId}-${performance.subject}`;
  const optimalAllCacheKey = `optimal-${performance.studentId}-all`;

  performanceCache.delete(cacheKey);
  performanceCache.delete(allCacheKey);
  optimalValuesCache.delete(optimalCacheKey);
  optimalValuesCache.delete(optimalAllCacheKey);
  cacheTimestamps.delete(cacheKey);
  cacheTimestamps.delete(allCacheKey);
  cacheTimestamps.delete(optimalCacheKey);
  cacheTimestamps.delete(optimalAllCacheKey);

  console.log(`[PerformanceTracker] Performance recorded with ID: ${performanceId}`);
  return performanceId;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  performanceCache.clear();
  optimalValuesCache.clear();
  cacheTimestamps.clear();
}

/**
 * 캐시 통계 (디버깅용)
 */
export function getCacheStats(): {
  performanceCacheSize: number;
  optimalValuesCacheSize: number;
  cacheEntries: string[];
} {
  return {
    performanceCacheSize: performanceCache.size,
    optimalValuesCacheSize: optimalValuesCache.size,
    cacheEntries: Array.from(cacheTimestamps.keys()),
  };
}
