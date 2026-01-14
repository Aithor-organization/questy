/**
 * AI 리뷰 생성 모듈
 */

import type { PlanReview, ReviewPatternMemory } from '../../../../types/memory.js';
import type { ModelId } from '../../../../types/agent.js';
import type { PlanReviewRequest, PlanStats, ExtendedPlanReview } from '../types.js';
import { PLAN_REVIEW_SYSTEM_PROMPT } from '../prompts.js';

type GenerateResponseFn = (
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: ModelId; temperature?: number; maxTokens?: number }
) => Promise<string>;

/**
 * AI 리뷰 생성
 */
export async function generateAIReview(
  request: PlanReviewRequest,
  stats: PlanStats,
  learnedPatterns: ReviewPatternMemory[],
  patternImprovements: { improvements: string[]; appliedPatternIds: string[] },
  generateResponse: GenerateResponseFn
): Promise<PlanReview> {
  const { materialName, planName, dailyQuests, totalDays, totalEstimatedHours } = request;

  // 플랜 요약 생성
  const planSummary = dailyQuests.slice(0, 10).map((q) =>
    `Day ${q.day}: ${q.unitNumber}단원 ${q.unitTitle} (${q.range || ''}) - ${q.estimatedMinutes}분`
  ).join('\n');

  const learnedPatternsInfo = learnedPatterns.length > 0
    ? `\n## 학습된 리뷰 패턴\n${learnedPatterns
        .filter(p => p.confidence >= 0.7)
        .slice(0, 5)
        .map(p => `- ${p.patternName}: ${p.suggestedFix}`)
        .join('\n')}`
    : '';

  const userPrompt = `## 학습 플랜 분석 요청

**교재**: ${materialName}
**플랜명**: ${planName}
**총 기간**: ${totalDays}일
**총 예상 시간**: ${totalEstimatedHours}시간
**하루 평균**: ${stats.avgMinutes}분

## 단원별 배분
${Object.entries(stats.unitCounts).map(([unit, days]) => `${unit}단원: ${days}일`).join('\n')}

## 상세 일정 (처음 10일)
${planSummary}
${dailyQuests.length > 10 ? `\n... 외 ${dailyQuests.length - 10}일` : ''}
${learnedPatternsInfo}

## 이미 감지된 문제
${patternImprovements.improvements.length > 0
  ? patternImprovements.improvements.join('\n')
  : '특별히 감지된 문제 없음'}

이 학습 플랜을 분석하고 피드백을 제공해주세요.`;

  const result = await callLLMForReview(userPrompt, generateResponse);
  return result;
}

/**
 * LLM 호출 - 리뷰 생성
 */
async function callLLMForReview(
  prompt: string,
  generateResponse: GenerateResponseFn
): Promise<PlanReview> {
  console.log('[ReviewGenerator] LLM call for review');

  const response = await generateResponse(
    PLAN_REVIEW_SYSTEM_PROMPT,
    prompt,
    {
      model: 'gemini-3-flash' as ModelId,
      temperature: 0.3,
      maxTokens: 2048,
    }
  );

  // JSON 파싱 시도
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[ReviewGenerator] No JSON found in response, using fallback');
    throw new Error('No JSON in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    overallScore: parsed.overallScore ?? 7,
    strengths: parsed.strengths ?? [],
    improvements: parsed.improvements ?? [],
    suggestions: parsed.motivationalTips ?? [],
    riskAssessment: parsed.riskAssessment ?? {
      burnoutRisk: 'LOW',
      dropOffRisk: 'LOW',
      overloadDays: [],
    },
    coachMessage: parsed.expertAdvice ?? '좋은 계획이에요! 화이팅! 💪',
  };
}

/**
 * 폴백 리뷰 생성
 */
export function generateFallbackReview(
  request: PlanReviewRequest,
  stats: PlanStats,
  riskAssessment: ExtendedPlanReview['riskAssessment']
): ExtendedPlanReview {
  const { totalDays } = request;

  // 기본 점수 계산
  let score = 7;
  const strengths: string[] = [];
  const improvements: string[] = [];

  // 시간 배분 평가
  if (stats.avgMinutes >= 30 && stats.avgMinutes <= 60) {
    strengths.push('하루 학습 시간이 적절합니다');
    score += 1;
  } else if (stats.avgMinutes > 60) {
    improvements.push(`하루 평균 ${stats.avgMinutes}분은 다소 많습니다. 60분 이하로 조정을 권장합니다.`);
    score -= 1;
  }

  // 오버로드 평가
  if (stats.overloadDays.length > 0) {
    improvements.push(`${stats.overloadDays.join(', ')}일차에 학습량이 많습니다. 분산을 권장합니다.`);
    score -= 0.5;
  }

  // 휴식일 평가
  if (totalDays > 14 && stats.daysWithRest === 0) {
    improvements.push('장기 플랜에 휴식일이 없습니다. 7일마다 가벼운 복습일을 추가하세요.');
    score -= 0.5;
  }

  // 위험 평가
  if (riskAssessment.burnoutRisk === 'HIGH') {
    improvements.push('번아웃 위험이 높습니다. 학습량을 줄이거나 기간을 늘려주세요.');
    score -= 1;
  }
  if (riskAssessment.dropOffRisk === 'HIGH') {
    improvements.push('이탈 위험이 높습니다. 초반 학습량을 줄이고 점진적으로 늘려보세요.');
    score -= 1;
  }

  // 긍정적 요소
  if (improvements.length === 0) {
    strengths.push('전반적으로 균형 잡힌 학습 계획입니다');
  }
  if (Object.keys(stats.unitCounts).length > 1) {
    strengths.push('다양한 단원을 체계적으로 다루고 있습니다');
  }

  // 점수 범위 조정
  score = Math.max(3, Math.min(10, Math.round(score * 10) / 10));

  return {
    overallScore: score,
    strengths,
    improvements,
    suggestions: [
      '꾸준한 실천이 가장 중요합니다',
      '어려우면 언제든 페이스를 조정하세요',
    ],
    riskAssessment,
    coachMessage: score >= 7
      ? '좋은 계획이에요! 이대로 시작해볼까요? 💪'
      : '약간의 조정 후 시작하면 더 좋을 것 같아요. 함께 수정해볼까요?',
    appliedPatterns: [],
  };
}
