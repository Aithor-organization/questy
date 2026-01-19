/**
 * AnalystAgent (진화형)
 * 학습 분석 전문 에이전트
 *
 * 통합 기능:
 * - 진도 및 성취도 분석
 * - 취약점 진단
 * - 학습 패턴 인사이트
 * - AI 플랜 리뷰 (진화형)
 * - 리뷰 패턴 학습 및 적용
 */

import { BaseAgent } from '../base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
} from '../../../types/agent.js';
import type { LLMStreamChunk } from '../../../llm/index.js';
import type { ReviewPatternMemory } from '../../../types/memory.js';
import { QuestActions } from '../../shared/quest-actions.js';

// 모듈 import
import { ANALYST_SYSTEM_PROMPT } from './prompts.js';
import type { PlanReviewRequest, ExtendedPlanReview } from './types.js';
import { classifyAnalysisRequest, generateFollowUps } from './utils/format-utils.js';
import { calculatePlanStats, assessRisks } from './generators/plan-stats-generator.js';
import { generateAIReview, generateFallbackReview } from './generators/review-generator.js';
import {
  loadReviewPatterns,
  applyLearnedPatterns,
  recordPatternOutcome,
  createReviewPattern,
} from './patterns/pattern-manager.js';
import {
  analyzeProgress,
  analyzeWeakness,
  analyzePatterns,
  generateComparison,
  generateOverallReport,
} from './handlers/analysis-handler.js';
import {
  handleScheduleRequest,
  handleScheduleQuery,
  handlePlanCreationRequest,
} from './handlers/schedule-handler.js';

export class AnalystAgent extends BaseAgent {
  constructor() {
    super({
      role: 'ANALYST',
      modelConfig: {
        id: 'gemini-3-flash',
        provider: 'google',
        maxTokens: 4096,
        temperature: 0.3,
        purpose: '학습 데이터 분석, 진단 및 AI 플랜 리뷰',
      },
      systemPrompt: ANALYST_SYSTEM_PROMPT,
    });
  }

