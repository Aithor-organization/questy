/**
 * Plan Validation Utility
 * AI 응답 데이터 검증 및 안전한 기본값 제공
 */

import type { GeneratedPlan, GenerateResult, DailyQuest } from '../hooks/useQuestGeneration';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: GenerateResult;
}

/**
 * DailyQuest 데이터 검증
 */
function validateDailyQuest(quest: unknown, index: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!quest || typeof quest !== 'object') {
    errors.push(`퀘스트 ${index + 1}: 데이터가 없거나 잘못된 형식입니다`);
    return { isValid: false, errors };
  }

  const q = quest as Record<string, unknown>;

  // 필수 필드 검증
  if (typeof q.day !== 'number' || q.day < 1) {
    errors.push(`퀘스트 ${index + 1}: day 필드가 잘못되었습니다`);
  }

  if (typeof q.unitNumber !== 'number') {
    errors.push(`퀘스트 ${index + 1}: unitNumber 필드가 잘못되었습니다`);
  }

  if (typeof q.unitTitle !== 'string' || q.unitTitle.trim() === '') {
    errors.push(`퀘스트 ${index + 1}: unitTitle이 없습니다`);
  }

  if (typeof q.estimatedMinutes !== 'number' || q.estimatedMinutes < 0) {
    errors.push(`퀘스트 ${index + 1}: estimatedMinutes가 잘못되었습니다`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * GeneratedPlan 데이터 검증
 */
function validatePlan(plan: unknown, index: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!plan || typeof plan !== 'object') {
    errors.push(`플랜 ${index + 1}: 데이터가 없거나 잘못된 형식입니다`);
    return { isValid: false, errors };
  }

  const p = plan as Record<string, unknown>;

  // 필수 필드 검증
  if (typeof p.planName !== 'string' || p.planName.trim() === '') {
    errors.push(`플랜 ${index + 1}: planName이 없습니다`);
  }

  if (!Array.isArray(p.dailyQuests)) {
    errors.push(`플랜 ${index + 1}: dailyQuests가 배열이 아닙니다`);
    return { isValid: false, errors };
  }

  if (p.dailyQuests.length === 0) {
    errors.push(`플랜 ${index + 1}: dailyQuests가 비어있습니다`);
  }

  // 각 퀘스트 검증
  (p.dailyQuests as unknown[]).forEach((quest, qIndex) => {
    const questValidation = validateDailyQuest(quest, qIndex);
    errors.push(...questValidation.errors);
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * DailyQuest 데이터 정제 (기본값으로 채우기)
 */
function sanitizeDailyQuest(quest: unknown, index: number): DailyQuest {
  const q = (quest || {}) as Record<string, unknown>;

  return {
    day: typeof q.day === 'number' ? q.day : index + 1,
    date: typeof q.date === 'string' ? q.date : new Date().toISOString().split('T')[0],
    unitNumber: typeof q.unitNumber === 'number' ? q.unitNumber : index + 1,
    unitTitle: typeof q.unitTitle === 'string' ? q.unitTitle : `단원 ${index + 1}`,
    range: typeof q.range === 'string' ? q.range : '',
    estimatedMinutes: typeof q.estimatedMinutes === 'number' ? q.estimatedMinutes : 60,
    id: typeof q.id === 'string' ? q.id : undefined,
    tip: typeof q.tip === 'string' ? q.tip : undefined,
    topics: Array.isArray(q.topics) ? q.topics as string[] : undefined,
    pages: typeof q.pages === 'string' ? q.pages : undefined,
    objectives: Array.isArray(q.objectives) ? q.objectives as string[] : undefined,
  };
}

/**
 * GeneratedPlan 데이터 정제
 */
function sanitizePlan(plan: unknown, index: number): GeneratedPlan {
  const p = (plan || {}) as Record<string, unknown>;
  const dailyQuests = Array.isArray(p.dailyQuests)
    ? (p.dailyQuests as unknown[]).map((q, i) => sanitizeDailyQuest(q, i))
    : [];

  return {
    planType: p.planType === 'original' || p.planType === 'custom' ? p.planType : 'custom',
    planName: typeof p.planName === 'string' ? p.planName : `플랜 ${index + 1}`,
    description: typeof p.description === 'string' ? p.description : '학습 계획입니다.',
    dailyQuests,
    totalDays: typeof p.totalDays === 'number' ? p.totalDays : dailyQuests.length,
    totalEstimatedHours: typeof p.totalEstimatedHours === 'number'
      ? p.totalEstimatedHours
      : Math.round(dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0) / 60),
  };
}

/**
 * GenerateResult 전체 검증 및 정제
 */
export function validateGenerateResult(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['응답 데이터가 없거나 잘못된 형식입니다'],
    };
  }

  const d = data as Record<string, unknown>;

  // materialName 검증
  if (typeof d.materialName !== 'string' || d.materialName.trim() === '') {
    errors.push('materialName이 없습니다');
  }

  // plans 검증
  if (!Array.isArray(d.plans)) {
    return {
      isValid: false,
      errors: ['plans가 배열이 아닙니다'],
    };
  }

  if (d.plans.length === 0) {
    return {
      isValid: false,
      errors: ['생성된 플랜이 없습니다'],
    };
  }

  // 각 플랜 검증
  (d.plans as unknown[]).forEach((plan, index) => {
    const planValidation = validatePlan(plan, index);
    errors.push(...planValidation.errors);
  });

  // 정제된 데이터 생성
  const sanitizedData: GenerateResult = {
    materialName: typeof d.materialName === 'string' ? d.materialName : '학습 교재',
    hasOriginalPlan: typeof d.hasOriginalPlan === 'boolean' ? d.hasOriginalPlan : false,
    detectedStudyPlan: d.detectedStudyPlan as GenerateResult['detectedStudyPlan'] || null,
    plans: (d.plans as unknown[]).map((plan, index) => sanitizePlan(plan, index)),
    recommendations: Array.isArray(d.recommendations) ? d.recommendations as GenerateResult['recommendations'] : undefined,
    aiMessage: typeof d.aiMessage === 'string' ? d.aiMessage : undefined,
    analyzedUnits: Array.isArray(d.analyzedUnits) ? d.analyzedUnits as GenerateResult['analyzedUnits'] : undefined,
  };

  // 최종 검증: 최소 하나의 유효한 플랜이 있는지
  const hasValidPlan = sanitizedData.plans.some(
    plan => plan.dailyQuests.length > 0 && plan.dailyQuests.every(q => q.unitTitle)
  );

  if (!hasValidPlan) {
    return {
      isValid: false,
      errors: ['유효한 플랜이 없습니다. AI가 잘못된 형식으로 응답했을 수 있습니다.'],
    };
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * 간단한 유효성 체크 (boolean 반환)
 */
export function isValidGenerateResult(data: unknown): data is GenerateResult {
  const result = validateGenerateResult(data);
  return result.isValid || (result.sanitizedData !== undefined && result.sanitizedData.plans.length > 0);
}
