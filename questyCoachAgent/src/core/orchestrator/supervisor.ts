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
  DirectorContext,
  RouteDecision,
  StudyPlan,
} from '../../types/agent.js';
import type {
  Subject,
  TopicMastery,
  AnalyzedUnit,
  DetectedStudyPlan,
  PlanPerformanceMemory,
  AIGeneratedQuest,
  PlanReview,
} from '../../types/memory.js';
import { IntentClassifier } from '../router/index.js';
import {
  BaseAgent,
  CoachAgent,
  PlannerAgent,
  AnalystAgent,
  AdmissionAgent,
  type DualPlanResult,
  type AIRecommendation,
  type ExtendedPlanReview,
} from '../agents/index.js';
import { MemoryLane } from '../../memory/index.js';
import { getLLMClient, type LLMClient } from '../../llm/index.js';
import { StudentRegistry } from '../../registry/index.js';
import { QuestGenerator, QuestTracker, ScheduleDelayHandler, ScheduleModifier } from '../../quest/index.js';
import type { DelayAnalysis, DelayNotification, RescheduleOption } from '../../quest/index.js';
import type { TodayQuests } from '../../types/quest.js';

export interface SupervisorConfig {
  enableMemoryExtraction: boolean;
  enableBurnoutCheck: boolean;
  enableQuestSystem: boolean;
  defaultSubject: Subject;
  maxConcurrentAgents: number;
}

const DEFAULT_CONFIG: SupervisorConfig = {
  enableMemoryExtraction: true,
  enableBurnoutCheck: true,
  enableQuestSystem: true,
  defaultSubject: 'GENERAL',
  maxConcurrentAgents: 3,
};

