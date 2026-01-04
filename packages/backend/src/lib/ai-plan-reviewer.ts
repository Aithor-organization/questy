import { openrouter, DEFAULT_MODEL } from './openrouter';
import { AIGeneratedQuest } from './ai-quest-generator';

// 사용량 로깅 헬퍼
function logApiUsage(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
) {
  if (!usage) return;

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || 0;

  const inputCost = promptTokens * (0.10 / 1_000_000);
  const outputCost = completionTokens * (0.40 / 1_000_000);
  const totalCost = inputCost + outputCost;

  console.log(`[API Usage] ${model} (Plan Review)`);
  console.log(`  Input: ${promptTokens.toLocaleString()} tokens ($${inputCost.toFixed(6)})`);
  console.log(`  Output: ${completionTokens.toLocaleString()} tokens ($${outputCost.toFixed(6)})`);
  console.log(`  Total: ${totalTokens.toLocaleString()} tokens | Cost: $${totalCost.toFixed(6)}`);
}

// 플랜 리뷰 결과 타입
export interface PlanReview {
  overallScore: number; // 1-10
  overallComment: string;
  strengths: string[];
  improvements: string[];
  balanceAnalysis: {
    timeBalance: string;
    difficultyProgression: string;
    restDaysAdvice: string;
  };
  motivationalTips: string[];
  expertAdvice: string;
}

// 리뷰 요청 타입
interface ReviewRequest {
  materialName: string;
  planName: string;
  dailyQuests: AIGeneratedQuest[];
  totalDays: number;
  totalEstimatedHours: number;
}

const REVIEW_SYSTEM_PROMPT = `당신은 학습 계획 전문가이자 교육 컨설턴트입니다.
학습 플랜을 분석하고 건설적인 피드백을 제공합니다.

## 분석 관점
1. **시간 배분**: 하루 학습량이 적절한지, 번아웃 위험은 없는지
2. **난이도 진행**: 쉬운 것에서 어려운 것으로 자연스럽게 진행되는지
3. **단원 연결성**: 연관된 단원이 적절히 배치되었는지
4. **복습 주기**: 복습일이 적절히 배치되었는지
5. **실현 가능성**: 실제로 따라할 수 있는 계획인지

## 출력 형식 (JSON)
{
  "overallScore": 8,
  "overallComment": "전반적으로 균형 잡힌 학습 계획입니다...",
  "strengths": [
    "단원별 시간 배분이 적절합니다",
    "어려운 단원에 충분한 시간을 할당했습니다"
  ],
  "improvements": [
    "중간에 복습일을 추가하면 더 효과적입니다",
    "3주차에 학습량이 많아 조정이 필요합니다"
  ],
  "balanceAnalysis": {
    "timeBalance": "하루 평균 45분으로 적절합니다",
    "difficultyProgression": "초반에 기초를 다지고 후반에 심화로 진행됩니다",
    "restDaysAdvice": "7일마다 가벼운 복습일을 추가하세요"
  },
  "motivationalTips": [
    "작은 목표 달성을 축하하세요",
    "힘들 때는 하루 쉬어도 괜찮습니다"
  ],
  "expertAdvice": "이 계획을 따르면서 자신의 페이스에 맞게 조정하세요..."
}

## 평가 기준
- 10점: 완벽한 계획, 즉시 시작 가능
- 8-9점: 좋은 계획, 약간의 조정 권장
- 6-7점: 괜찮은 계획, 개선 여지 있음
- 5점 이하: 재검토 필요

친절하고 격려하는 톤으로 작성하세요. 비판보다는 개선 방향을 제시하세요.`;

/**
 * AI를 사용하여 학습 플랜을 리뷰합니다
 */
export async function reviewPlanWithAI(request: ReviewRequest): Promise<PlanReview> {
  const { materialName, planName, dailyQuests, totalDays, totalEstimatedHours } = request;

  // 플랜 요약 생성
  const totalMinutes = dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
  const avgMinutes = Math.round(totalMinutes / totalDays);
  const unitCounts = dailyQuests.reduce((acc, q) => {
    acc[q.unitNumber] = (acc[q.unitNumber] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const planSummary = dailyQuests.map((q) =>
    `Day ${q.day}: ${q.unitNumber}단원 ${q.unitTitle} (${q.range}) - ${q.estimatedMinutes}분`
  ).join('\n');

  const userPrompt = `## 학습 플랜 분석 요청

**교재**: ${materialName}
**플랜명**: ${planName}
**총 기간**: ${totalDays}일
**총 예상 시간**: ${totalEstimatedHours}시간
**하루 평균**: ${avgMinutes}분

## 단원별 배분
${Object.entries(unitCounts).map(([unit, days]) => `${unit}단원: ${days}일`).join('\n')}

## 상세 일정
${planSummary}

이 학습 플랜을 분석하고 피드백을 제공해주세요.`;

  const response = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });

  logApiUsage(DEFAULT_MODEL, response.usage);

  const content = response.choices[0]?.message?.content || '{}';

  try {
    return JSON.parse(content) as PlanReview;
  } catch {
    console.error('Failed to parse plan review:', content);
    return {
      overallScore: 7,
      overallComment: '플랜 분석을 완료했습니다.',
      strengths: ['체계적인 학습 계획입니다'],
      improvements: ['세부 조정을 고려해보세요'],
      balanceAnalysis: {
        timeBalance: '적절한 시간 배분입니다',
        difficultyProgression: '점진적인 난이도 상승이 좋습니다',
        restDaysAdvice: '주기적인 복습을 권장합니다',
      },
      motivationalTips: ['꾸준함이 중요합니다', '작은 성취를 축하하세요'],
      expertAdvice: '자신의 페이스에 맞게 조정하면서 진행하세요.',
    };
  }
}
