/**
 * 플랜 통계 계산 및 위험 평가
 */

import type { AIGeneratedQuest } from '../../../../types/memory.js';
import type { PlanStats, ExtendedPlanReview } from '../types.js';

/**
 * 플랜 통계 계산
 */
export function calculatePlanStats(dailyQuests: AIGeneratedQuest[], totalDays: number): PlanStats {
  const totalMinutes = dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
  const avgMinutes = Math.round(totalMinutes / totalDays);

  // 단원별 분포
  const unitCounts = dailyQuests.reduce((acc, q) => {
    acc[q.unitNumber] = (acc[q.unitNumber] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // 일별 학습량 분포
  const dailyMinutes = dailyQuests.map(q => q.estimatedMinutes);
  const maxDailyMinutes = Math.max(...dailyMinutes);
  const minDailyMinutes = Math.min(...dailyMinutes);

  // 오버로드 일차 (평균의 1.5배 이상)
  const overloadThreshold = avgMinutes * 1.5;
  const overloadDays = dailyQuests
    .filter(q => q.estimatedMinutes > overloadThreshold)
    .map(q => q.day);

  return {
    totalMinutes,
    avgMinutes,
    maxDailyMinutes,
    minDailyMinutes,
    unitCounts,
    overloadDays,
    daysWithRest: dailyQuests.filter(q => q.estimatedMinutes < 30).length,
  };
}

/**
 * 위험 요소 평가
 */
export function assessRisks(
  dailyQuests: AIGeneratedQuest[],
  stats: PlanStats
): ExtendedPlanReview['riskAssessment'] {
  // 번아웃 위험: 평균 학습 시간 기반
  let burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (stats.avgMinutes > 90) {
    burnoutRisk = 'HIGH';
  } else if (stats.avgMinutes > 60) {
    burnoutRisk = 'MEDIUM';
  }

  // 이탈 위험: 오버로드 일차 수 기반
  let dropOffRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  const overloadRatio = stats.overloadDays.length / dailyQuests.length;
  if (overloadRatio > 0.3) {
    dropOffRisk = 'HIGH';
  } else if (overloadRatio > 0.15) {
    dropOffRisk = 'MEDIUM';
  }

  // 휴식일 부족 시 위험 증가
  if (dailyQuests.length > 14 && stats.daysWithRest === 0) {
    burnoutRisk = burnoutRisk === 'LOW' ? 'MEDIUM' : 'HIGH';
  }

  return {
    burnoutRisk,
    dropOffRisk,
    overloadDays: stats.overloadDays,
  };
}
