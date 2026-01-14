/**
 * 퀘스트 생성 모듈
 * AI 기반 일일 학습 퀘스트 생성
 */

import { format } from 'date-fns';
import type {
  AnalyzedUnit,
  AIGeneratedQuest,
  PlanPerformanceMemory,
  LearnedOptimalValues,
} from '../../../../types/memory.js';
import type { AIQuestResult, PlanGenerationRequest } from '../types.js';
import { QUEST_GENERATION_PROMPT } from '../prompts.js';
import { getNextWeekday } from '../utils/date-utils.js';
import { buildPersonalizationInfo } from '../learning/performance-tracker.js';

/**
 * AI 퀘스트 생성 (단일 플랜)
 */
export async function generateQuestsWithAI(
  analyzedUnits: AnalyzedUnit[],
  materialName: string,
  targetDays: number,
  optimalValues: LearnedOptimalValues | null,
  pastPerformance: PlanPerformanceMemory[],
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>,
  bookMetadata?: PlanGenerationRequest['bookMetadata'],
  excludeWeekends?: boolean,
  startDate?: string
): Promise<AIQuestResult> {
  if (analyzedUnits.length === 0) {
    return {
      dailyQuests: [],
      recommendations: [],
      totalEstimatedHours: 0,
      message: '분석된 단원이 없습니다.',
    };
  }

  const unitNumbers = analyzedUnits.map(u => u.unitNumber);
  const startUnit = Math.min(...unitNumbers);
  const endUnit = Math.max(...unitNumbers);
  const today = new Date();
  const actualStartDate = startDate ? new Date(startDate) : today;

  const personalizationInfo = buildPersonalizationInfo(optimalValues, pastPerformance);

  const metadataInfo = bookMetadata ? `
- 과목: ${bookMetadata.subject || '미분류'}
- 대상: ${bookMetadata.targetGrade || '미분류'}
- 유형: ${bookMetadata.bookType || '미분류'}` : '';

  const weekendInfo = excludeWeekends ? `
## ⚠️ 주말 미포함 설정
- 토요일과 일요일에는 퀘스트를 배정하지 마세요.
- 시작일(${format(actualStartDate, 'yyyy-MM-dd')})부터 주말(토/일)을 건너뛰고 평일에만 퀘스트를 배정하세요.` : '';

  const userPrompt = `## 교재 정보
- 교재명: ${materialName}${metadataInfo}
- 학습 범위: ${startUnit}단원 ~ ${endUnit}단원
- 목표 기간: ${targetDays}일 (학습일 기준)
- 시작일: ${format(actualStartDate, 'yyyy-MM-dd')}
${excludeWeekends ? '- 주말 미포함: 예 (평일만 학습)' : '- 주말 미포함: 아니오 (매일 학습)'}
${weekendInfo}

${personalizationInfo}

## 단원 정보
${analyzedUnits.map(u => `${u.unitNumber}. ${u.unitTitle}
   - 소단원: ${u.subSections.join(', ') || '없음'}
   - 난이도: ${u.difficulty}`).join('\n\n')}

위 정보를 바탕으로 ${targetDays}일 동안의 일일 학습 퀘스트를 생성해주세요.`;

  try {
    const result = await callLLMForQuests(userPrompt, generateResponse);

    // 날짜 추가 (주말 미포함 시 평일만)
    result.dailyQuests = result.dailyQuests.map(quest => {
      const questDate = getNextWeekday(actualStartDate, quest.day - 1, excludeWeekends ?? false);
      return {
        ...quest,
        date: format(questDate, 'yyyy-MM-dd'),
      };
    });

    return result;
  } catch (error) {
    console.error('[QuestGenerator] AI quest generation failed:', error);
    return generateFallbackQuests(analyzedUnits, targetDays, materialName, excludeWeekends, startDate);
  }
}

/**
 * LLM 호출 - 퀘스트 생성
 */
async function callLLMForQuests(
  prompt: string,
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<AIQuestResult> {
  console.log('[QuestGenerator] LLM call for quests');

  const response = await generateResponse(
    QUEST_GENERATION_PROMPT,
    prompt,
    { model: 'gemini-3-flash', temperature: 0.5, maxTokens: 8192 }
  );

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    dailyQuests: parsed.dailyQuests ?? [],
    recommendations: parsed.recommendations ?? [],
    totalEstimatedHours: parsed.totalEstimatedHours ?? 0,
    message: parsed.message ?? '학습 플랜이 생성되었습니다.',
  };
}

/**
 * 폴백 퀘스트 생성 (AI 실패 시)
 */
export function generateFallbackQuests(
  units: AnalyzedUnit[],
  targetDays: number,
  materialName: string,
  excludeWeekends?: boolean,
  startDate?: string
): AIQuestResult {
  const today = new Date();
  const actualStartDate = startDate ? new Date(startDate) : today;
  const quests: AIGeneratedQuest[] = [];

  const unitsPerDay = Math.max(1, Math.ceil(units.length / targetDays));

  for (let day = 1; day <= targetDays; day++) {
    const startIdx = (day - 1) * unitsPerDay;
    const dayUnits = units.slice(startIdx, startIdx + unitsPerDay);

    if (dayUnits.length === 0) continue;

    const questDate = getNextWeekday(actualStartDate, day - 1, excludeWeekends ?? false);

    quests.push({
      day,
      date: format(questDate, 'yyyy-MM-dd'),
      unitNumber: dayUnits[0].unitNumber,
      unitTitle: dayUnits.map(u => u.unitTitle).join(', '),
      range: `${dayUnits[0].unitNumber}단원`,
      estimatedMinutes: dayUnits.reduce((sum, u) =>
        sum + (u.difficulty === 'hard' ? 60 : u.difficulty === 'medium' ? 45 : 30), 0
      ),
      tip: day % 7 === 0 ? '주간 복습일입니다' : undefined,
    });
  }

  return {
    dailyQuests: quests,
    recommendations: [
      { suggestedDays: targetDays, reason: '요청한 기간', intensity: 'normal', dailyStudyMinutes: 45 },
    ],
    totalEstimatedHours: quests.reduce((sum, q) => sum + q.estimatedMinutes, 0) / 60,
    message: `${materialName} 기본 학습 플랜이 생성되었습니다.${excludeWeekends ? ' (주말 미포함)' : ''}`,
  };
}
