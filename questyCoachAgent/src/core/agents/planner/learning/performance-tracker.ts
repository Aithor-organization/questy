/**
 * 학습 성과 추적 모듈
 * 과거 성과 학습 및 개인화 정보 생성
 */

import type { Subject, PlanPerformanceMemory, LearnedOptimalValues } from '../../../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';

// 성과 캐시 관리
const performanceCache = new Map<string, PlanPerformanceMemory[]>();
const optimalValuesCache = new Map<string, LearnedOptimalValues>();

/**
 * 과거 플랜 성과 로드 (Memory Lane)
 */
export async function loadPastPerformance(
  studentId: string,
  subject?: Subject
): Promise<PlanPerformanceMemory[]> {
  const cacheKey = `${studentId}-${subject || 'all'}`;
  if (performanceCache.has(cacheKey)) {
    return performanceCache.get(cacheKey)!;
  }

  // TODO: Memory Lane에서 실제 조회
  // const memories = await memoryLane.query({ type: 'PLAN_PERFORMANCE', studentId, subject });

  const performances: PlanPerformanceMemory[] = [];
  performanceCache.set(cacheKey, performances);
  return performances;
}

/**
 * 최적값 학습 (과거 성과 기반)
 */
export async function learnOptimalValues(
  studentId: string,
  performances: PlanPerformanceMemory[],
  subject?: Subject
): Promise<LearnedOptimalValues | null> {
  if (performances.length < 2) {
    return null; // 데이터 부족
  }

  const cacheKey = `${studentId}-${subject || 'all'}`;
  if (optimalValuesCache.has(cacheKey)) {
    return optimalValuesCache.get(cacheKey)!;
  }

  // 성공적인 플랜 분석 (완료율 70% 이상)
  const successfulPlans = performances.filter(p => p.completionRate >= 0.7);
  if (successfulPlans.length === 0) {
    return null;
  }

  // 최적값 계산
  const avgDailyMinutes = successfulPlans.reduce((sum, p) => sum + p.dailyMinutes, 0) / successfulPlans.length;
  const avgStudyTime = successfulPlans.reduce((sum, p) => sum + p.averageStudyTime, 0) / successfulPlans.length;

  // 이탈 위험 일차 분석
  const dropOffDays = performances.filter(p => p.dropOffDay).map(p => p.dropOffDay!);
  const commonDropOffDays = findCommonDropOffDays(dropOffDays);

  const optimal: LearnedOptimalValues = {
    studentId,
    subject: subject || 'GENERAL',
    optimalDailyMinutes: Math.round(avgDailyMinutes),
    optimalSessionLength: Math.round(avgStudyTime),
    preferredStudyHour: 20, // TODO: 실제 데이터에서 추출
    dropOffRiskDays: commonDropOffDays,
    fatigueThreshold: 90,
    dataPoints: performances.length,
    lastUpdated: new Date(),
  };

  optimalValuesCache.set(cacheKey, optimal);
  return optimal;
}

/**
 * 공통 이탈 일차 분석
 */
export function findCommonDropOffDays(dropOffDays: number[]): number[] {
  if (dropOffDays.length === 0) return [];

  const frequency: Record<number, number> = {};
  dropOffDays.forEach(day => {
    const bucket = Math.round(day / 5) * 5;
    frequency[bucket] = (frequency[bucket] || 0) + 1;
  });

  return Object.entries(frequency)
    .filter(([_, count]) => count >= 2)
    .map(([day]) => parseInt(day))
    .sort((a, b) => a - b);
}

/**
 * 개인화 정보 문자열 구성
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
    if (optimalValues.dropOffRiskDays.length > 0) {
      info += `- ⚠️ 이탈 위험 일차: ${optimalValues.dropOffRiskDays.join(', ')}일 (휴식일 권장)\n`;
    }
    info += `- 데이터 기반: ${optimalValues.dataPoints}개 과거 플랜\n`;
  }

  if (pastPerformance.length > 0) {
    const avgCompletion = pastPerformance.reduce((sum, p) => sum + p.completionRate, 0) / pastPerformance.length;
    info += `- 평균 플랜 완료율: ${(avgCompletion * 100).toFixed(0)}%\n`;

    const recentPlan = pastPerformance[pastPerformance.length - 1];
    info += `- 최근 플랜: ${recentPlan.materialName} (완료율 ${(recentPlan.completionRate * 100).toFixed(0)}%)\n`;
  }

  return info;
}

/**
 * 플랜 성과 기록 (진화 학습용)
 */
export async function recordPlanPerformance(
  performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
): Promise<void> {
  const record: PlanPerformanceMemory = {
    ...performance,
    id: uuidv4(),
    type: 'PLAN_PERFORMANCE',
    createdAt: new Date(),
  };

  console.log(`[PerformanceTracker] Recording performance for plan ${record.planId}: ${(record.completionRate * 100).toFixed(0)}% completion`);

  // TODO: Memory Lane에 저장
  // await memoryLane.store(record);

  // 캐시 무효화
  const cacheKey = `${record.studentId}-${record.subject}`;
  performanceCache.delete(cacheKey);
  optimalValuesCache.delete(cacheKey);
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  performanceCache.clear();
  optimalValuesCache.clear();
}
