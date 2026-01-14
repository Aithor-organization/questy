/**
 * 리뷰 패턴 관리 모듈
 * - 학습된 패턴 로드
 * - 패턴 적용
 * - 패턴 기록
 */

import { v4 as uuidv4 } from 'uuid';
import type { Subject, ReviewPatternMemory } from '../../../../types/memory.js';
import type { PlanStats } from '../types.js';

// 리뷰 패턴 캐시
const reviewPatternCache = new Map<string, ReviewPatternMemory[]>();

/**
 * 리뷰 패턴 로드 (Memory Lane)
 */
export async function loadReviewPatterns(subject?: Subject): Promise<ReviewPatternMemory[]> {
  const cacheKey = subject || 'all';
  if (reviewPatternCache.has(cacheKey)) {
    return reviewPatternCache.get(cacheKey)!;
  }

  // TODO: Memory Lane에서 실제 조회
  // 현재는 기본 패턴 반환
  const defaultPatterns: ReviewPatternMemory[] = [
    {
      id: 'RP-001',
      type: 'REVIEW_PATTERN',
      patternId: 'OVERLOAD_WARNING',
      patternName: '과부하 경고 패턴',
      description: '하루 학습량이 너무 많으면 이탈 위험',
      triggerConditions: { dailyMinutes: { min: 90 } },
      issueDescription: '하루 90분 이상 학습은 지속하기 어렵습니다',
      suggestedFix: '학습 기간을 늘리거나 하루 학습량을 60분 이하로 조정',
      successfulFixCount: 15,
      failedFixCount: 2,
      confidence: 0.88,
      validationScore: 0.85,
      createdAt: new Date('2024-01-01'),
      lastUsedAt: new Date(),
      usageCount: 17,
    },
    {
      id: 'RP-002',
      type: 'REVIEW_PATTERN',
      patternId: 'NO_REST_DAY',
      patternName: '휴식일 부재 패턴',
      description: '2주 이상 플랜에 휴식일이 없음',
      triggerConditions: { planDuration: { min: 14 } },
      issueDescription: '장기 플랜에 휴식일이 없으면 번아웃 위험',
      suggestedFix: '7일마다 가벼운 복습일 또는 휴식일 추가',
      successfulFixCount: 22,
      failedFixCount: 3,
      confidence: 0.88,
      validationScore: 0.9,
      createdAt: new Date('2024-01-15'),
      lastUsedAt: new Date(),
      usageCount: 25,
    },
    {
      id: 'RP-003',
      type: 'REVIEW_PATTERN',
      patternId: 'FRONT_LOADED',
      patternName: '초반 집중 패턴',
      description: '초반에 학습량이 몰려있음',
      triggerConditions: {},
      issueDescription: '초반 과다 학습은 조기 포기로 이어질 수 있습니다',
      suggestedFix: '학습량을 균등하게 분배하거나 점진적으로 증가',
      successfulFixCount: 8,
      failedFixCount: 4,
      confidence: 0.67,
      validationScore: 0.7,
      createdAt: new Date('2024-02-01'),
      lastUsedAt: new Date(),
      usageCount: 12,
    },
  ];

  reviewPatternCache.set(cacheKey, defaultPatterns);
  return defaultPatterns;
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

  // TODO: Memory Lane에 업데이트
  // 캐시 무효화
  reviewPatternCache.clear();
}

/**
 * 새로운 리뷰 패턴 생성 (학습)
 */
export async function createReviewPattern(
  pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>
): Promise<string> {
  const newPattern: ReviewPatternMemory = {
    ...pattern,
    id: uuidv4(),
    type: 'REVIEW_PATTERN',
    createdAt: new Date(),
    lastUsedAt: new Date(),
    usageCount: 0,
  };

  console.log(`[PatternManager] Creating new review pattern: ${newPattern.patternName}`);

  // TODO: Memory Lane에 저장
  // 캐시 무효화
  reviewPatternCache.clear();

  return newPattern.id;
}

/**
 * 캐시 초기화
 */
export function clearPatternCache(): void {
  reviewPatternCache.clear();
}
