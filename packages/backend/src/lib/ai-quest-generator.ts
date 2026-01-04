import { openrouter, DEFAULT_MODEL } from './openrouter';
import { AnalyzedUnit, DetectedStudyPlan } from './image-analyzer';
import { formatDate } from '@questybook/shared';

// 사용량 로깅 헬퍼
function logApiUsage(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  context: string
) {
  if (!usage) return;

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || 0;

  // Gemini 3 Flash 가격
  const inputCost = promptTokens * (0.10 / 1_000_000);
  const outputCost = completionTokens * (0.40 / 1_000_000);
  const totalCost = inputCost + outputCost;

  console.log(`[API Usage] ${model} (${context})`);
  console.log(`  Input: ${promptTokens.toLocaleString()} tokens ($${inputCost.toFixed(6)})`);
  console.log(`  Output: ${completionTokens.toLocaleString()} tokens ($${outputCost.toFixed(6)})`);
  console.log(`  Total: ${totalTokens.toLocaleString()} tokens | Cost: $${totalCost.toFixed(6)}`);
}

// AI가 생성한 퀘스트 결과 (상세 정보 포함)
export interface AIGeneratedQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  // 상세 정보
  topics?: string[];      // 구체적인 학습 주제/개념
  pages?: string;         // 페이지 범위
  objectives?: string[];  // 학습 목표
}

// AI 추천 정보
export interface AIRecommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

// AI 생성 결과 타입
export interface AIQuestResult {
  dailyQuests: AIGeneratedQuest[];
  recommendations: AIRecommendation[];
  totalEstimatedHours: number;
  message: string;
}

// 생성된 플랜 (개별)
export interface GeneratedPlan {
  planType: 'original' | 'custom';
  planName: string;
  description: string;
  dailyQuests: AIGeneratedQuest[];
  totalDays: number;
  totalEstimatedHours: number;
}

// 듀얼 플랜 생성 결과
export interface DualPlanResult {
  hasOriginalPlan: boolean;
  plans: GeneratedPlan[];
  recommendations: AIRecommendation[];
  message: string;
}

const SYSTEM_PROMPT = `당신은 학습 계획 전문가 AI입니다.
교재의 단원 정보와 목표 기간을 받아서 최적의 일일 학습 퀘스트를 생성합니다.

## 핵심 원칙
1. 단원의 난이도와 분량을 고려하여 균형있게 분배
2. 어려운 단원은 더 많은 일수 할당
3. 연관된 단원은 연속으로 학습하도록 배치
4. 복습일을 적절히 배치 (5~7일마다)

## 출력 형식 (JSON)
{
  "dailyQuests": [
    {
      "day": 1,
      "unitNumber": 1,
      "unitTitle": "단원명",
      "range": "학습할 소단원 범위",
      "estimatedMinutes": 45,
      "tip": "학습 팁 (선택사항)"
    }
  ],
  "recommendations": [
    {
      "suggestedDays": 50,
      "reason": "하루 90분 투자 시 가능",
      "intensity": "intensive",
      "dailyStudyMinutes": 90
    },
    {
      "suggestedDays": 100,
      "reason": "하루 45분으로 여유롭게",
      "intensity": "relaxed",
      "dailyStudyMinutes": 45
    }
  ],
  "totalEstimatedHours": 75,
  "message": "사용자에게 전달할 메시지"
}

## 난이도별 기본 학습 시간
- easy: 30분
- medium: 45분
- hard: 60분

## 중요
- 요청된 목표 일수에 맞춰 퀘스트 생성
- 대안 일정을 2~3개 추천 (빡빡한/보통/여유로운)
- 단원 번호가 범위 내에 있는 것만 포함`;

/**
 * AI를 사용하여 최적화된 일일 퀘스트를 생성합니다
 */
