/**
 * PlannerAgent (진화형)
 * 학습 계획 수립 전문 에이전트
 *
 * 통합 기능:
 * - AI 기반 목차 분석 및 플랜 생성
 * - Memory Lane 기반 개인화
 * - 과거 성과 학습 및 진화
 * - SM-2 복습 스케줄 통합
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  StudyPlan,
  StudySession,
  AgentAction,
} from '../../types/agent.js';
import type {
  Subject,
  TopicMastery,
  AnalyzedUnit,
  DetectedStudyPlan,
  AIGeneratedQuest,
  GeneratedPlan,
  PlanPerformanceMemory,
  LearnedOptimalValues,
} from '../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';

// ===================== 시스템 프롬프트 =====================

const PLANNER_SYSTEM_PROMPT = `당신은 학습 계획 전문가 AI입니다.

## 핵심 역할
1. **커리큘럼 설계**: 교재 기반 체계적 학습 경로 생성
2. **일정 조정**: 학생 상황에 맞게 유연하게 수정
3. **복습 통합**: SM-2 기반 복습 일정 자동 반영
4. **진도 최적화**: 숙달도에 따른 속도 조절
5. **개인화**: 과거 학습 성과 기반 최적화

## 계획 원칙
- 무리한 목표보다 지속 가능한 페이스
- 약한 부분에 더 많은 시간 배분
- 성취감을 느낄 수 있는 작은 단위
- 휴식과 복습 시간 확보

## 학습 시간 추정 원칙
- 단원의 개념 양과 복잡도 고려
- 소단원 개수와 범위 반영
- 난이도 (easy/medium/hard) 기반 조정
- 개념 학습 vs 문제 풀이 구분

예시:
- 간단한 개념 정리: 20~30분
- 일반적인 단원 학습: 40~60분
- 복잡한 개념이나 다량의 문제 풀이: 70~90분
- 종합 복습: 30~45분`;

const QUEST_GENERATION_PROMPT = `당신은 학습 퀘스트 생성 전문가입니다.
교재의 단원 정보와 목표 기간을 받아서 최적의 일일 학습 퀘스트를 생성합니다.

## 개인화 정보 활용
아래 정보가 제공되면 반드시 반영하세요:
- 학생의 과거 성과 (완료율, 이탈 시점)
- 학습된 최적 학습 시간
- 위험 일차 (휴식일 추가)

## 출력 형식 (JSON)
{
  "dailyQuests": [
    {
      "day": 1,
      "unitNumber": 1,
      "unitTitle": "단원명",
      "range": "학습할 소단원 범위",
      "estimatedMinutes": 45,
      "tip": "학습 팁 (선택사항)",
      "topics": ["주제1", "주제2"],
      "pages": "p.10~25",
      "objectives": ["학습목표1"]
    }
  ],
  "recommendations": [
    {
      "suggestedDays": 50,
      "reason": "하루 90분 투자 시 가능",
      "intensity": "intensive",
      "dailyStudyMinutes": 90
    }
  ],
  "totalEstimatedHours": 75,
  "message": "사용자에게 전달할 메시지"
}`;

// ===================== 타입 정의 =====================

type PlanRequestType = 'CREATE_PLAN' | 'ADJUST_PLAN' | 'CHECK_SCHEDULE' | 'RECOMMEND' | 'GENERATE_FROM_IMAGE' | 'GENERAL';

interface AIQuestResult {
  dailyQuests: AIGeneratedQuest[];
  recommendations: AIRecommendation[];
  totalEstimatedHours: number;
  message: string;
}

export interface AIRecommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

export interface DualPlanResult {
  hasOriginalPlan: boolean;
  plans: GeneratedPlan[];
  recommendations: AIRecommendation[];
  message: string;
}

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
  // 주말 미포함 옵션
  excludeWeekends?: boolean;
  startDate?: string; // ISO date string (YYYY-MM-DD)
}

// ===================== 헬퍼 함수 =====================

/**
 * 주말을 건너뛰고 N번째 평일 날짜를 계산
 */
