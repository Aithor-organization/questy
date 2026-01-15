/**
 * 리뷰 패턴 관리 모듈
 * - Supabase 기반 패턴 저장/조회
 * - 학습된 패턴 적용
 * - 패턴 결과 기록 (진화 학습)
 */

import type { Subject, ReviewPatternMemory } from '../../../../types/memory.js';
import type { PlanStats } from '../types.js';
import {
  fetchPatterns,
  updatePatternOutcome,
  createPattern,
} from './supabase-pattern-client.js';

// 리뷰 패턴 캐시
const reviewPatternCache = new Map<string, ReviewPatternMemory[]>();

/**
 * 리뷰 패턴 로드 (Supabase)
 */
export async function loadReviewPatterns(subject?: Subject): Promise<ReviewPatternMemory[]> {
  const cacheKey = subject || 'all';
  if (reviewPatternCache.has(cacheKey)) {
    return reviewPatternCache.get(cacheKey)!;
  }

  // Supabase에서 패턴 조회
  const patterns = await fetchPatterns(subject);
  reviewPatternCache.set(cacheKey, patterns);
  return patterns;
}

/**
 * 학습된 패턴 적용
 */
export function applyLearnedPatterns(
  patterns: ReviewPatternMemory[],
  stats: PlanStats,
  subject?: Subject
): { improvements: string[]; appliedPatternIds: string[] } {
  const improvements: string[] = [];
  const appliedPatternIds: string[] = [];

  for (const pattern of patterns) {
    // 신뢰도 낮은 패턴 스킵
    if (pattern.confidence < 0.6) continue;

    const conditions = pattern.triggerConditions;
    let triggered = false;

    // 조건 확인
    if (conditions.dailyMinutes?.min && stats.avgMinutes >= conditions.dailyMinutes.min) {
      triggered = true;
    }
    if (conditions.dailyMinutes?.max && stats.avgMinutes <= conditions.dailyMinutes.max) {
      triggered = true;
    }
    if (conditions.planDuration?.min && stats.totalMinutes / 60 >= conditions.planDuration.min) {
      const estimatedDays = stats.totalMinutes / stats.avgMinutes;
      if (estimatedDays >= conditions.planDuration.min) {
        triggered = true;
      }
    }
    if (conditions.subject && subject && !conditions.subject.includes(subject)) {
      triggered = false;
    }

    if (triggered) {
      const successRate = (pattern.successfulFixCount / (pattern.successfulFixCount + pattern.failedFixCount)) * 100;
      improvements.push(`💡 ${pattern.suggestedFix} (성공률: ${successRate.toFixed(0)}%)`);
      appliedPatternIds.push(pattern.id);
    }
  }

  return { improvements, appliedPatternIds };
}

/**
 * 리뷰 패턴 성공/실패 기록 (진화 학습용)
 */
export async function recordPatternOutcome(
  patternId: string,
  success: boolean,
  _feedback?: string
): Promise<void> {
  console.log(`[PatternManager] Recording pattern outcome: ${patternId} - ${success ? 'success' : 'failure'}`);

  // Supabase에 업데이트
  await updatePatternOutcome(patternId, success);

  // 캐시 무효화
  reviewPatternCache.clear();
}

/**
 * 새로운 리뷰 패턴 생성 (학습)
 */
export async function createReviewPattern(
  pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>
): Promise<string> {
  console.log(`[PatternManager] Creating new review pattern: ${pattern.patternName}`);

  // Supabase에 저장
  const patternId = await createPattern(pattern);

  // 캐시 무효화
  reviewPatternCache.clear();

  return patternId;
}

/**
 * 캐시 초기화
 */
export function clearPatternCache(): void {
  reviewPatternCache.clear();
}
