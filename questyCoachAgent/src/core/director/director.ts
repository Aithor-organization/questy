/**
 * Director
 * AI Coach 시스템의 오케스트레이터
 * - 의도 분류 및 에이전트 라우팅
 * - 컨텍스트 관리
 * - 메모리 통합
 */

import { IntentClassifier } from '../router/index.js';
import { CoachAgent, PlannerAgent, AnalystAgent, AdmissionAgent, BaseAgent } from '../agents/index.js';
import { MemoryLane } from '../../memory/index.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  AgentRole,
  StudentProfile,
  StudyPlan,
} from '../../types/agent.js';
import type { Subject, MemoryExtractionRequest } from '../../types/memory.js';

export interface DirectorConfig {
  enableMemoryExtraction: boolean;
  enableBurnoutCheck: boolean;
  defaultSubject: Subject;
}

const DEFAULT_CONFIG: DirectorConfig = {
  enableMemoryExtraction: true,
  enableBurnoutCheck: true,
  defaultSubject: 'GENERAL',
};

export class Director {
  private config: DirectorConfig;
  private classifier: IntentClassifier;
  private memoryLane: MemoryLane;

  // 에이전트 풀 (DIRECTOR 제외)
  private agents: Map<Exclude<AgentRole, 'DIRECTOR'>, BaseAgent>;

  // 학생 데이터 (실제로는 DB에서 로드)
  private studentProfiles: Map<string, StudentProfile>;
  private studentPlans: Map<string, StudyPlan[]>;
  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>;

  constructor(config: Partial<DirectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = new IntentClassifier();
    this.memoryLane = new MemoryLane({
      enableAutoExtraction: this.config.enableMemoryExtraction,
      enableBurnoutMonitoring: this.config.enableBurnoutCheck,
    });

    // 에이전트 초기화
    this.agents = new Map<Exclude<AgentRole, 'DIRECTOR'>, BaseAgent>();
    this.agents.set('ADMISSION', new AdmissionAgent());
    this.agents.set('PLANNER', new PlannerAgent());
    this.agents.set('COACH', new CoachAgent());
    this.agents.set('ANALYST', new AnalystAgent());

    this.studentProfiles = new Map();
    this.studentPlans = new Map();
    this.conversationHistory = new Map();
  }

  /**
   * 메인 처리 엔트리포인트
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    const { studentId, message, conversationId, metadata } = request;

    // 1. 대화 기록 업데이트
    this.addToHistory(conversationId, 'user', message);

    // 2. 의도 분류 및 라우팅
    const routeDecision = this.classifier.classify(message);

    // 3. 번아웃 체크 (필요시)
    if (this.config.enableBurnoutCheck) {
      const burnoutCheck = this.memoryLane.shouldContinueStudying(studentId);
      if (burnoutCheck.recommendation === 'STOP_TODAY') {
        const response = this.createBurnoutResponse(burnoutCheck.reason);
        this.addToHistory(conversationId, 'assistant', response.message);
        return response;
      }
    }

    // 4. 컨텍스트 구성
    const context = await this.buildContext(studentId, message, metadata?.currentSubject);

    // 5. 에이전트 선택 및 실행
    const targetAgent = routeDecision.targetAgent === 'DIRECTOR' ? 'COACH' : routeDecision.targetAgent;
    const agent = this.agents.get(targetAgent);
    if (!agent) {
      // 기본 Coach로 폴백
      const fallbackAgent = this.agents.get('COACH')!;
      const response = await fallbackAgent.process(request, context);
      this.addToHistory(conversationId, 'assistant', response.message);
      return response;
    }

    const response = await agent.process(request, context);

    // 6. 메모리 추출 (대화 후)
    if (this.config.enableMemoryExtraction) {
      await this.extractMemories(studentId, conversationId);
    }

    // 7. 대화 기록 업데이트
    this.addToHistory(conversationId, 'assistant', response.message);

    return response;
  }

  /**
   * 컨텍스트 구성
   */
  private async buildContext(
    studentId: string,
    query: string,
    currentSubject?: Subject
  ): Promise<DirectorContext> {
    // 학생 프로필 (없으면 기본값)
    const studentProfile = this.studentProfiles.get(studentId) ?? this.createDefaultProfile(studentId);

    // 활성 학습 계획
    const activePlans = this.studentPlans.get(studentId)?.filter((p) => p.status === 'ACTIVE') ?? [];

    // 메모리 컨텍스트
    const memoryContext = await this.memoryLane.retrieveContext({
      studentId,
      query,
      currentSubject: currentSubject ?? this.config.defaultSubject,
    });

    // 최근 대화
    const recentConversations = this.getRecentConversations(studentId);

    return {
      studentProfile,
      activePlans,
      memoryContext,
      recentConversations,
    };
  }

  /**
   * 메모리 추출
   */
  private async extractMemories(studentId: string, conversationId: string): Promise<void> {
    const history = this.conversationHistory.get(conversationId) ?? [];

    const request: MemoryExtractionRequest = {
      conversationId,
      messages: history,
    };

    await this.memoryLane.extractAndStore(studentId, request);
  }

  /**
   * 번아웃 응답 생성
   */
  private createBurnoutResponse(reason: string): AgentResponse {
    return {
      agentRole: 'DIRECTOR',
      message: `😊 잠깐! ${reason}

오늘은 무리하지 말고 쉬어가는 게 어떨까요?
- 가벼운 산책하기 🚶
- 좋아하는 음악 듣기 🎵
- 충분히 수면 취하기 😴

내일 컨디션이 좋아지면 다시 만나요! 💪`,
      actions: [],
      memoryExtracted: false,
      suggestedFollowUp: ['기분이 나아지면 알려줘', '쉬고 나서 다시 시작하자'],
    };
  }

  /**
   * 기본 프로필 생성
   */
  private createDefaultProfile(studentId: string): StudentProfile {
    return {
      id: studentId,
      name: '학생',
      grade: '미설정',
      enrolledSubjects: [],
      goals: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
  }

  /**
   * 대화 기록 추가
   */
  private addToHistory(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const history = this.conversationHistory.get(conversationId) ?? [];
    history.push({
      role,
      content,
      timestamp: new Date(),
    });

    // 최근 50개만 유지
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.conversationHistory.set(conversationId, history);
  }

  /**
   * 최근 대화 조회
   */
  private getRecentConversations(studentId: string): DirectorContext['recentConversations'] {
    // 모든 대화에서 해당 학생 것만 추출 (간단한 구현)
    for (const history of this.conversationHistory.values()) {
      if (history.length > 0) {
        return history.slice(-10);
      }
    }
    return [];
  }

  /**
   * 학생 프로필 설정
   */
  setStudentProfile(profile: StudentProfile): void {
    this.studentProfiles.set(profile.id, profile);
  }

  /**
   * 학습 계획 추가
   */
  addStudyPlan(studentId: string, plan: StudyPlan): void {
    const plans = this.studentPlans.get(studentId) ?? [];
    plans.push(plan);
    this.studentPlans.set(studentId, plans);
  }

  /**
   * 학습 결과 기록
   */
  recordLearningResult(params: {
    studentId: string;
    topicId: string;
    quality: number;
  }) {
    return this.memoryLane.recordLearningResult(params);
  }

  /**
   * Memory Lane 직접 접근 (고급 기능)
   */
  getMemoryLane(): MemoryLane {
    return this.memoryLane;
  }

  /**
   * 에이전트 직접 접근 (테스트용)
   */
  getAgent(role: Exclude<AgentRole, 'DIRECTOR'>): BaseAgent | undefined {
    return this.agents.get(role);
  }
}
