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

import { BaseAgent } from '../base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  AgentAction,
  MessageAction,
} from '../../../types/agent.js';

// 모듈 import
import { PLANNER_SYSTEM_PROMPT } from './prompts.js';
import type { PlanGenerationRequest, DualPlanResult } from './types.js';
import { generateFollowUps } from './utils/extract-utils.js';
import { recordPlanPerformance } from './learning/performance-tracker.js';
import { generatePlanFromAnalysis } from './generators/plan-generator.js';
import { generateScheduleSummary, generateRecommendations } from './generators/schedule-generator.js';
import { adjustPlanWithActions } from './handlers/adjust-handler.js';
import { classifyRequest, createStudyPlan, handleGeneralRequest } from './handlers/request-handler.js';

import type { PlanPerformanceMemory } from '../../../types/memory.js';

export class PlannerAgent extends BaseAgent {
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

  /**
   * 메인 처리 메서드
   */
  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message, studentId } = request;
    const { activePlans, memoryContext, fullScheduleContext } = context;

    const requestType = classifyRequest(message);
    console.log(`[PlannerAgent] Processing: "${message.slice(0, 30)}...", Type: ${requestType}`);

    let response: string;
    const actions: AgentAction[] = [];
    let messageActions: MessageAction[] = [];

    switch (requestType) {
      case 'CREATE_PLAN': {
        const planResult = await createStudyPlan(
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
      }

      case 'ADJUST_PLAN': {
        const adjustResult = await adjustPlanWithActions(
          activePlans[0],
          message,
          memoryContext,
          context.todayQuests,
          fullScheduleContext,
          this.generateResponse.bind(this)
        );
        response = adjustResult.message;
        messageActions = adjustResult.messageActions;
        break;
      }

      case 'CHECK_SCHEDULE':
        response = generateScheduleSummary(activePlans, memoryContext.reviewDue, fullScheduleContext);
        break;

      case 'RECOMMEND':
        response = generateRecommendations(memoryContext.masteryInfo, activePlans);
        break;

      default:
        response = await handleGeneralRequest(
          message,
          activePlans,
          memoryContext,
          this.generateResponse.bind(this)
        );
    }

    return this.createResponse(response, {
      actions,
      suggestedFollowUp: generateFollowUps(requestType),
      messageActions: messageActions.length > 0 ? messageActions : undefined,
    });
  }

  /**
   * AI 기반 플랜 생성 (목차 분석 결과 활용)
   */
  async generatePlanFromAnalysis(request: PlanGenerationRequest): Promise<DualPlanResult> {
    return generatePlanFromAnalysis(request, this.generateResponse.bind(this));
  }

  /**
   * 플랜 성과 기록 (진화 학습용)
   */
  async recordPlanPerformance(
    performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
  ): Promise<void> {
    return recordPlanPerformance(performance);
  }
}

// Re-export types for external use
export type { PlanGenerationRequest, DualPlanResult, AIRecommendation } from './types.js';
