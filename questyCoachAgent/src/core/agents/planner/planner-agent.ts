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
import type { LLMStreamChunk } from '../../../llm/index.js';

// 모듈 import
import { PLANNER_SYSTEM_PROMPT } from './prompts.js';
import type {
  PlanGenerationRequest,
  DualPlanResult,
  CurriculumGenerationRequest,
  CurriculumGenerationResult,
} from './types.js';
import { generateFollowUps } from './utils/extract-utils.js';
import { recordPlanPerformance, loadPastPerformance } from './learning/performance-tracker.js';
import { generatePlanFromAnalysis } from './generators/plan-generator.js';
import { generateScheduleSummary, generateRecommendations } from './generators/schedule-generator.js';
import { generateCurriculumWithAI } from './generators/curriculum-generator.js';
import { reviewCurriculum } from './generators/curriculum-reviewer.js';
import { adjustPlanWithActions } from './handlers/adjust-handler.js';
import { classifyRequest, createStudyPlan, handleGeneralRequest } from './handlers/request-handler.js';

import type { PlanPerformanceMemory, MemoryContext } from '../../../types/memory.js';

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
   * 스트리밍 응답 생성 (SSE)
   */
  async *processStream(
    request: AgentRequest,
    context: DirectorContext
  ): AsyncGenerator<LLMStreamChunk> {
    const { message } = request;

    // 플랜 생성/조정/일정 확인은 동기 응답 필요 (액션 처리)
    const requestType = classifyRequest(message);
    if (['CREATE_PLAN', 'ADJUST_PLAN', 'CHECK_SCHEDULE'].includes(requestType)) {
      const response = await this.process(request, context);
      yield { content: response.message, done: false };
      yield { content: '', done: true };
      return;
    }

    // 일반 질문은 스트리밍
    const { activePlans, memoryContext } = context;
    const masteryCount = Array.isArray(memoryContext.masteryInfo)
      ? memoryContext.masteryInfo.length
      : 0;
    const prompt = `${this.systemPrompt}

현재 활성 플랜: ${activePlans.length}개
학습 진도 요약: ${masteryCount}개 항목 학습 중

학생의 질문에 대해 학습 계획 관점에서 조언해주세요.`;

    yield* this.generateStreamResponse(prompt, message, {
      model: 'gemini-3-flash',
      temperature: 0.5,
      maxTokens: 2048,
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
    await recordPlanPerformance(performance);
  }

  /**
   * LLM 기반 인강 커리큘럼 생성
   * Memory Lane 통합으로 개인화된 학습 스케줄 생성
   * + 별도 에이전트로 검증 수행
   */
  async generateCurriculum(
    request: CurriculumGenerationRequest,
    memoryContext?: MemoryContext | null
  ): Promise<CurriculumGenerationResult> {
    console.log(`[PlannerAgent] Generating curriculum for student: ${request.studentId}`);
    console.log(`[PlannerAgent] Courses: ${request.courses.length}, Target: ${request.targetDate}`);

    // 과거 성과 데이터 조회
    const pastPerformance = await loadPastPerformance(request.studentId);

    // 1단계: 커리큘럼 생성 (gpt-5-nano)
    const result = await generateCurriculumWithAI(
      request,
      memoryContext ?? null,
      pastPerformance,
      this.generateResponse.bind(this)
    );

    // 2단계: 생성된 커리큘럼 검증 (claude-4.5-haiku)
    if (result.success && result.quests.length > 0) {
      console.log(`[PlannerAgent] Reviewing curriculum with ${result.quests.length} quests...`);

      const review = await reviewCurriculum(
        result,
        this.generateResponse.bind(this)
      );

      console.log(`[PlannerAgent] Review complete: score=${review.overallScore}, approved=${review.isApproved}`);

      // 검증 결과 추가
      result.review = review;
    }

    return result;
  }
}

// Re-export types for external use
export type {
  PlanGenerationRequest,
  DualPlanResult,
  AIRecommendation,
  CurriculumGenerationRequest,
  CurriculumGenerationResult,
  CurriculumQuest,
  CurriculumReviewResult,
  ReviewCategory,
} from './types.js';