// 실행 상태 추적
interface ExecutionState {
  conversationId: string;
  studentId: string;
  activeAgent: AgentRole;
  executionPath: Array<{
    agent: AgentRole;
    timestamp: Date;
    duration?: number;
  }>;
  turnCount: number;
}

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

  // 실행 상태 추적
  private executionStates: Map<string, ExecutionState>;  // conversationId → state

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

    // 실행 상태 추적
    this.executionStates = new Map();
  }

  /**
   * 메인 처리 엔트리포인트 (Supervisor Loop)
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    const { studentId, message, conversationId, metadata } = request;
    const startTime = Date.now();

    // 1. 실행 상태 초기화/복원
    const state = this.getOrCreateState(conversationId, studentId);

    // 2. 대화 기록 추가
    this.addToConversationHistory(conversationId, 'user', message);

    // 3. 의도 분류 및 라우팅 결정 (Supervisor Decision)
    const routeDecision = await this.route(message, state);

    // 4. 컨텍스트 구성 (프론트엔드 questContext 포함)
    const context = await this.buildContext(studentId, message, metadata?.currentSubject, metadata?.questContext);

    // 5. 에이전트 선택 및 실행 (Worker Delegation)
    const targetAgent = this.selectAgent(routeDecision);
    state.activeAgent = targetAgent;
    state.executionPath.push({
      agent: targetAgent,
      timestamp: new Date(),
    });

    const agent = this.agents.get(targetAgent);
    if (!agent) {
      // 폴백: Coach 에이전트
      const fallback = this.agents.get('COACH')!;
      const response = await fallback.process(request, context);
      return this.finalizeResponse(response, conversationId, state, startTime);
    }

    // 6. 에이전트 실행
    let response = await agent.process(request, context);

    // 7.5 특수 처리: SCHEDULE_CHANGE 의도인 경우 재조정 옵션 생성
    if (routeDecision.intent === 'SCHEDULE_CHANGE' && context.activePlans.length > 0) {
      const rescheduleOptions = this.generateRescheduleOptionsFromMessage(
        message,
        studentId,
        context.activePlans,
        context.todayQuests ?? null
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
    const lastPath = state.executionPath[state.executionPath.length - 1];
    if (lastPath) {
      lastPath.duration = Date.now() - lastPath.timestamp.getTime();
    }

    // 9. 후처리 및 응답 반환
    return this.finalizeResponse(response, conversationId, state, startTime);
  }

  /**
   * 의도 기반 라우팅 (Supervisor Routing)
   */
  private async route(message: string, state: ExecutionState): Promise<RouteDecision> {
    // 3-Level Router: 복잡도 기반 동적 라우팅
    const decision = this.classifier.classify(message);
    const complexity = this.classifier.calculateComplexity(message);

    // 복잡도에 따른 모델 선택 로깅
    const selectedModel = this.classifier.selectModel(complexity);
    console.log(`[Supervisor] Route: ${decision.targetAgent}, Model: ${selectedModel}, Complexity: ${(complexity * 100).toFixed(0)}%`);

    return decision;
  }

  /**
   * 에이전트 선택 (Worker Selection)
   */
  private selectAgent(decision: RouteDecision): Exclude<AgentRole, 'DIRECTOR'> {
    // DIRECTOR로 라우팅된 경우 기본 COACH로 폴백
    if (decision.targetAgent === 'DIRECTOR') {
      return 'COACH';
    }
    return decision.targetAgent as Exclude<AgentRole, 'DIRECTOR'>;
  }

  /**
   * 컨텍스트 구성
   */
  private async buildContext(
    studentId: string,
    query: string,
    currentSubject?: Subject,
    frontendQuestContext?: {
      todayQuests?: Array<{
        unitTitle: string;
        range: string;
        completed?: boolean;
        estimatedMinutes?: number;
        planName?: string;
        planId?: string;
        day?: number;
      }>;
      // 전체 일정 정보
      activePlans?: Array<{
        id: string;
        title: string;
        textbookTitle?: string;
        subject?: string;
        totalDays: number;
        completedDays: number;
        startDate: string;
        targetEndDate: string;
        status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
        dailyQuests?: Array<{
          day: number;
          date: string;
          unitTitle: string;
          range: string;
          completed: boolean;
          estimatedMinutes?: number;
        }>;
      }>;
      upcomingQuests?: Array<{
        date: string;
        quests: Array<{
          planId: string;
          planTitle: string;
          day: number;
          unitTitle: string;
          range: string;
          estimatedMinutes?: number;
        }>;
      }>;
      weeklyStats?: {
        totalQuests: number;
        completedQuests: number;
        completionRate: number;
        streakDays: number;
        averageMinutesPerDay: number;
      };
      plansCount?: number;
      completedToday?: number;
      totalToday?: number;
    }
  ): Promise<DirectorContext> {
    // 학생 프로필
    const studentProfile = this.studentRegistry.getStudent(studentId) ??
      this.studentRegistry.createStudent({ name: '학생' });

    // 활성 학습 계획
    const activePlans = this.studentRegistry.getActivePlans(studentId);

    // 메모리 컨텍스트
    const memoryContext = await this.memoryLane.retrieveContext({
      studentId,
      query,
      currentSubject: currentSubject ?? this.config.defaultSubject,
    });

    // 최근 대화 (간소화)
    const recentConversations: DirectorContext['recentConversations'] = [];

    // 🆕 퀘스트 컨텍스트 추가 (코치 대화용)
    // 1. 내부 tracker에서 조회
    let todayQuests = this.questTracker.getTodayQuests(studentId);

    // 2. 프론트엔드 questContext가 있고 내부 tracker가 비어있으면 변환하여 사용
    if (!todayQuests && frontendQuestContext?.todayQuests && frontendQuestContext.todayQuests.length > 0) {
      console.log(`[Supervisor] Using frontend questContext: ${frontendQuestContext.todayQuests.length} quests`);
      todayQuests = this.convertFrontendQuestContext(studentId, frontendQuestContext);
    }

    const delayAnalysis = this.scheduleDelayHandler.analyzeDelays(studentId, todayQuests);
    const questStats = this.questTracker.getStats(studentId, 'WEEK');

    // 전체 일정 컨텍스트 추출
    const fullScheduleContext = frontendQuestContext ? {
      activePlans: frontendQuestContext.activePlans,
      upcomingQuests: frontendQuestContext.upcomingQuests,
      weeklyStats: frontendQuestContext.weeklyStats,
    } : undefined;

    if (fullScheduleContext?.activePlans?.length) {
      console.log(`[Supervisor] Full schedule: ${fullScheduleContext.activePlans.length} active plans`);
    }
    if (fullScheduleContext?.upcomingQuests?.length) {
      console.log(`[Supervisor] Upcoming quests: ${fullScheduleContext.upcomingQuests.length} days scheduled`);
    }

    return {
      studentProfile,
      activePlans,
      memoryContext,
      recentConversations,
      todayQuests: todayQuests ?? undefined,
      delayAnalysis,
      questStats,
      fullScheduleContext,
    };
  }

  /**
   * 프론트엔드 questContext를 TodayQuests 형식으로 변환
   */
  private convertFrontendQuestContext(
    studentId: string,
    frontendContext: {
      todayQuests?: Array<{
        unitTitle: string;
        range: string;
        completed?: boolean;
        estimatedMinutes?: number;
        planName?: string;
        planId?: string;
        day?: number;
      }>;
      plansCount?: number;
      completedToday?: number;
      totalToday?: number;
    }
  ): TodayQuests {
    const now = new Date();
    const quests = frontendContext.todayQuests ?? [];

    // 프론트엔드 퀘스트를 DailyQuest 형식으로 변환
    const mainQuests: import('../../types/quest.js').DailyQuest[] = quests.map((q, idx) => {
      const estimatedMins = q.estimatedMinutes ?? 30;
      const isCompleted = q.completed ?? false;
      return {
        id: `frontend-quest-${idx}-${Date.now()}`,
        studentId,
        date: now,
        type: 'STUDY' as const,
        title: q.unitTitle,
        description: q.range,
        subject: 'GENERAL' as const,
        planId: q.planId,
        targetValue: estimatedMins,
        currentValue: isCompleted ? estimatedMins : 0,
        unit: '분',
        status: isCompleted ? 'COMPLETED' as const : 'AVAILABLE' as const,
        difficulty: 'MEDIUM' as const,
        priority: 1,
        xpReward: 100,
        estimatedMinutes: estimatedMins,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        tags: q.planName ? [q.planName] : [],
        // day 정보 저장 (확장)
        ...(q.day !== undefined && { day: q.day }),
      };
    });

    return {
      studentId,
      date: now,
      mainQuests,
      bonusQuests: [],
      reviewQuests: [],
      summary: {
        totalQuests: quests.length,
        completedQuests: frontendContext.completedToday ?? quests.filter(q => q.completed === true).length,
        inProgressQuests: 0,
        availableQuests: quests.filter(q => q.completed !== true).length,
        totalXpAvailable: quests.length * 100,
        earnedXp: (frontendContext.completedToday ?? 0) * 100,
        estimatedTotalMinutes: quests.reduce((sum, q) => sum + (q.estimatedMinutes ?? 30), 0),
        actualSpentMinutes: 0,
        streakDays: 0,
        isStreakActive: false,
        completionRate: frontendContext.completedToday && frontendContext.totalToday
          ? frontendContext.completedToday / frontendContext.totalToday
          : 0,
      },
      dailyMessage: '오늘도 화이팅!',
      coachTip: '',
      generatedAt: now,
      generatedBy: 'SYSTEM',
    };
  }

  /**
   * 메시지에서 일정 변경 요청 파싱 및 옵션 생성
   */
  private generateRescheduleOptionsFromMessage(
    message: string,
    studentId: string,
    activePlans: StudyPlan[],
    todayQuests: TodayQuests | null
  ): RescheduleOption[] {
    // 메시지에서 일수 추출 (간단한 파싱)
    const skipDays = this.parseSkipDaysFromMessage(message);

    if (skipDays === 0) {
      // 기본값: 3일
      return this.scheduleModifier.generateRescheduleOptions(
        { studentId, skipDays: this.generateDateRange(3) },
        activePlans,
        todayQuests
      );
    }

    const skipDates = this.generateDateRange(skipDays);

    return this.scheduleModifier.generateRescheduleOptions(
      { studentId, skipDays: skipDates },
      activePlans,
      todayQuests
    );
  }

  /**
   * 메시지에서 건너뛸 일수 파싱
   */
  private parseSkipDaysFromMessage(message: string): number {
    // "3일", "며칠", "일주일" 등 파싱
    const dayMatch = message.match(/(\d+)\s*일/);
    if (dayMatch) {
      return parseInt(dayMatch[1], 10);
    }

    // 특정 키워드
    if (/일주일|1주/.test(message)) return 7;
    if (/이틀|2일|내일.*모레/.test(message)) return 2;
    if (/사흘|3일/.test(message)) return 3;
    if (/나흘|4일/.test(message)) return 4;
    if (/닷새|5일/.test(message)) return 5;
    if (/내일/.test(message)) return 1;

    return 0;
  }

  /**
   * 날짜 범위 생성
   */
  private generateDateRange(days: number): Date[] {
    const dates: Date[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i + 1); // 내일부터
      dates.push(date);
    }

    return dates;
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
    // 대화 기록 추가
    this.addToConversationHistory(conversationId, 'assistant', response.message);

    // 메모리 추출 (필요 시)
    if (this.config.enableMemoryExtraction && response.memoryExtracted) {
      await this.extractMemories(state.studentId, conversationId);
    }

    // 실행 통계 로깅
    const totalDuration = Date.now() - startTime;
    console.log(`[Supervisor] Completed in ${totalDuration}ms, Path: ${state.executionPath.map(p => p.agent).join(' → ')}`);

    // 턴 카운트 증가
    state.turnCount++;

    return response;
  }

  /**
   * 메모리 추출
   */
  private async extractMemories(studentId: string, conversationId: string): Promise<void> {
    // 간소화된 메모리 추출
    const history = this.getConversationHistory(conversationId);

    await this.memoryLane.extractAndStore(studentId, {
      conversationId,
      messages: history,
    });
  }

  // ==================== 상태 관리 ====================

  private getOrCreateState(conversationId: string, studentId: string): ExecutionState {
    let state = this.executionStates.get(conversationId);

    if (!state) {
      state = {
        conversationId,
        studentId,
        activeAgent: 'COACH',
        executionPath: [],
        turnCount: 0,
      };
      this.executionStates.set(conversationId, state);
    }

    return state;
  }

  // ==================== 대화 기록 관리 ====================

  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>> = new Map();

  private addToConversationHistory(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const history = this.conversationHistory.get(conversationId) ?? [];
    history.push({ role, content, timestamp: new Date() });

    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.conversationHistory.set(conversationId, history);
  }

  private getConversationHistory(conversationId: string) {
    return this.conversationHistory.get(conversationId) ?? [];
  }

  // ==================== 퀘스트 시스템 통합 ====================

  /**
   * 오늘의 퀘스트 생성
   */
  async generateDailyQuests(studentId: string) {
    const profile = this.studentRegistry.getStudent(studentId);
    if (!profile) return null;

    const activePlans = this.studentRegistry.getActivePlans(studentId);
    const reviewTopics = this.memoryLane.getReviewRecommendations(studentId);

    // 복습 필요 토픽 (TopicMastery 형태로 변환)
    const reviewDueTopics: TopicMastery[] = reviewTopics.map(topicId => ({
      topicId,
      subject: this.config.defaultSubject,
      masteryScore: 0.5,
      easinessFactor: 2.5,        // SM-2 EF
      interval: 1,                 // 복습 간격 (일)
      repetitions: 1,              // 반복 횟수
      nextReviewDate: new Date(),
      lastReviewDate: new Date(),
      totalAttempts: 1,
      successfulAttempts: 0,
    }));

    const todayQuests = await this.questGenerator.generateTodayQuests({
      request: {
        studentId,
        date: new Date(),
        activePlans: activePlans.map(p => p.id),
        reviewTopics: reviewTopics,
      },
      studentProfile: profile,
      activePlans,
      reviewDueTopics,
      currentStreak: this.questTracker.getStreak(studentId),
    });

    this.questTracker.saveTodayQuests(todayQuests);

    return todayQuests;
  }

  // ==================== 접근자 ====================

  getMemoryLane(): MemoryLane {
    return this.memoryLane;
  }

  getStudentRegistry(): StudentRegistry {
    return this.studentRegistry;
  }

  getQuestTracker(): QuestTracker {
    return this.questTracker;
  }

  getScheduleDelayHandler(): ScheduleDelayHandler {
    return this.scheduleDelayHandler;
  }

  getAgent(role: Exclude<AgentRole, 'DIRECTOR'>): BaseAgent | undefined {
    return this.agents.get(role);
  }

  getCoachAgent(): CoachAgent {
    return this.agents.get('COACH') as CoachAgent;
  }

  getAdmissionAgent(): AdmissionAgent {
    return this.agents.get('ADMISSION') as AdmissionAgent;
  }

  getExecutionState(conversationId: string): ExecutionState | undefined {
    return this.executionStates.get(conversationId);
  }

  // ==================== AI 플랜 생성 API (진화형) ====================

  /**
   * AI 기반 플랜 생성 (목차 분석 결과 활용)
   * PlannerAgent의 진화형 플랜 생성 기능 노출
   *
   * @param request - 플랜 생성 요청
   * @returns 듀얼 플랜 결과 (원본 + 맞춤 플랜)
   */
  async generatePlanFromAnalysis(request: {
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
  }) {
    const plannerAgent = this.agents.get('PLANNER') as PlannerAgent;
    if (!plannerAgent) {
      throw new Error('PlannerAgent not initialized');
    }

    console.log(`[Supervisor] Delegating plan generation for ${request.studentId}`);

    return plannerAgent.generatePlanFromAnalysis(request);
  }

  /**
   * 플랜 성과 기록 (진화 학습용)
   * 플랜 완료 후 성과를 기록하여 다음 플랜 생성 시 활용
   *
   * @param performance - 플랜 성과 데이터
   */
  async recordPlanPerformance(
    performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
  ): Promise<void> {
    const plannerAgent = this.agents.get('PLANNER') as PlannerAgent;
    if (!plannerAgent) {
      throw new Error('PlannerAgent not initialized');
    }

    console.log(`[Supervisor] Recording plan performance for ${performance.planId}`);

    return plannerAgent.recordPlanPerformance(performance);
  }

  // ==================== AI 플랜 리뷰 API (진화형) ====================

  /**
   * AI 플랜 리뷰 (진화 학습 포함)
   * AnalystAgent의 진화형 플랜 리뷰 기능 노출
   *
   * @param request - 플랜 리뷰 요청
   * @returns 확장된 플랜 리뷰 결과
   */
  async reviewPlan(request: {
    materialName: string;
    planName: string;
    dailyQuests: AIGeneratedQuest[];
    totalDays: number;
    totalEstimatedHours: number;
    subject?: Subject;
  }) {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) {
      throw new Error('AnalystAgent not initialized');
    }

    console.log(`[Supervisor] Delegating plan review for ${request.planName}`);

    return analystAgent.reviewPlan(request);
  }

  /**
   * 리뷰 패턴 성공/실패 기록 (진화 학습용)
   * 리뷰 제안에 대한 피드백을 기록하여 패턴 신뢰도 조정
   *
   * @param patternId - 패턴 ID
   * @param success - 성공 여부
   * @param feedback - 사용자 피드백 (선택)
   */
  async recordReviewPatternOutcome(
    patternId: string,
    success: boolean,
    feedback?: string
  ): Promise<void> {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) {
      throw new Error('AnalystAgent not initialized');
    }

    console.log(`[Supervisor] Recording pattern outcome for ${patternId}: ${success}`);

    return analystAgent.recordPatternOutcome(patternId, success, feedback);
  }

  /**
   * 새로운 리뷰 패턴 생성 (학습)
   * 새로운 패턴을 발견하여 기록
   *
   * @param pattern - 새로운 패턴 정보
   * @returns 생성된 패턴 ID
   */
  async createReviewPattern(pattern: {
    patternId: string;
    patternName: string;
    description: string;
    triggerConditions: {
      planDuration?: { min?: number; max?: number };
      dailyMinutes?: { min?: number; max?: number };
      subject?: Subject[];
      unitCount?: { min?: number; max?: number };
    };
    issueDescription: string;
    suggestedFix: string;
    successfulFixCount: number;
    failedFixCount: number;
    confidence: number;
    validationScore: number;
  }): Promise<string> {
    const analystAgent = this.agents.get('ANALYST') as AnalystAgent;
    if (!analystAgent) {
      throw new Error('AnalystAgent not initialized');
    }

    console.log(`[Supervisor] Creating new review pattern: ${pattern.patternName}`);

    return analystAgent.createReviewPattern(pattern);
  }

  // ==================== 통합 플랜 생성 + 리뷰 ====================

  /**
   * 플랜 생성 및 자동 리뷰
   * 플랜을 생성하고 자동으로 리뷰까지 수행
   *
   * @param request - 플랜 생성 요청
   * @returns 플랜 + 리뷰 결과
   */
  async generateAndReviewPlan(request: {
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
  }) {
    console.log(`[Supervisor] Starting integrated plan generation and review for ${request.studentId}`);

    // 1. 플랜 생성
    const planResult = await this.generatePlanFromAnalysis(request);

    // 2. 각 플랜에 대해 리뷰 수행
    const reviewedPlans = await Promise.all(
      planResult.plans.map(async (plan) => {
        const review = await this.reviewPlan({
          materialName: request.materialName,
          planName: plan.planName,
          dailyQuests: plan.dailyQuests,
          totalDays: plan.totalDays,
          totalEstimatedHours: plan.totalEstimatedHours,
          subject: request.bookMetadata?.subject as Subject | undefined,
        });

        return {
          plan,
          review,
        };
      })
    );

    console.log(`[Supervisor] Completed integrated generation: ${reviewedPlans.length} plans reviewed`);

    return {
      hasOriginalPlan: planResult.hasOriginalPlan,
      reviewedPlans,
      recommendations: planResult.recommendations,
      message: planResult.message,
    };
  }
}