function getNextWeekday(startDate: Date, daysToAdd: number, excludeWeekends: boolean): Date {
  const result = new Date(startDate);

  if (!excludeWeekends) {
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  let addedDays = 0;
  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = 일요일, 6 = 토요일
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

// ===================== PlannerAgent 클래스 =====================

export class PlannerAgent extends BaseAgent {
  // 과거 성과 캐시 (진화 학습용)
  private performanceCache: Map<string, PlanPerformanceMemory[]> = new Map();
  private optimalValuesCache: Map<string, LearnedOptimalValues> = new Map();

  constructor() {
    super({
      role: 'PLANNER',
      modelConfig: {
        id: 'gemini-3-flash',
        provider: 'google',
        maxTokens: 8192,
        temperature: 0.5,
        purpose: '학습 계획 수립 및 AI 기반 플랜 생성',
      },
      systemPrompt: PLANNER_SYSTEM_PROMPT,
    });
  }

  // ===================== 기본 process 메서드 =====================

  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message, studentId } = request;
    const { activePlans, memoryContext } = context;

    const requestType = this.classifyRequest(message);

    let response: string;
    const actions: AgentAction[] = [];

    switch (requestType) {
      case 'CREATE_PLAN':
        const planResult = await this.createStudyPlan(
          studentId,
          message,
          memoryContext.masteryInfo
        );
        response = planResult.message;
        actions.push({
          type: 'CREATE_PLAN',
          payload: planResult.plan as unknown as Record<string, unknown>,
        });
        break;

      case 'ADJUST_PLAN':
        response = await this.adjustPlan(activePlans[0], message, memoryContext);
        break;

      case 'CHECK_SCHEDULE':
        response = this.generateScheduleSummary(activePlans, memoryContext.reviewDue);
        break;

      case 'RECOMMEND':
        response = this.generateRecommendations(memoryContext.masteryInfo, activePlans);
        break;

      default:
        // GENERAL 케이스도 LLM으로 처리
        response = await this.handleGeneralRequest(message, activePlans, memoryContext);
    }

    return this.createResponse(response, {
      actions,
      suggestedFollowUp: this.generateFollowUps(requestType),
    });
  }

  // ===================== AI 플랜 생성 (진화형) =====================

  /**
   * AI 기반 플랜 생성 (목차 분석 결과 활용)
   * - Memory Lane에서 과거 성과 조회
   * - 학습된 최적값 적용
   * - 개인화된 플랜 생성
   */
  async generatePlanFromAnalysis(
    request: PlanGenerationRequest
  ): Promise<DualPlanResult> {
    const { studentId, materialName, analyzedUnits, detectedStudyPlan, targetDays, bookMetadata, excludeWeekends, startDate } = request;

    console.log(`[PlannerAgent] Generating plan for ${studentId}: ${materialName}`);

    // 1. 과거 성과 조회 (진화 학습)
    const pastPerformance = await this.loadPastPerformance(studentId, bookMetadata?.subject as Subject);
    const optimalValues = await this.learnOptimalValues(studentId, pastPerformance, bookMetadata?.subject as Subject);

    console.log(`[PlannerAgent] Loaded ${pastPerformance.length} past performances`);
    if (optimalValues) {
      console.log(`[PlannerAgent] Optimal daily minutes: ${optimalValues.optimalDailyMinutes}`);
    }

    // 2. 학습계획표가 있으면 듀얼 플랜, 없으면 단일 플랜
    if (detectedStudyPlan?.hasSchedule && detectedStudyPlan.scheduleItems.length > 0) {
      return this.generateDualPlans(
        analyzedUnits,
        detectedStudyPlan,
        materialName,
        targetDays,
        optimalValues,
        pastPerformance,
        bookMetadata,
        excludeWeekends,
        startDate
      );
    }

    // 단일 플랜 생성
    const result = await this.generateQuestsWithAI(
      analyzedUnits,
      materialName,
      targetDays,
      optimalValues,
      pastPerformance,
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
   * AI 퀘스트 생성 (단일 플랜)
   */
  private async generateQuestsWithAI(
    analyzedUnits: AnalyzedUnit[],
    materialName: string,
    targetDays: number,
    optimalValues: LearnedOptimalValues | null,
    pastPerformance: PlanPerformanceMemory[],
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

    // 개인화 정보 구성
    const personalizationInfo = this.buildPersonalizationInfo(optimalValues, pastPerformance);

    const metadataInfo = bookMetadata ? `
- 과목: ${bookMetadata.subject || '미분류'}
- 대상: ${bookMetadata.targetGrade || '미분류'}
- 유형: ${bookMetadata.bookType || '미분류'}` : '';

    // 주말 미포함 옵션 처리
    const actualStartDate = startDate ? new Date(startDate) : today;
    const weekendInfo = excludeWeekends ? `
## ⚠️ 주말 미포함 설정
- 토요일과 일요일에는 퀘스트를 배정하지 마세요.
- 시작일(${format(actualStartDate, 'yyyy-MM-dd')})부터 주말(토/일)을 건너뛰고 평일에만 퀘스트를 배정하세요.
- 각 퀘스트의 date 필드에는 실제 평일 날짜를 기입하세요.
- 예: 금요일 다음은 월요일로 배정` : '';

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

위 정보를 바탕으로 ${targetDays}일 동안의 일일 학습 퀘스트를 생성해주세요.
각 단원의 난이도와 분량을 고려하여 최적으로 분배하고, 대안 일정도 추천해주세요.
${excludeWeekends ? '주말(토/일)은 건너뛰고 평일에만 퀘스트를 배정해주세요.' : ''}`;

    try {
      // LLM 호출 (실제 구현에서는 OpenRouter 등 사용)
      const result = await this.callLLMForQuests(userPrompt);

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
      console.error('[PlannerAgent] AI quest generation failed:', error);
      // 폴백: 기본 퀘스트 생성
      return this.generateFallbackQuests(analyzedUnits, targetDays, materialName, excludeWeekends, startDate);
    }
  }

  /**
   * 듀얼 플랜 생성 (원본 + 맞춤)
   */
  private async generateDualPlans(
    analyzedUnits: AnalyzedUnit[],
    studyPlan: DetectedStudyPlan,
    materialName: string,
    targetDays: number,
    optimalValues: LearnedOptimalValues | null,
    pastPerformance: PlanPerformanceMemory[],
    bookMetadata?: PlanGenerationRequest['bookMetadata'],
    excludeWeekends?: boolean,
    startDate?: string
  ): Promise<DualPlanResult> {
    const today = new Date();
    const actualStartDate = startDate ? new Date(startDate) : today;
    const personalizationInfo = this.buildPersonalizationInfo(optimalValues, pastPerformance);

    const scheduleInfo = studyPlan.scheduleItems
      .map(item => {
        let info = `Day ${item.day}: ${item.unitNumber}단원 ${item.unitTitle} (${item.range})`;
        if (item.topics && item.topics.length > 0) {
          info += `\n     주제: ${item.topics.join(', ')}`;
        }
        if (item.pages) {
          info += `\n     페이지: ${item.pages}`;
        }
        return info;
      })
      .join('\n\n');

    const metadataInfo = bookMetadata ? `
- 과목: ${bookMetadata.subject || '미분류'}
- 대상: ${bookMetadata.targetGrade || '미분류'}
- 유형: ${bookMetadata.bookType || '미분류'}` : '';

    // 주말 미포함 옵션 처리
    const weekendInfo = excludeWeekends ? `
## ⚠️ 주말 미포함 설정
- 토요일과 일요일에는 퀘스트를 배정하지 마세요.
- 시작일(${format(actualStartDate, 'yyyy-MM-dd')})부터 주말(토/일)을 건너뛰고 평일에만 퀘스트를 배정하세요.
- 각 퀘스트의 date 필드에는 실제 평일 날짜를 기입하세요.` : '';

    const userPrompt = `## 교재 정보
- 교재명: ${materialName}${metadataInfo}
- 사용자 목표 기간: ${targetDays}일 (학습일 기준)
- 시작일: ${format(actualStartDate, 'yyyy-MM-dd')}
${excludeWeekends ? '- 주말 미포함: 예 (평일만 학습)' : '- 주말 미포함: 아니오 (매일 학습)'}
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
2. **맞춤 플랜**: 사용자 목표(${targetDays}일)에 맞춰 재분배한 퀘스트
${excludeWeekends ? '\n⚠️ 두 플랜 모두 주말(토/일)은 건너뛰고 평일에만 퀘스트를 배정해주세요.' : ''}`;

    try {
      const result = await this.callLLMForDualPlans(userPrompt, studyPlan.totalDays, targetDays);

      // 날짜 추가 (주말 미포함 시 평일만)
      result.plans = result.plans.map(plan => ({
        ...plan,
        totalDays: plan.dailyQuests.length,
        dailyQuests: plan.dailyQuests.map(quest => {
          const questDate = getNextWeekday(actualStartDate, quest.day - 1, excludeWeekends ?? false);
          return {
            ...quest,
            date: format(questDate, 'yyyy-MM-dd'),
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
      console.error('[PlannerAgent] Dual plan generation failed:', error);
      // 폴백: 단일 플랜
      const fallback = await this.generateQuestsWithAI(
        analyzedUnits,
        materialName,
        targetDays,
        optimalValues,
        pastPerformance,
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
          dailyQuests: fallback.dailyQuests,
          totalDays: fallback.dailyQuests.length,
          totalEstimatedHours: fallback.totalEstimatedHours,
        }],
        recommendations: fallback.recommendations,
        message: '듀얼 플랜 생성에 실패하여 맞춤 플랜만 생성했습니다.',
      };
    }
  }

  // ===================== 진화 학습 메서드 =====================

  /**
   * 과거 플랜 성과 로드 (Memory Lane)
   */
  private async loadPastPerformance(
    studentId: string,
    subject?: Subject
  ): Promise<PlanPerformanceMemory[]> {
    // 캐시 확인
    const cacheKey = `${studentId}-${subject || 'all'}`;
    if (this.performanceCache.has(cacheKey)) {
      return this.performanceCache.get(cacheKey)!;
    }

    // TODO: Memory Lane에서 실제 조회
    // const memories = await memoryLane.query({
    //   type: 'PLAN_PERFORMANCE',
    //   studentId,
    //   subject,
    // });

    // 현재는 빈 배열 반환 (초기 상태)
    const performances: PlanPerformanceMemory[] = [];
    this.performanceCache.set(cacheKey, performances);
    return performances;
  }

  /**
   * 최적값 학습 (과거 성과 기반)
   */
  private async learnOptimalValues(
    studentId: string,
    performances: PlanPerformanceMemory[],
    subject?: Subject
  ): Promise<LearnedOptimalValues | null> {
    if (performances.length < 2) {
      return null; // 데이터 부족
    }

    const cacheKey = `${studentId}-${subject || 'all'}`;
    if (this.optimalValuesCache.has(cacheKey)) {
      return this.optimalValuesCache.get(cacheKey)!;
    }

    // 성공적인 플랜 분석 (완료율 70% 이상)
    const successfulPlans = performances.filter(p => p.completionRate >= 0.7);

    if (successfulPlans.length === 0) {
      return null;
    }

    // 최적값 계산
    const avgDailyMinutes = successfulPlans.reduce((sum, p) => sum + p.dailyMinutes, 0) / successfulPlans.length;
    const avgStudyTime = successfulPlans.reduce((sum, p) => sum + p.averageStudyTime, 0) / successfulPlans.length;

    // 이탈 위험 일차 분석
    const dropOffDays = performances
      .filter(p => p.dropOffDay)
      .map(p => p.dropOffDay!);
    const commonDropOffDays = this.findCommonDropOffDays(dropOffDays);

    const optimal: LearnedOptimalValues = {
      studentId,
      subject: subject || 'GENERAL',
      optimalDailyMinutes: Math.round(avgDailyMinutes),
      optimalSessionLength: Math.round(avgStudyTime),
      preferredStudyHour: 20, // TODO: 실제 데이터에서 추출
      dropOffRiskDays: commonDropOffDays,
      fatigueThreshold: 90, // 기본값
      dataPoints: performances.length,
      lastUpdated: new Date(),
    };

    this.optimalValuesCache.set(cacheKey, optimal);
    return optimal;
  }

  /**
   * 개인화 정보 문자열 구성
   */
  private buildPersonalizationInfo(
    optimalValues: LearnedOptimalValues | null,
    pastPerformance: PlanPerformanceMemory[]
  ): string {
    if (!optimalValues && pastPerformance.length === 0) {
      return '## 개인화 정보\n신규 학생입니다. 기본 설정을 사용합니다.';
    }

    let info = '## 개인화 정보 (과거 학습 기반)\n';

    if (optimalValues) {
      info += `- 학습된 최적 일일 학습 시간: ${optimalValues.optimalDailyMinutes}분\n`;
      info += `- 최적 세션 길이: ${optimalValues.optimalSessionLength}분\n`;
      if (optimalValues.dropOffRiskDays.length > 0) {
        info += `- ⚠️ 이탈 위험 일차: ${optimalValues.dropOffRiskDays.join(', ')}일 (휴식일 권장)\n`;
      }
      info += `- 데이터 기반: ${optimalValues.dataPoints}개 과거 플랜\n`;
    }

    if (pastPerformance.length > 0) {
      const avgCompletion = pastPerformance.reduce((sum, p) => sum + p.completionRate, 0) / pastPerformance.length;
      info += `- 평균 플랜 완료율: ${(avgCompletion * 100).toFixed(0)}%\n`;

      const recentPlan = pastPerformance[pastPerformance.length - 1];
      info += `- 최근 플랜: ${recentPlan.materialName} (완료율 ${(recentPlan.completionRate * 100).toFixed(0)}%)\n`;
    }

    return info;
  }

  /**
   * 공통 이탈 일차 분석
   */
  private findCommonDropOffDays(dropOffDays: number[]): number[] {
    if (dropOffDays.length === 0) return [];

    // 빈도 계산
    const frequency: Record<number, number> = {};
    dropOffDays.forEach(day => {
      // 근처 일차도 같은 그룹으로 (±2일)
      const bucket = Math.round(day / 5) * 5;
      frequency[bucket] = (frequency[bucket] || 0) + 1;
    });

    // 2회 이상 발생한 일차
    return Object.entries(frequency)
      .filter(([_, count]) => count >= 2)
      .map(([day]) => parseInt(day))
      .sort((a, b) => a - b);
  }

  // ===================== 플랜 성과 기록 =====================

  /**
   * 플랜 성과 기록 (진화 학습용)
   */
  async recordPlanPerformance(performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>): Promise<void> {
    const record: PlanPerformanceMemory = {
      ...performance,
      id: uuidv4(),
      type: 'PLAN_PERFORMANCE',
      createdAt: new Date(),
    };

    console.log(`[PlannerAgent] Recording performance for plan ${record.planId}: ${(record.completionRate * 100).toFixed(0)}% completion`);

    // TODO: Memory Lane에 저장
    // await memoryLane.store(record);

    // 캐시 무효화
    const cacheKey = `${record.studentId}-${record.subject}`;
    this.performanceCache.delete(cacheKey);
    this.optimalValuesCache.delete(cacheKey);
  }

  // ===================== LLM 호출 (추상화) =====================

  /**
   * LLM 호출 - 퀘스트 생성
   */
  private async callLLMForQuests(prompt: string): Promise<AIQuestResult> {
    console.log('[PlannerAgent] LLM call for quests');

    try {
      // BaseAgent의 generateResponse 사용
      const response = await this.generateResponse(
        QUEST_GENERATION_PROMPT,
        prompt,
        {
          model: 'gemini-3-flash',
          temperature: 0.5,
          maxTokens: 8192,
        }
      );

      // JSON 파싱 시도
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[PlannerAgent] No JSON found in response, using fallback');
        throw new Error('No JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        dailyQuests: parsed.dailyQuests ?? [],
        recommendations: parsed.recommendations ?? [],
        totalEstimatedHours: parsed.totalEstimatedHours ?? 0,
        message: parsed.message ?? '학습 플랜이 생성되었습니다.',
      };
    } catch (error) {
      console.error('[PlannerAgent] LLM quest generation failed:', error);
      throw error;
    }
  }

  /**
   * LLM 호출 - 듀얼 플랜 생성
   */
  private async callLLMForDualPlans(
    prompt: string,
    originalDays: number,
    targetDays: number
  ): Promise<DualPlanResult> {
    console.log('[PlannerAgent] LLM call for dual plans');

    const dualPlanPrompt = `${QUEST_GENERATION_PROMPT}

## 추가 요구사항 - 듀얼 플랜 생성
두 개의 학습 플랜을 생성해주세요:
1. **원본 플랜** (planType: "original"): 학습계획표(${originalDays}일)를 그대로 따르는 퀘스트
2. **맞춤 플랜** (planType: "custom"): 사용자 목표(${targetDays}일)에 맞춰 재분배한 퀘스트

## 출력 형식 (JSON)
{
  "plans": [
    {
      "planType": "original",
      "planName": "원본 ${originalDays}일 플랜",
      "description": "학습계획표 기반 플랜",
      "dailyQuests": [...],
      "totalEstimatedHours": 75
    },
    {
      "planType": "custom",
      "planName": "${targetDays}일 맞춤 플랜",
      "description": "개인 목표에 맞춘 AI 추천 플랜",
      "dailyQuests": [...],
      "totalEstimatedHours": 75
    }
  ],
  "recommendations": [...],
  "message": "두 가지 플랜을 생성했습니다"
}`;

    try {
      // BaseAgent의 generateResponse 사용
      const response = await this.generateResponse(
        dualPlanPrompt,
        prompt,
        {
          model: 'gemini-3-flash',
          temperature: 0.5,
          maxTokens: 8192,
        }
      );

      // JSON 파싱 시도
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[PlannerAgent] No JSON found in dual plan response, using fallback');
        throw new Error('No JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        hasOriginalPlan: true,
        plans: parsed.plans ?? [],
        recommendations: parsed.recommendations ?? [],
        message: parsed.message ?? `원본(${originalDays}일)과 맞춤(${targetDays}일) 플랜을 생성했습니다.`,
      };
    } catch (error) {
      console.error('[PlannerAgent] LLM dual plan generation failed:', error);
      throw error;
    }
  }

  /**
   * 폴백 퀘스트 생성 (AI 실패 시)
   */
  private generateFallbackQuests(
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

      // 주말 미포함 시 평일만 날짜 계산
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

  // ===================== GENERAL 요청 LLM 처리 =====================

  /**
   * 일반적인 학습 계획 관련 요청을 LLM으로 처리
   */
  private async handleGeneralRequest(
    message: string,
    activePlans: StudyPlan[],
    memoryContext: DirectorContext['memoryContext']
  ): Promise<string> {
    const planInfo = activePlans.length > 0
      ? activePlans.map(p => `- ${p.title} (진행률: ${((p.completedSessions / p.totalSessions) * 100).toFixed(0)}%)`).join('\n')
      : '현재 활성 계획이 없습니다.';

    const generalPrompt = `당신은 친근한 학습 계획 전문가입니다.
학생의 질문이나 요청에 도움을 주세요.

## 현재 학습 상황
${planInfo}

## 제공 가능한 서비스
- 새 교재 학습 계획 수립
- 현재 진도 조정
- 복습 스케줄 확인
- 학습 일정 변경 (미루기, 당기기)
- 학습 추천

학생의 요청을 이해하고 적절한 도움을 제공해주세요.
친근하고 격려하는 톤으로 응답하며, 이모지를 적절히 사용하세요.
응답은 200자 이내로 간결하게 해주세요.`;

    try {
      const response = await this.generateResponse(
        generalPrompt,
        message,
        {
          model: 'claude-4.5-haiku',
          temperature: 0.7,
          maxTokens: 512,
        }
      );
      return response;
    } catch (error) {
      console.error('[PlannerAgent] LLM general request failed:', error);
      // 폴백: 기본 응답
      return '어떤 계획을 세워드릴까요? 📚\n- 새 교재 학습 계획\n- 현재 진도 조정\n- 복습 스케줄 확인';
    }
  }

  // ===================== 기존 메서드 유지 =====================

  private classifyRequest(message: string): PlanRequestType {
    if (/이미지|목차|사진/.test(message)) return 'GENERATE_FROM_IMAGE';
    if (/새|시작|만들어|계획.*세워/.test(message)) return 'CREATE_PLAN';
    // 일정 변경/미루기 관련 패턴 추가
    if (/조정|바꿔|수정|변경|미뤄|미룰|연기|옮겨|늦춰|당겨/.test(message)) return 'ADJUST_PLAN';
    if (/일정|스케줄|언제|뭐.*해야/.test(message)) return 'CHECK_SCHEDULE';
    if (/추천|권장|어떻게/.test(message)) return 'RECOMMEND';
    return 'GENERAL';
  }

  private async createStudyPlan(
    studentId: string,
    message: string,
    masteryInfo: TopicMastery[]
  ): Promise<{ message: string; plan: StudyPlan }> {
    const subject = this.extractSubject(message);
    const totalDays = this.extractDuration(message);

    const plan: StudyPlan = {
      id: uuidv4(),
      studentId,
      textbookId: 'default-textbook',
      subject,
      title: `${subject} 학습 계획`,
      totalSessions: totalDays,
      completedSessions: 0,
      startDate: new Date(),
      targetEndDate: addDays(new Date(), totalDays),
      status: 'ACTIVE',
      sessions: this.generateSessions(totalDays, subject, masteryInfo),
    };

    const messageResponse = `📅 **${plan.title}** 생성 완료!

📊 **계획 개요**
- 총 세션: ${plan.totalSessions}회
- 기간: ${totalDays}일
- 시작일: 오늘
- 목표 완료일: ${plan.targetEndDate.toLocaleDateString('ko-KR')}

📝 **첫 주 계획**
${plan.sessions.slice(0, 7).map((s, i) =>
  `${i + 1}일차: ${s.topic} (${s.estimatedMinutes}분)`
).join('\n')}

화이팅! 💪 함께 달려보자!`;

    return { message: messageResponse, plan };
  }

  private generateSessions(
    totalDays: number,
    subject: Subject,
    masteryInfo: TopicMastery[]
  ): StudySession[] {
    const sessions: StudySession[] = [];
    const weakTopics = masteryInfo
      .filter(m => m.subject === subject && m.masteryScore < 5)
      .map(m => m.topicId);

    for (let i = 0; i < totalDays; i++) {
      const isReviewDay = (i + 1) % 7 === 0;

      sessions.push({
        id: uuidv4(),
        planId: '',
        order: i + 1,
        topic: isReviewDay
          ? '주간 복습'
          : weakTopics.length > 0
            ? `${weakTopics[i % weakTopics.length]} 학습`
            : `${i + 1}단원 학습`,
        estimatedMinutes: isReviewDay ? 30 : 45,
        status: 'PENDING',
      });
    }

    return sessions;
  }

  private async adjustPlan(
    plan: StudyPlan | undefined,
    message: string,
    memoryContext: DirectorContext['memoryContext']
  ): Promise<string> {
    // 활성 계획이 없어도 일정 변경 요청은 LLM으로 처리
    const planInfo = plan
      ? `현재 계획: ${plan.title}\n진행률: ${((plan.completedSessions / plan.totalSessions) * 100).toFixed(0)}%\n총 세션: ${plan.totalSessions}회`
      : '현재 활성 계획이 없습니다.';

    const adjustPrompt = `당신은 학습 일정 조정 전문가입니다.
학생의 요청을 이해하고 적절한 일정 조정 방안을 제시해주세요.

## 현재 상태
${planInfo}

## 조정 가능 사항
- 퀘스트 날짜 변경 (미루기, 당기기)
- 페이스 조정 (빠르게, 느리게)
- 특정 날짜로 일정 이동
- 휴식일 추가

학생의 상황을 공감하며 친근하게 응답하고, 구체적인 조정 방안을 제시해주세요.
이모지를 적절히 사용하고, 응답은 200자 이내로 간결하게 해주세요.`;

    try {
      const response = await this.generateResponse(
        adjustPrompt,
        message,
        {
          model: 'claude-4.5-haiku',
          temperature: 0.7,
          maxTokens: 512,
        }
      );
      return response;
    } catch (error) {
      console.error('[PlannerAgent] LLM adjust plan failed:', error);
      // 폴백: 기본 응답
      if (!plan) {
        return '조정할 활성 계획이 없어요. 새 계획을 만들까요? 📅';
      }
      return `현재 계획: ${plan.title}\n진행률: ${((plan.completedSessions / plan.totalSessions) * 100).toFixed(0)}%\n\n어떻게 조정할까요? 😊`;
    }
  }

  private generateScheduleSummary(plans: StudyPlan[], reviewDue: TopicMastery[]): string {
    let summary = '📅 **오늘의 학습 일정**\n\n';

    if (plans.length === 0) {
      summary += '활성 계획이 없어요. 새 계획을 세워볼까요?\n';
    } else {
      for (const plan of plans) {
        const nextSession = plan.sessions.find(s => s.status === 'PENDING');
        if (nextSession) {
          summary += `📚 **${plan.title}**\n`;
          summary += `   → ${nextSession.topic} (${nextSession.estimatedMinutes}분)\n\n`;
        }
      }
    }

    if (reviewDue.length > 0) {
      summary += '🔄 **복습 필요**\n';
      for (const topic of reviewDue.slice(0, 3)) {
        summary += `   → ${topic.topicId}\n`;
      }
    }

    return summary;
  }

  private generateRecommendations(masteryInfo: TopicMastery[], plans: StudyPlan[]): string {
    const weakTopics = masteryInfo
      .filter(m => m.masteryScore < 4)
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 3);

    let recommendations = '💡 **추천 학습 순서**\n\n';

    if (weakTopics.length > 0) {
      recommendations += '⚠️ **보강 필요 토픽** (우선순위 높음)\n';
      for (const topic of weakTopics) {
        recommendations += `   🔴 ${topic.topicId} (숙달도: ${topic.masteryScore.toFixed(1)}/10)\n`;
      }
      recommendations += '\n';
    }

    recommendations += '💪 이 부분들을 먼저 보강하면 전체 실력이 확 올라갈 거야!';
    return recommendations;
  }

  private extractSubject(message: string): Subject {
    if (/국어|문학/.test(message)) return 'KOREAN';
    if (/수학|미적/.test(message)) return 'MATH';
    if (/영어|영문/.test(message)) return 'ENGLISH';
    if (/과학|물리|화학|생물/.test(message)) return 'SCIENCE';
    if (/사회|역사/.test(message)) return 'SOCIAL';
    return 'GENERAL';
  }

  private extractDuration(message: string): number {
    const match = message.match(/(\d+)\s*(일|주|week|day)/);
    if (match) {
      const num = parseInt(match[1]);
      if (/주|week/.test(match[2])) return num * 7;
      return num;
    }
    return 30;
  }

  private generateFollowUps(requestType: PlanRequestType): string[] {
    const followUps: Record<PlanRequestType, string[]> = {
      CREATE_PLAN: ['바로 시작할까?', '계획 수정이 필요해?'],
      ADJUST_PLAN: ['이 정도면 괜찮아?', '더 조정할 부분 있어?'],
      CHECK_SCHEDULE: ['지금 바로 시작할까?', '일정 변경이 필요해?'],
      RECOMMEND: ['이대로 진행할까?', '다른 추천이 필요해?'],
      GENERATE_FROM_IMAGE: ['플랜을 선택해줄래?', '다른 기간으로 다시 생성할까?'],
      GENERAL: ['어떤 과목 계획이 필요해?', '현재 진행 중인 계획 확인할까?'],
    };

    return followUps[requestType] ?? [];
  }
}
