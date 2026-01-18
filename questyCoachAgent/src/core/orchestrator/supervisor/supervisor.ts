/**
 * Supervisor Orchestrator
 * Multi-Agent Supervisor Pattern 구현
 * - 중앙 집중식 라우팅
 * - 에이전트 조율 및 상태 관리
 * - 실행 경로 추적
 */

import type {
  AgentRole,
  AgentRequest,
  AgentResponse,
  RouteDecision,
} from '../../../types/agent.js';
import type { Subject, PlanPerformanceMemory, ReviewPatternMemory } from '../../../types/memory.js';
import { IntentClassifier } from '../../router/index.js';
import {
  BaseAgent,
  CoachAgent,
  PlannerAgent,
  AnalystAgent,
  AdmissionAgent,
} from '../../agents/index.js';
import { MemoryLane } from '../../../memory/index.js';
import { getLLMClient, type LLMClient, type LLMStreamChunk } from '../../../llm/index.js';
import { StudentRegistry } from '../../../registry/index.js';
import { QuestGenerator, QuestTracker, ScheduleDelayHandler, ScheduleModifier } from '../../../quest/index.js';

import type { SupervisorConfig, ExecutionState, FrontendQuestContext } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { buildContext } from './utils/context-builder.js';
import { generateRescheduleOptionsFromMessage } from './utils/schedule-utils.js';
import { ConversationManager } from './utils/conversation-manager.js';
import { ExecutionStateManager } from './utils/state-manager.js';
import * as PlanHandler from './handlers/plan-handler.js';
import * as QuestHandler from './handlers/quest-handler.js';

export class Supervisor {
  private config: SupervisorConfig;

  // 핵심 컴포넌트
  private classifier: IntentClassifier;
  private memoryLane: MemoryLane;
  private llmClient: LLMClient;
  private studentRegistry: StudentRegistry;
  private questGenerator: QuestGenerator;
  private questTracker: QuestTracker;
  private scheduleDelayHandler: ScheduleDelayHandler;
  private scheduleModifier: ScheduleModifier;

  // 에이전트 풀 (Worker Agents)
  private agents: Map<Exclude<AgentRole, 'DIRECTOR'>, BaseAgent>;

  // 상태 관리
  private stateManager: ExecutionStateManager;
  private conversationManager: ConversationManager;

  constructor(config: Partial<SupervisorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 핵심 컴포넌트 초기화
    this.classifier = new IntentClassifier();
    this.memoryLane = new MemoryLane({
      enableAutoExtraction: this.config.enableMemoryExtraction,
      enableBurnoutMonitoring: this.config.enableBurnoutCheck,
    });
    this.llmClient = getLLMClient();
    this.studentRegistry = new StudentRegistry();
    this.questGenerator = new QuestGenerator();
    this.questTracker = new QuestTracker();
    this.scheduleDelayHandler = new ScheduleDelayHandler();
    this.scheduleModifier = new ScheduleModifier();

    // 에이전트 초기화 (Worker Pool)
    this.agents = new Map<Exclude<AgentRole, 'DIRECTOR'>, BaseAgent>();
    this.agents.set('ADMISSION', new AdmissionAgent());
    this.agents.set('PLANNER', new PlannerAgent());
    this.agents.set('COACH', new CoachAgent());
    this.agents.set('ANALYST', new AnalystAgent());

    // 상태 관리자 초기화
    this.stateManager = new ExecutionStateManager();
    this.conversationManager = new ConversationManager();
  }