export async function generateQuestsWithAI(
  analyzedUnits: AnalyzedUnit[],
  materialName: string,
  startUnit: number,
  endUnit: number,
  targetDays: number
): Promise<AIQuestResult> {
  // 범위 내 단원만 필터링
  const targetUnits = analyzedUnits.filter(
    (unit) => unit.unitNumber >= startUnit && unit.unitNumber <= endUnit
  );

  if (targetUnits.length === 0) {
    return {
      dailyQuests: [],
      recommendations: [],
      totalEstimatedHours: 0,
      message: '지정한 범위에 해당하는 단원이 없습니다.',
    };
  }

  // 오늘 날짜 기준 시작
  const today = new Date();
  const startDateStr = formatDate(today);

  const userPrompt = `## 교재 정보
- 교재명: ${materialName}
- 학습 범위: ${startUnit}단원 ~ ${endUnit}단원
- 목표 기간: ${targetDays}일
- 시작일: ${startDateStr}

## 단원 정보
${targetUnits.map((u) => `${u.unitNumber}. ${u.unitTitle}
   - 소단원: ${u.subSections.join(', ') || '없음'}
   - 난이도: ${u.difficulty}`).join('\n\n')}

위 정보를 바탕으로 ${targetDays}일 동안의 일일 학습 퀘스트를 생성해주세요.
각 단원의 난이도와 분량을 고려하여 최적으로 분배하고, 대안 일정도 추천해주세요.`;

  const response = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  });

  // 사용량 로깅
  logApiUsage(DEFAULT_MODEL, response.usage, 'Quest Generation');

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const result = JSON.parse(content) as AIQuestResult;

    // 날짜 추가 (AI는 day만 반환하므로)
    result.dailyQuests = result.dailyQuests.map((quest) => {
      const questDate = new Date(today);
      questDate.setDate(today.getDate() + quest.day - 1);
      return {
        ...quest,
        date: formatDate(questDate),
      };
    });

    return result;
  } catch (error) {
    console.error('Failed to parse AI quest result:', content);
    return {
      dailyQuests: [],
      recommendations: [],
      totalEstimatedHours: 0,
      message: 'AI 응답 파싱에 실패했습니다.',
    };
  }
}

// 듀얼 플랜 생성용 시스템 프롬프트
const DUAL_PLAN_SYSTEM_PROMPT = `당신은 학습 계획 전문가 AI입니다.
이미지에서 감지된 학습계획표와 사용자의 목표 기간을 바탕으로 2개의 학습 플랜을 생성합니다.

## 플랜 1: 원본 플랜 (original)
- 이미지에 있는 학습계획표를 **그대로** 따름
- 학습계획표의 일수, 단원 배치를 정확히 복제
- 학습계획표에 있는 **상세 정보(주제, 페이지, 학습목표 등)를 모두 포함**
- 사용자의 목표 기간과 무관하게 원본 일정 유지

## 플랜 2: 맞춤 플랜 (custom)
- 학습계획표의 내용을 **사용자의 목표 기간**에 맞춰 재분배
- 원본 계획표의 단원 순서와 내용은 유지하되, 일수만 조정
- 상세 정보도 함께 재분배
- 난이도를 고려하여 균형있게 분배

## 출력 형식 (JSON)
{
  "plans": [
    {
      "planType": "original",
      "planName": "원본 30일 플랜",
      "description": "교재에서 제안하는 원본 학습 계획입니다",
      "dailyQuests": [
        {
          "day": 1,
          "unitNumber": 1,
          "unitTitle": "단원명",
          "range": "학습 범위 (예: 1.1~1.3)",
          "estimatedMinutes": 60,
          "topics": ["집합의 뜻", "집합의 표현"],
          "pages": "p.15~28",
          "objectives": ["집합의 개념을 이해한다"],
          "tip": "기본 개념 정리 필수, 예제 풀이 권장"
        }
      ],
      "totalEstimatedHours": 30
    },
    {
      "planType": "custom",
      "planName": "맞춤 50일 플랜",
      "description": "원본 내용을 50일에 맞춰 재구성한 여유로운 계획입니다",
      "dailyQuests": [...],
      "totalEstimatedHours": 30
    }
  ],
  "recommendations": [
    {
      "suggestedDays": 30,
      "reason": "원본 계획 (하루 1시간)",
      "intensity": "normal",
      "dailyStudyMinutes": 60
    }
  ],
  "message": "사용자에게 전달할 메시지"
}

## 퀘스트 상세 정보 포함 규칙
1. **topics**: 해당 일차에 학습할 구체적인 주제/개념 목록 (배열)
2. **pages**: 페이지 범위 (문자열, 예: "p.15~28")
3. **objectives**: 학습 목표 목록 (배열)
4. **tip**: 학습 팁, 주의사항, 권장 학습법 등 (문자열)
5. **estimatedMinutes**: 예상 학습 시간 (분 단위)

## 중요 규칙
1. 원본 플랜은 학습계획표를 정확히 복제 (일수, 범위, 상세정보 모두 동일)
2. 맞춤 플랜은 사용자의 목표 기간에 맞춰 재분배
3. 두 플랜 모두 같은 학습 내용을 포함 (일정만 다름)
4. **학습계획표의 상세 정보(topics, pages, objectives, notes)를 최대한 활용**`;

/**
 * 학습계획표가 감지된 경우 듀얼 플랜을 생성합니다
 */