  /**
   * 메인 처리 메서드
   */
  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message } = request;
    const { studentProfile, memoryContext } = context;

    // 활성 플랜 가져오기: fullScheduleContext (프론트엔드) 우선, 없으면 내부 registry 사용
    const activePlans = this.getActivePlans(context);

    // 일정 조정 요청 감지
    if (QuestActions.isScheduleRequest(message)) {
      console.log('[AnalystAgent] Schedule request detected');
      const result = handleScheduleRequest(message, context);
      return this.createResponse(result.response, {
        suggestedFollowUp: ['일정 조정 후 진도 분석할까요?', '학습 패턴 분석이 필요한가요?'],
        messageActions: result.messageActions,
      });
    }

    // 일정 조회 요청 처리
    if (QuestActions.isScheduleQuery(message)) {
      console.log('[AnalystAgent] Schedule query detected');
      const response = handleScheduleQuery(context);
      return this.createResponse(response, {
        suggestedFollowUp: ['진도율을 더 분석해볼까요?', '취약점 분석도 함께할까요?'],
      });
    }

    // 플랜 생성 요청 감지
    if (QuestActions.isPlanCreationRequest(message)) {
      console.log('[AnalystAgent] Plan creation request detected');
      const result = handlePlanCreationRequest();
      return this.createResponse(result.response, {
        suggestedFollowUp: ['어떤 과목을 공부하고 싶으세요?'],
        messageActions: result.messageActions,
      });
    }

    // 분석 유형 파악
    const analysisType = classifyAnalysisRequest(message);
    let response: string;

    switch (analysisType) {
      case 'PROGRESS':
        response = analyzeProgress(activePlans, memoryContext.masteryInfo);
        break;
      case 'WEAKNESS':
        response = analyzeWeakness(memoryContext.masteryInfo, memoryContext.relevantMemories);
        break;
      case 'PATTERN':
        response = analyzePatterns(memoryContext.relevantMemories);
        break;
      case 'COMPARISON':
        response = generateComparison(memoryContext.masteryInfo);
        break;
      case 'PLAN_REVIEW':
        response = '플랜 리뷰는 reviewPlan 메서드를 통해 이용해주세요.';
        break;
      case 'OVERALL':
      default:
        response = generateOverallReport(studentProfile, activePlans, memoryContext.masteryInfo);
    }

    return this.createResponse(response, {
      suggestedFollowUp: generateFollowUps(analysisType),
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

    // 일정/플랜 관련 요청은 동기 응답
    if (QuestActions.isScheduleRequest(message) ||
        QuestActions.isScheduleQuery(message) ||
        QuestActions.isPlanCreationRequest(message)) {
      const response = await this.process(request, context);
      yield { content: response.message, done: false };
      yield { content: '', done: true };
      return;
    }

    // 분석 유형별 스트리밍
    const { studentProfile, memoryContext } = context;
    const activePlans = this.getActivePlans(context);
    const analysisType = classifyAnalysisRequest(message);

    // PLAN_REVIEW는 별도 메서드 필요
    if (analysisType === 'PLAN_REVIEW') {
      yield { content: '플랜 리뷰는 reviewPlan 메서드를 통해 이용해주세요.', done: false };
      yield { content: '', done: true };
      return;
    }

    // 스트리밍 분석
    const masteryCount = Array.isArray(memoryContext.masteryInfo)
      ? memoryContext.masteryInfo.length
      : 0;

    // 각 플랜의 상세 진도 정보 구성
    const planDetails = activePlans.length > 0
      ? activePlans.map(plan => {
          const progress = plan.totalSessions > 0
            ? Math.round((plan.completedSessions / plan.totalSessions) * 100)
            : 0;
          return `- ${plan.title}: ${plan.completedSessions}/${plan.totalSessions}일 완료 (${progress}%)`;
        }).join('\n')
      : '(활성 플랜 없음)';

    const prompt = `${this.systemPrompt}

현재 학생: ${studentProfile?.name ?? '알 수 없음'}
활성 플랜: ${activePlans.length}개
학습 항목: ${masteryCount}개

## 플랜별 진도 현황
${planDetails}

분석 유형: ${analysisType}
학생의 질문에 대해 위의 플랜별 진도 데이터를 기반으로 구체적인 분석과 격려를 해주세요.`;

    yield* this.generateStreamResponse(prompt, message, {
      model: 'gemini-3-flash',
      temperature: 0.3,
      maxTokens: 2048,
    });
  }

  /**
   * AI 플랜 리뷰 (진화 학습 포함)
   */
  async reviewPlan(request: PlanReviewRequest): Promise<ExtendedPlanReview> {
    const { planName, dailyQuests, totalDays, subject } = request;
    console.log(`[AnalystAgent] Reviewing plan: ${planName} (${totalDays} days)`);

    // 1. 학습된 리뷰 패턴 로드
    const learnedPatterns = await loadReviewPatterns(subject);
    console.log(`[AnalystAgent] Loaded ${learnedPatterns.length} review patterns`);

    // 2. 기본 통계 계산
    const stats = calculatePlanStats(dailyQuests, totalDays);

    // 3. 위험 요소 평가
    const riskAssessment = assessRisks(dailyQuests, stats);

    // 4. 학습된 패턴 기반 개선점 추출
    const patternBasedImprovements = applyLearnedPatterns(learnedPatterns, stats, subject);

    // 5. AI 리뷰 생성
    try {
      const aiReview = await generateAIReview(
        request,
        stats,
        learnedPatterns,
        patternBasedImprovements,
        this.generateResponse.bind(this)
      );

      return {
        ...aiReview,
        riskAssessment,
        appliedPatterns: patternBasedImprovements.appliedPatternIds,
      };
    } catch (error) {
      console.error('[AnalystAgent] AI review failed, using fallback:', error);
      return generateFallbackReview(request, stats, riskAssessment);
    }
  }

  /**
   * 리뷰 패턴 성공/실패 기록
   */
  async recordPatternOutcome(
    patternId: string,
    success: boolean,
    feedback?: string
  ): Promise<void> {
    return recordPatternOutcome(patternId, success, feedback);
  }

  /**
   * 새로운 리뷰 패턴 생성
   */
  async createReviewPattern(
    pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>
  ): Promise<string> {
    return createReviewPattern(pattern);
  }

  /**
   * 활성 플랜 가져오기 (프론트엔드 컨텍스트 우선)
   * - fullScheduleContext.activePlans: 프론트엔드에서 전달한 실제 사용자 플랜 (totalDays/completedDays)
   * - context.activePlans: 내부 StudentRegistry (보통 비어있음)
   */
  private getActivePlans(context: DirectorContext): DirectorContext['activePlans'] {
    // 프론트엔드 데이터가 있으면 형식 변환해서 사용
    const frontendPlans = context.fullScheduleContext?.activePlans;
    if (frontendPlans && frontendPlans.length > 0) {
      console.log(`[AnalystAgent] Using fullScheduleContext.activePlans: ${frontendPlans.length} plans`);
      // 프론트엔드 형식 (totalDays/completedDays) → 내부 형식 (totalSessions/completedSessions) 변환
      return frontendPlans.map(plan => ({
        id: plan.id,
        studentId: '',
        textbookId: '',
        subject: (plan.subject ?? '기타') as import('../../../types/memory.js').Subject,
        title: plan.title,
        totalSessions: plan.totalDays,
        completedSessions: plan.completedDays,
        startDate: new Date(plan.startDate),
        targetEndDate: new Date(plan.targetEndDate),
        status: plan.status,
        sessions: [],
      }));
    }

    // 프론트엔드 데이터 없으면 내부 registry 사용
    console.log(`[AnalystAgent] Using internal activePlans: ${context.activePlans.length} plans`);
    return context.activePlans;
  }
}
