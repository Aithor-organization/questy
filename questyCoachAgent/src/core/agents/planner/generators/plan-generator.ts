/**
 * 플랜 생성 모듈
 * AI 기반 학습 플랜 생성 (단일/듀얼)
 */

import { format } from 'date-fns';
import type {
  AnalyzedUnit,
  DetectedStudyPlan,
  PlanPerformanceMemory,
  LearnedOptimalValues,
  Subject,
} from '../../../../types/memory.js';
import type { DualPlanResult, PlanGenerationRequest } from '../types.js';
import { QUEST_GENERATION_PROMPT } from '../prompts.js';
import { getNextWeekday } from '../utils/date-utils.js';
import { buildPersonalizationInfo, loadPastPerformance, learnOptimalValues } from '../learning/performance-tracker.js';
import { generateQuestsWithAI } from './quest-generator.js';

/**
 * AI 기반 플랜 생성 (목차 분석 결과 활용)
 */
export async function generatePlanFromAnalysis(
  request: PlanGenerationRequest,
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<DualPlanResult> {
  const { studentId, materialName, analyzedUnits, detectedStudyPlan, targetDays, bookMetadata, excludeWeekends, startDate } = request;

  console.log(`[PlanGenerator] Generating plan for ${studentId}: ${materialName}`);

  // 1. 과거 성과 조회 (진화 학습)
  const pastPerformance = await loadPastPerformance(studentId, bookMetadata?.subject as Subject);
  const optimalValues = await learnOptimalValues(studentId, pastPerformance, bookMetadata?.subject as Subject);

  console.log(`[PlanGenerator] Loaded ${pastPerformance.length} past performances`);

  // 2. 학습계획표가 있으면 듀얼 플랜, 없으면 단일 플랜
  if (detectedStudyPlan?.hasSchedule && detectedStudyPlan.scheduleItems.length > 0) {
    return generateDualPlans(
      analyzedUnits,
      detectedStudyPlan,
      materialName,
      targetDays,
      optimalValues,
      pastPerformance,
      generateResponse,
      bookMetadata,
      excludeWeekends,
      startDate
    );
  }

  // 단일 플랜 생성
  const result = await generateQuestsWithAI(
    analyzedUnits,
    materialName,
    targetDays,
    optimalValues,
    pastPerformance,
    generateResponse,
    bookMetadata,
    excludeWeekends,
    startDate
  );

  return {
    hasOriginalPlan: false,
    plans: [{
      planType: 'custom',
      planName: `${targetDays}일 맞춤 플랜`,
      description: `${materialName}을 ${targetDays}일 동안 학습하는 AI 추천 계획입니다`,
      dailyQuests: result.dailyQuests,
      totalDays: result.dailyQuests.length,
      totalEstimatedHours: result.totalEstimatedHours,
    }],
    recommendations: result.recommendations,
    message: result.message,
  };
}

/**
 * 듀얼 플랜 생성 (원본 + 맞춤)
 */
async function generateDualPlans(
  analyzedUnits: AnalyzedUnit[],
  studyPlan: DetectedStudyPlan,
  materialName: string,
  targetDays: number,
  optimalValues: LearnedOptimalValues | null,
  pastPerformance: PlanPerformanceMemory[],
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>,
  bookMetadata?: PlanGenerationRequest['bookMetadata'],
  excludeWeekends?: boolean,
  startDate?: string
): Promise<DualPlanResult> {
  const today = new Date();
  const actualStartDate = startDate ? new Date(startDate) : today;
  const personalizationInfo = buildPersonalizationInfo(optimalValues, pastPerformance);

  const scheduleInfo = studyPlan.scheduleItems
    .map(item => {
      let info = `Day ${item.day}: ${item.unitNumber}단원 ${item.unitTitle} (${item.range})`;
      if (item.topics?.length) info += `\n     주제: ${item.topics.join(', ')}`;
      if (item.pages) info += `\n     페이지: ${item.pages}`;
      return info;
    })
    .join('\n\n');

  const metadataInfo = bookMetadata ? `
- 과목: ${bookMetadata.subject || '미분류'}
- 대상: ${bookMetadata.targetGrade || '미분류'}
- 유형: ${bookMetadata.bookType || '미분류'}` : '';

  const weekendInfo = excludeWeekends ? `
## ⚠️ 주말 미포함 설정
- 주말(토/일)을 건너뛰고 평일에만 퀘스트를 배정하세요.` : '';

  const userPrompt = `## 교재 정보
- 교재명: ${materialName}${metadataInfo}
- 목표 기간: ${targetDays}일
- 시작일: ${format(actualStartDate, 'yyyy-MM-dd')}
${excludeWeekends ? '- 주말 미포함: 예' : ''}
${weekendInfo}

${personalizationInfo}

## 감지된 학습계획표 (${studyPlan.source})
총 ${studyPlan.totalDays}일 계획

### 상세 일정:
${scheduleInfo}

## 단원 정보
${analyzedUnits.map(u => `${u.unitNumber}. ${u.unitTitle}
   - 소단원: ${u.subSections.join(', ') || '없음'}
   - 난이도: ${u.difficulty}`).join('\n\n')}

두 개의 플랜을 생성해주세요:
1. **원본 플랜**: 학습계획표(${studyPlan.totalDays}일)를 그대로 따르는 퀘스트
2. **맞춤 플랜**: 사용자 목표(${targetDays}일)에 맞춰 재분배한 퀘스트`;

  try {
    const result = await callLLMForDualPlans(userPrompt, studyPlan.totalDays, targetDays, generateResponse);

    // 날짜 추가
    result.plans = result.plans.map(plan => ({
      ...plan,
      totalDays: plan.dailyQuests.length,
      dailyQuests: plan.dailyQuests.map(quest => {
        const questDate = getNextWeekday(actualStartDate, quest.day - 1, excludeWeekends ?? false);
        return { ...quest, date: format(questDate, 'yyyy-MM-dd') };
      }),
    }));

    return {
      hasOriginalPlan: true,
      plans: result.plans,
      recommendations: result.recommendations || [],
      message: result.message || `${studyPlan.source} 기반 원본 플랜과 ${targetDays}일 맞춤 플랜을 생성했습니다.`,
    };
  } catch (error) {
    console.error('[PlanGenerator] Dual plan generation failed:', error);
    const fallback = await generateQuestsWithAI(
      analyzedUnits, materialName, targetDays, optimalValues, pastPerformance,
      generateResponse, bookMetadata, excludeWeekends, startDate
    );

    return {
      hasOriginalPlan: false,
      plans: [{
        planType: 'custom',
        planName: `${targetDays}일 맞춤 플랜`,
        description: `${materialName}을 ${targetDays}일 동안 학습하는 AI 추천 계획입니다`,
        dailyQuests: fallback.dailyQuests,
        totalDays: fallback.dailyQuests.length,
        totalEstimatedHours: fallback.totalEstimatedHours,
      }],
      recommendations: fallback.recommendations,
      message: '듀얼 플랜 생성에 실패하여 맞춤 플랜만 생성했습니다.',
    };
  }
}

/**
 * LLM 호출 - 듀얼 플랜 생성
 */
async function callLLMForDualPlans(
  prompt: string,
  originalDays: number,
  targetDays: number,
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<DualPlanResult> {
  console.log('[PlanGenerator] LLM call for dual plans');

  const dualPlanPrompt = `${QUEST_GENERATION_PROMPT}

## 추가 요구사항 - 듀얼 플랜 생성
두 개의 학습 플랜을 생성해주세요:
1. **원본 플랜** (planType: "original"): 학습계획표(${originalDays}일)를 그대로 따르는 퀘스트
2. **맞춤 플랜** (planType: "custom"): 사용자 목표(${targetDays}일)에 맞춰 재분배한 퀘스트

## 출력 형식 (JSON)
{
  "plans": [
    { "planType": "original", "planName": "원본 ${originalDays}일 플랜", "dailyQuests": [...] },
    { "planType": "custom", "planName": "${targetDays}일 맞춤 플랜", "dailyQuests": [...] }
  ],
  "recommendations": [...],
  "message": "두 가지 플랜을 생성했습니다"
}`;

  const response = await generateResponse(
    dualPlanPrompt,
    prompt,
    { model: 'gemini-3-flash', temperature: 0.5, maxTokens: 8192 }
  );

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    hasOriginalPlan: true,
    plans: parsed.plans ?? [],
    recommendations: parsed.recommendations ?? [],
    message: parsed.message ?? `원본(${originalDays}일)과 맞춤(${targetDays}일) 플랜을 생성했습니다.`,
  };
}