export async function generateDualPlans(
  analyzedUnits: AnalyzedUnit[],
  studyPlan: DetectedStudyPlan,
  materialName: string,
  startUnit: number,
  endUnit: number,
  targetDays: number
): Promise<DualPlanResult> {
  const today = new Date();

  // 학습계획표가 없으면 단일 플랜만 생성
  if (!studyPlan.hasSchedule || studyPlan.scheduleItems.length === 0) {
    const singleResult = await generateQuestsWithAI(
      analyzedUnits,
      materialName,
      startUnit,
      endUnit,
      targetDays
    );

    return {
      hasOriginalPlan: false,
      plans: [{
        planType: 'custom',
        planName: `${targetDays}일 맞춤 플랜`,
        description: `${materialName}을 ${targetDays}일 동안 학습하는 AI 추천 계획입니다`,
        dailyQuests: singleResult.dailyQuests,
        totalDays: singleResult.dailyQuests.length,
        totalEstimatedHours: singleResult.totalEstimatedHours,
      }],
      recommendations: singleResult.recommendations,
      message: singleResult.message,
    };
  }

  // 학습계획표가 있으면 듀얼 플랜 생성 (상세 정보 포함)
  const scheduleInfo = studyPlan.scheduleItems
    .map((item) => {
      let info = `Day ${item.day}: ${item.unitNumber}단원 ${item.unitTitle} (${item.range})`;
      if (item.topics && item.topics.length > 0) {
        info += `\n     주제: ${item.topics.join(', ')}`;
      }
      if (item.pages) {
        info += `\n     페이지: ${item.pages}`;
      }
      if (item.estimatedMinutes) {
        info += `\n     예상시간: ${item.estimatedMinutes}분`;
      }
      if (item.objectives && item.objectives.length > 0) {
        info += `\n     학습목표: ${item.objectives.join('; ')}`;
      }
      if (item.notes) {
        info += `\n     참고: ${item.notes}`;
      }
      return info;
    })
    .join('\n\n');

  // 주간 구조 및 일일 시간 가이드
  const structureInfo = [
    studyPlan.weeklyStructure ? `주간 구조: ${studyPlan.weeklyStructure}` : '',
    studyPlan.dailyTimeGuide ? `일일 학습 시간: ${studyPlan.dailyTimeGuide}` : '',
  ].filter(Boolean).join('\n');

  const userPrompt = `## 교재 정보
- 교재명: ${materialName}
- 학습 범위: ${startUnit}단원 ~ ${endUnit}단원
- 사용자 목표 기간: ${targetDays}일
- 시작일: ${formatDate(today)}

## 감지된 학습계획표 (${studyPlan.source})
총 ${studyPlan.totalDays}일 계획
${structureInfo}

### 상세 일정:
${scheduleInfo}

## 단원 정보
${analyzedUnits.map((u) => `${u.unitNumber}. ${u.unitTitle}
   - 소단원: ${u.subSections.join(', ') || '없음'}
   - 난이도: ${u.difficulty}`).join('\n\n')}

위 정보를 바탕으로:
1. **원본 플랜**: 학습계획표 (${studyPlan.totalDays}일)를 그대로 따르는 퀘스트
   - 위의 상세 일정(주제, 페이지, 학습목표 등)을 그대로 포함
2. **맞춤 플랜**: 사용자의 목표인 ${targetDays}일에 맞춰 재분배한 퀘스트
   - 상세 정보도 적절히 분배

두 개의 플랜을 생성해주세요. 상세 정보(topics, pages, objectives)를 최대한 포함해주세요.`;

  const response = await openrouter.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: DUAL_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
    max_tokens: 16384,
  });

  // 사용량 로깅
  logApiUsage(DEFAULT_MODEL, response.usage, 'Dual Plan Generation');

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const result = JSON.parse(content) as DualPlanResult;

    // 날짜 추가
    result.plans = result.plans.map((plan) => ({
      ...plan,
      totalDays: plan.dailyQuests.length,
      dailyQuests: plan.dailyQuests.map((quest) => {
        const questDate = new Date(today);
        questDate.setDate(today.getDate() + quest.day - 1);
        return {
          ...quest,
          date: formatDate(questDate),
        };
      }),
    }));

    return {
      hasOriginalPlan: true,
      plans: result.plans,
      recommendations: result.recommendations || [],
      message: result.message || `${studyPlan.source} 기반 원본 플랜과 ${targetDays}일 맞춤 플랜을 생성했습니다.`,
    };
  } catch (error) {
    console.error('Failed to parse dual plan result:', content);

    // 실패 시 단일 플랜으로 폴백
    const fallbackResult = await generateQuestsWithAI(
      analyzedUnits,
      materialName,
      startUnit,
      endUnit,
      targetDays
    );

    return {
      hasOriginalPlan: false,
      plans: [{
        planType: 'custom',
        planName: `${targetDays}일 맞춤 플랜`,
        description: `${materialName}을 ${targetDays}일 동안 학습하는 AI 추천 계획입니다`,
        dailyQuests: fallbackResult.dailyQuests,
        totalDays: fallbackResult.dailyQuests.length,
        totalEstimatedHours: fallbackResult.totalEstimatedHours,
      }],
      recommendations: fallbackResult.recommendations,
      message: '듀얼 플랜 생성에 실패하여 맞춤 플랜만 생성했습니다.',
    };
  }
}
