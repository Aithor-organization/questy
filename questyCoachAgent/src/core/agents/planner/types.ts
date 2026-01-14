/**
 * PlannerAgent 타입 정의
 * 플랜 생성 및 조정에 사용되는 인터페이스
 */

import type { AnalyzedUnit, DetectedStudyPlan, AIGeneratedQuest } from '../../../types/memory.js';

// 요청 유형 분류
export type PlanRequestType =
  | 'CREATE_PLAN'
  | 'ADJUST_PLAN'
  | 'CHECK_SCHEDULE'
  | 'RECOMMEND'
  | 'GENERATE_FROM_IMAGE'
  | 'GENERAL';

// AI 퀘스트 생성 결과
export interface AIQuestResult {
  dailyQuests: AIGeneratedQuest[];
  recommendations: AIRecommendation[];
  totalEstimatedHours: number;
  message: string;
}

// AI 추천 정보
export interface AIRecommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

// 듀얼 플랜 결과 (기존 플랜 + 새 플랜)
export interface DualPlanResult {
  hasOriginalPlan: boolean;
  plans: import('../../../types/memory.js').GeneratedPlan[];
  recommendations: AIRecommendation[];
  message: string;
}

// 플랜 생성 요청
export interface PlanGenerationRequest {
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
  excludeWeekends?: boolean;
  startDate?: string; // ISO date string (YYYY-MM-DD)
}

// 개인화 정보 (과거 성과 기반)
export interface PersonalizationInfo {
  avgCompletionRate: number;
  commonDropOffDays: number[];
  optimalSessionMinutes: number;
  preferredStudyTime?: string;
}