  /**
   * 메인 처리 엔트리포인트 (Supervisor Loop)
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    const { studentId, message, conversationId, metadata } = request;
    const startTime = Date.now();

    // 1. 실행 상태 초기화/복원
    const state = this.stateManager.getOrCreate(conversationId, studentId);

    // 2. 대화 기록 추가
    this.conversationManager.addMessage(conversationId, 'user', message);

    // 3. 의도 분류 및 라우팅 결정
    const routeDecision = await this.route(message);

    // 4. 컨텍스트 구성 (대화 기록 포함)
    const conversationHistory = this.conversationManager.getHistory(conversationId);
    console.log(`[Supervisor] ConversationId: ${conversationId}, History count: ${conversationHistory.length}`);
    const context = await buildContext(
      studentId,
      message,
      metadata?.currentSubject,
      metadata?.questContext as FrontendQuestContext | undefined,
      this.config,
      this.studentRegistry,
      this.memoryLane,
      this.questTracker,
      this.scheduleDelayHandler,
      conversationHistory,
      metadata?.userProfile  // 학습 프로필 (온보딩에서 수집한 정보)
    );

    // 5. 에이전트 선택 및 실행
    const targetAgent = this.selectAgent(routeDecision);
    this.stateManager.addToExecutionPath(state, targetAgent);

    const agent = this.agents.get(targetAgent);
    if (!agent) {
      const fallback = this.agents.get('COACH')!;
      const response = await fallback.process(request, context);
      return this.finalizeResponse(response, conversationId, state, startTime);
    }

    // 6. 에이전트 실행
    let response = await agent.process(request, context);

    // 7. 특수 처리: SCHEDULE_CHANGE 의도인 경우
    if (routeDecision.intent === 'SCHEDULE_CHANGE' && context.activePlans.length > 0) {
      const rescheduleOptions = generateRescheduleOptionsFromMessage(
        message,
        studentId,
        context.activePlans,
        context.todayQuests ?? null,
        this.scheduleModifier
      );
      if (rescheduleOptions.length > 0) {
        response = {
          ...response,
          rescheduleOptions,
          message: response.message + '\n\n📅 아래 옵션 중 하나를 선택해줘!',
        };
      }
    }

    // 8. 실행 경로 완료 기록
    this.stateManager.completeExecutionPath(state);

    // 9. 후처리 및 응답 반환
    return this.finalizeResponse(response, conversationId, state, startTime);
  }

  /**
   * 의도 기반 라우팅
   */
  private async route(message: string): Promise<RouteDecision> {
    const decision = this.classifier.classify(message);
    const complexity = this.classifier.calculateComplexity(message);
    const selectedModel = this.classifier.selectModel(complexity);
    console.log(`[Supervisor] Route: ${decision.targetAgent}, Model: ${selectedModel}, Complexity: ${(complexity * 100).toFixed(0)}%`);
    return decision;
  }

  /**
   * 에이전트 선택
   */
  private selectAgent(decision: RouteDecision): Exclude<AgentRole, 'DIRECTOR'> {
    if (decision.targetAgent === 'DIRECTOR') {
      return 'COACH';
    }
    return decision.targetAgent as Exclude<AgentRole, 'DIRECTOR'>;
  }

