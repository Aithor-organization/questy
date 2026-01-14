/**
 * CoachAgent
 * 학습 코칭 전문 에이전트
 */

import { BaseAgent } from '../base-agent.js';
import type { AgentRequest, AgentResponse, DirectorContext } from '../../../types/agent.js';
import { QuestActions } from '../../shared/quest-actions.js';

import type { TodayStudyStatus, MissedStudyContext, StudentState, ResponseType } from './types.js';
import { COACH_SYSTEM_PROMPT } from './prompts.js';
import {
  analyzeStudentState,
  determineResponseType,
  buildMemoryContext,
} from './utils/student-analyzer.js';
import {
  buildCoachingPrompt,
  getFallbackResponse,
  generateFollowUps,
} from './utils/response-generator.js';
import {
  handleScheduleRequest,
  handleScheduleQuery,
  handlePlanCreationRequest,
  generateScheduleCoachingResponse,
} from './handlers/schedule-handler.js';
import * as FeatureHandler from './handlers/feature-handler.js';

export class CoachAgent extends BaseAgent {
  constructor() {
    super({
      role: 'COACH',
      modelConfig: {
        id: 'claude-4.5-haiku',
        provider: 'anthropic',
        maxTokens: 2048,
        temperature: 0.7,
        purpose: '학습 코칭 및 감정 지원',
      },
      systemPrompt: COACH_SYSTEM_PROMPT,
    });
  }

  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message, metadata } = request;

    // 일정 조정/조회 요청 감지
    if (QuestActions.isScheduleRequest(message)) {
      return handleScheduleRequest(
        message,
        context,
        generateScheduleCoachingResponse,
        this.createResponse.bind(this)
      );
    }

    // 일정 조회 요청 처리
    if (QuestActions.isScheduleQuery(message)) {
      return handleScheduleQuery(context, this.createResponse.bind(this));
    }

    // 플랜 생성 요청 감지
    if (QuestActions.isPlanCreationRequest(message)) {
      return handlePlanCreationRequest(this.createResponse.bind(this));
    }

    // 학생 상태 파악 및 응답 생성
    const studentState = analyzeStudentState(message, context);
    const responseType = determineResponseType(studentState, message);
    const memoryContextStr = buildMemoryContext(context);

    const response = await this.generateCoachingResponse(
      message,
      responseType,
      memoryContextStr,
      studentState,
      metadata,
      context.recentConversations
    );

    return this.createResponse(response, {
      memoryExtracted: true,
      suggestedFollowUp: generateFollowUps(responseType),
    });
  }

  /**
   * 코칭 응답 생성
   */
  private async generateCoachingResponse(
    message: string,
    responseType: ResponseType,
    memoryContext: string,
    state: StudentState,
    metadata?: AgentRequest['metadata'],
    recentConversations?: DirectorContext['recentConversations']
  ): Promise<string> {
    const fullPrompt = buildCoachingPrompt(
      this.systemPrompt,
      memoryContext,
      state,
      responseType,
      metadata,
      recentConversations
    );

    try {
      return await this.generateResponse(fullPrompt, message, {
        model: 'claude-4.5-haiku',
        temperature: 0.7,
        maxTokens: 1024,
      });
    } catch (error) {
      console.error('[CoachAgent] LLM call failed, using fallback:', error);
      return getFallbackResponse(responseType, state);
    }
  }

  // ==================== FR 기능 메서드 ====================

  /**
   * FR-025: 저녁 리뷰 생성
   */
  async generateEveningReview(
    studentName: string,
    todayStatus: TodayStudyStatus,
    tomorrowQuests: string[]
  ): Promise<string> {
    return FeatureHandler.generateEveningReview(
      this.systemPrompt,
      studentName,
      todayStatus,
      tomorrowQuests,
      this.generateResponse.bind(this)
    );
  }

  /**
   * FR-024: 미학습 대응
   */
  async generateMissedStudyResponse(
    studentName: string,
    missedContext: MissedStudyContext
  ): Promise<string> {
    return FeatureHandler.generateMissedStudyResponse(
      this.systemPrompt,
      studentName,
      missedContext,
      this.generateResponse.bind(this)
    );
  }

  /**
   * FR-026: 위기 개입
   */
  async generateCrisisIntervention(
    studentName: string,
    missedDays: number,
    recentEmotions: string[]
  ): Promise<string> {
    return FeatureHandler.generateCrisisIntervention(
      this.systemPrompt,
      studentName,
      missedDays,
      recentEmotions,
      this.generateResponse.bind(this)
    );
  }

  /**
   * FR-021: 학습 시작 알림
   */
  async generateStudyStartReminder(
    studentName: string,
    reminderType: 'first' | '15min' | '30min',
    questName: string,
    estimatedMinutes: number
  ): Promise<string> {
    return FeatureHandler.generateStudyStartReminder(
      studentName,
      reminderType,
      questName,
      estimatedMinutes
    );
  }
}
