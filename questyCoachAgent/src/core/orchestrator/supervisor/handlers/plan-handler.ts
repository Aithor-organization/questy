/**
 * 플랜 관련 핸들러
 * - AI 플랜 생성
 * - 플랜 리뷰
 * - 통합 생성 + 리뷰
 */

import type {
  Subject,
  AnalyzedUnit,
  DetectedStudyPlan,
  PlanPerformanceMemory,
  AIGeneratedQuest,
  ReviewPatternMemory,
} from '../../../../types/memory.js';
import type { PlannerAgent, AnalystAgent, DualPlanResult, ExtendedPlanReview } from '../../../agents/index.js';

/**
 * AI 기반 플랜 생성 (목차 분석 결과 활용)
 */
export async function generatePlanFromAnalysis(
  request: {
    studentId: string;
    materialName: string;
    analyzedUnits: AnalyzedUnit[];
    detectedStudyPlan?: DetectedStudyPlan;
    targetDays: number;
    bookMetadata?: {
      subject?: string;
      targetGrade?: string;
      bookType?: string;
    };
  },
  plannerAgent: PlannerAgent
): Promise<DualPlanResult> {
  console.log(`[PlanHandler] Delegating plan generation for ${request.studentId}`);
  return plannerAgent.generatePlanFromAnalysis(request);
}

/**
 * 플랜 성과 기록 (진화 학습용)
 */
export async function recordPlanPerformance(
  performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>,
  plannerAgent: PlannerAgent
): Promise<void> {
  console.log(`[PlanHandler] Recording plan performance for ${performance.planId}`);
  return plannerAgent.recordPlanPerformance(performance);
}

/**
 * AI 플랜 리뷰 (진화 학습 포함)
 */
export async function reviewPlan(
  request: {
    materialName: string;
    planName: string;
    dailyQuests: AIGeneratedQuest[];
    totalDays: number;
    totalEstimatedHours: number;
    subject?: Subject;
  },
  analystAgent: AnalystAgent
): Promise<ExtendedPlanReview> {
  console.log(`[PlanHandler] Delegating plan review for ${request.planName}`);
  return analystAgent.reviewPlan(request);
}

/**
 * 리뷰 패턴 성공/실패 기록 (진화 학습용)
 */
export async function recordReviewPatternOutcome(
  patternId: string,
  success: boolean,
  feedback: string | undefined,
  analystAgent: AnalystAgent
): Promise<void> {
  console.log(`[PlanHandler] Recording pattern outcome for ${patternId}: ${success}`);
  return analystAgent.recordPatternOutcome(patternId, success, feedback);
}

/**
 * 새로운 리뷰 패턴 생성 (학습)
 */
export async function createReviewPattern(
  pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>,
  analystAgent: AnalystAgent
): Promise<string> {
  console.log(`[PlanHandler] Creating new review pattern: ${pattern.patternName}`);
  return analystAgent.createReviewPattern(pattern);
}

/**
 * 플랜 생성 및 자동 리뷰
 */
export async function generateAndReviewPlan(
  request: {
    studentId: string;
    materialName: string;
    analyzedUnits: AnalyzedUnit[];
    detectedStudyPlan?: DetectedStudyPlan;
    targetDays: number;
    bookMetadata?: {
      subject?: string;
      targetGrade?: string;
      bookType?: string;
    };
  },
  plannerAgent: PlannerAgent,
  analystAgent: AnalystAgent
) {
  console.log(`[PlanHandler] Starting integrated plan generation and review for ${request.studentId}`);

  // 1. 플랜 생성
  const planResult = await generatePlanFromAnalysis(request, plannerAgent);

  // 2. 각 플랜에 대해 리뷰 수행
  const reviewedPlans = await Promise.all(
    planResult.plans.map(async (plan) => {
      const review = await reviewPlan({
        materialName: request.materialName,
        planName: plan.planName,
        dailyQuests: plan.dailyQuests,
        totalDays: plan.totalDays,
        totalEstimatedHours: plan.totalEstimatedHours,
        subject: request.bookMetadata?.subject as Subject | undefined,
      }, analystAgent);

      return {
        plan,
        review,
      };
    })
  );

  console.log(`[PlanHandler] Completed integrated generation: ${reviewedPlans.length} plans reviewed`);

  return {
    hasOriginalPlan: planResult.hasOriginalPlan,
    reviewedPlans,
    recommendations: planResult.recommendations,
    message: planResult.message,
  };
}
