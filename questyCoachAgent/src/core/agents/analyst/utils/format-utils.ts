/**
 * 분석 포맷팅 유틸리티
 */

import type { AnalysisType } from '../types.js';

/**
 * 진행 막대 생성
 */
export function createProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

/**
 * 숙달도 이모지
 */
export function getMasteryEmoji(score: number): string {
  if (score >= 8) return '🌟 훌륭해요!';
  if (score >= 6) return '👍 잘하고 있어요!';
  if (score >= 4) return '💪 조금만 더!';
  return '📚 함께 노력해봐요!';
}

/**
 * 취약 레벨 표시
 */
export function getWeaknessLevel(score: number): string {
  if (score < 2) return '🔴';
  if (score < 4) return '🟠';
  return '🟡';
}

/**
 * 메모리 유형 이모지
 */
export function getTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    CORRECTION: '🔄',
    DECISION: '📌',
    INSIGHT: '💡',
    PATTERN: '🔁',
    GAP: '⚠️',
    LEARNING: '📚',
    MASTERY: '✅',
    STRUGGLE: '😓',
    WRONG_ANSWER: '❌',
    STRATEGY: '🎯',
    PREFERENCE: '❤️',
    EMOTION: '💭',
    PLAN_PERFORMANCE: '📊',
    REVIEW_PATTERN: '🔍',
  };
  return emojis[type] ?? '📝';
}

/**
 * 후속 질문 생성
 */
export function generateFollowUps(analysisType: AnalysisType): string[] {
  const followUps: Record<AnalysisType, string[]> = {
    PROGRESS: ['더 자세한 분석이 필요해?', '진도 조정이 필요할까?'],
    WEAKNESS: ['취약 토픽 집중 학습할까?', '추천 복습 자료 줄까?'],
    PATTERN: ['패턴 개선 방법 알려줄까?', '효과적인 학습법 추천해줄까?'],
    COMPARISON: ['특정 과목 집중 분석할까?', '학습 계획 조정할까?'],
    OVERALL: ['어떤 부분 더 알고 싶어?', '개선 계획 세워볼까?'],
    PLAN_REVIEW: ['수정된 플랜을 원해?', '다른 플랜 옵션도 볼까?'],
  };

  return followUps[analysisType] ?? [];
}

/**
 * 요청 유형 분류
 */
export function classifyAnalysisRequest(message: string): AnalysisType {
  if (/플랜.*리뷰|계획.*분석|계획.*평가/.test(message)) return 'PLAN_REVIEW';
  if (/진도|진행|얼마나/.test(message)) return 'PROGRESS';
  if (/취약|약한|부족|못하는/.test(message)) return 'WEAKNESS';
  if (/패턴|습관|경향/.test(message)) return 'PATTERN';
  if (/비교|다른|평균/.test(message)) return 'COMPARISON';
  return 'OVERALL';
}