  /**
   * 응답 최종화
   */
  private async finalizeResponse(
    response: AgentResponse,
    conversationId: string,
    state: ExecutionState,
    startTime: number
  ): Promise<AgentResponse> {
    this.conversationManager.addMessage(conversationId, 'assistant', response.message);

    if (this.config.enableMemoryExtraction && response.memoryExtracted) {
      await this.extractMemories(state.studentId, conversationId);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[Supervisor] Completed in ${totalDuration}ms, Path: ${state.executionPath.map(p => p.agent).join(' → ')}`);

    this.stateManager.incrementTurnCount(state);
    return response;
  }

  /**
   * 스트리밍 처리 엔트리포인트 (SSE)
   */
  async *processStream(request: AgentRequest): AsyncGenerator<LLMStreamChunk & { agentRole?: string }> {
    const { studentId, message, conversationId, metadata } = request;

    // 1. 실행 상태 초기화/복원
    const state = this.stateManager.getOrCreate(conversationId, studentId);

    // 2. 대화 기록 추가
    this.conversationManager.addMessage(conversationId, 'user', message);

    // 3. 의도 분류 및 라우팅 결정
    const routeDecision = await this.route(message);

    // 4. 컨텍스트 구성
    const conversationHistory = this.conversationManager.getHistory(conversationId);
    const context = await buildContext(
      studentId,
      message,
      metadata?.currentSubject,
      metadata?.questContext as FrontendQuestContext | undefined,
      this.config,
      this.studentRegistry,
      this.memoryLane,
      this.questTracker,
      this.scheduleDelayHandler,
      conversationHistory,
      metadata?.userProfile  // 학습 프로필 (온보딩에서 수집한 정보)
    );

    // 5. 에이전트 선택
    const targetAgent = this.selectAgent(routeDecision);
    this.stateManager.addToExecutionPath(state, targetAgent);

    const agent = this.agents.get(targetAgent);
    if (!agent) {
      const fallback = this.agents.get('COACH')!;
      yield* this.wrapStreamWithRole(fallback.processStream(request, context), 'COACH');
      return;
    }

    console.log(`[Supervisor/Stream] Routing to ${targetAgent}`);

    // 6. 스트리밍 실행
    let fullMessage = '';
    for await (const chunk of agent.processStream(request, context)) {
      fullMessage += chunk.content;
      yield { ...chunk, agentRole: targetAgent };
    }

    // 7. 대화 기록 저장
    this.conversationManager.addMessage(conversationId, 'assistant', fullMessage);
    this.stateManager.incrementTurnCount(state);

    console.log(`[Supervisor/Stream] Completed for ${targetAgent}`);
  }

  /**
   * 스트리밍에 에이전트 역할 추가
   */
  private async *wrapStreamWithRole(
    stream: AsyncGenerator<LLMStreamChunk>,
    role: string
  ): AsyncGenerator<LLMStreamChunk & { agentRole?: string }> {
    for await (const chunk of stream) {
      yield { ...chunk, agentRole: role };
    }
  }

  /**
   * 메모리 추출
   */
  private async extractMemories(studentId: string, conversationId: string): Promise<void> {
    const history = this.conversationManager.getHistory(conversationId);
    await this.memoryLane.extractAndStore(studentId, {
      conversationId,
      messages: history,
    });
  }

  // ==================== 퀘스트 시스템 ====================

  async generateDailyQuests(studentId: string) {
    return QuestHandler.generateDailyQuests(
      studentId,
      this.config.defaultSubject,
      this.studentRegistry,
      this.memoryLane,
      this.questGenerator,
      this.questTracker
    );
  }

  // ==================== 플랜 API ====================

  async generatePlanFromAnalysis(request: Parameters<typeof PlanHandler.generatePlanFromAnalysis>[0]) {
    const plannerAgent = this.agents.get('PLANNER') as PlannerAgent;
    if (!plannerAgent) throw new Error('PlannerAgent not initialized');
    return PlanHandler.generatePlanFromAnalysis(request, plannerAgent);
  }

  async recordPlanPerformance(performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>) {
    const plannerAgent = this.agents.get('PLANNER') as PlannerAgent;
    if (!plannerAgent) throw new Error('PlannerAgent not initialized');
    return PlanHandler.recordPlanPerformance(performance, plannerAgent);
  }

  async reviewPlan(request: Parameters<typeof PlanHandler.reviewPlan>[0]) {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) throw new Error('AnalystAgent not initialized');
    return PlanHandler.reviewPlan(request, analystAgent);
  }

  async recordReviewPatternOutcome(patternId: string, success: boolean, feedback?: string) {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) throw new Error('AnalystAgent not initialized');
    return PlanHandler.recordReviewPatternOutcome(patternId, success, feedback, analystAgent);
  }

  async createReviewPattern(pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>) {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) throw new Error('AnalystAgent not initialized');
    return PlanHandler.createReviewPattern(pattern, analystAgent);
  }

  async generateAndReviewPlan(request: Parameters<typeof PlanHandler.generatePlanFromAnalysis>[0]) {
    const plannerAgent = this.agents.get('PLANNER') as PlannerAgent;
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!plannerAgent || !analystAgent) throw new Error('Agents not initialized');
    return PlanHandler.generateAndReviewPlan(request, plannerAgent, analystAgent);
  }

  // ==================== 접근자 ====================

  getMemoryLane(): MemoryLane { return this.memoryLane; }
  getStudentRegistry(): StudentRegistry { return this.studentRegistry; }
  getQuestTracker(): QuestTracker { return this.questTracker; }
  getScheduleDelayHandler(): ScheduleDelayHandler { return this.scheduleDelayHandler; }
  getAgent(role: Exclude<AgentRole, 'DIRECTOR'>): BaseAgent | undefined { return this.agents.get(role); }
  getCoachAgent(): CoachAgent { return this.agents.get('COACH') as CoachAgent; }
  getAdmissionAgent(): AdmissionAgent { return this.agents.get('ADMISSION') as AdmissionAgent; }
  getExecutionState(conversationId: string): ExecutionState | undefined { return this.stateManager.get(conversationId); }
}
