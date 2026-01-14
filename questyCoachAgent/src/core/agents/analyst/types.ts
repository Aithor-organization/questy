/**
 * AnalystAgent 타입 정의
 */

import type { Subject, AIGeneratedQuest, PlanReview } from '../../../types/memory.js';

// 분석 유형
export type AnalysisType =
  | 'PROGRESS'
  | 'WEAKNESS'
  | 'PATTERN'
  | 'COMPARISON'
  | 'OVERALL'
  | 'PLAN_REVIEW';

// 플랜 리뷰 요청
export interface PlanReviewRequest {
  materialName: string;
  planName: string;
  dailyQuests: AIGeneratedQuest[];
  totalDays: number;
  totalEstimatedHours: number;
  subject?: Subject;
}

// 확장된 플랜 리뷰 (위험 평가 + 적용 패턴 포함)
export interface ExtendedPlanReview extends PlanReview {
  riskAssessment: {
    burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    dropOffRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overloadDays: number[];
  };
  appliedPatterns: string[];
}

// 플랜 통계
export interface PlanStats {
  totalMinutes: number;
  avgMinutes: number;
  maxDailyMinutes: number;
  minDailyMinutes: number;
  unitCounts: Record<number, number>;
  overloadDays: number[];
  daysWithRest: number;
}
