/**
 * Supervisor E2E 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Supervisor } from '../../src/core/orchestrator/supervisor/index.js';
import type { AgentRequest } from '../../src/types/agent.js';

// 의존성 모킹
vi.mock('../../src/llm/index.js', () => ({
  getLLMClient: () => ({
    call: vi.fn().mockResolvedValue({
      content: '모의 LLM 응답',
      model: 'claude-4.5-haiku',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
    callWithComplexity: vi.fn().mockResolvedValue({
      content: '모의 LLM 응답',
      model: 'claude-4.5-haiku',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
  }),
}));

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    getOrCreateCollection: vi.fn().mockResolvedValue({
      add: vi.fn(),
      query: vi.fn().mockResolvedValue({ documents: [[]], ids: [[]], metadatas: [[]], distances: [[]] }),
      get: vi.fn().mockResolvedValue({ documents: [], ids: [], metadatas: [] }),
    }),
    heartbeat: vi.fn().mockResolvedValue(Date.now()),
  })),
  IncludeEnum: {
    Metadatas: 'metadatas',
    Documents: 'documents',
    Distances: 'distances',
    Embeddings: 'embeddings',
  },
}));

describe('Supervisor', () => {
  let supervisor: Supervisor;

  beforeEach(() => {
    supervisor = new Supervisor({
      enableMemoryExtraction: false,
      enableBurnoutCheck: false,
      enableQuestSystem: true,
      defaultSubject: 'GENERAL',
      maxConcurrentAgents: 3,
    });
  });

  describe('모듈 로딩', () => {
    it('Supervisor가 정상적으로 로드된다', () => {
      expect(supervisor).toBeDefined();
      expect(supervisor).toBeInstanceOf(Supervisor);
    });

    it('모든 에이전트가 초기화된다', () => {
      expect(supervisor.getAgent('COACH')).toBeDefined();
      expect(supervisor.getAgent('ADMISSION')).toBeDefined();
      expect(supervisor.getAgent('PLANNER')).toBeDefined();
      expect(supervisor.getAgent('ANALYST')).toBeDefined();
    });

    it('컴포넌트 접근자가 작동한다', () => {
      expect(supervisor.getMemoryLane()).toBeDefined();
      expect(supervisor.getStudentRegistry()).toBeDefined();
      expect(supervisor.getQuestTracker()).toBeDefined();
      expect(supervisor.getScheduleDelayHandler()).toBeDefined();
    });
  });

  describe('process()', () => {
    it('일반 학습 요청을 CoachAgent로 라우팅한다', async () => {
      const request: AgentRequest = {
        studentId: 'student-1',
        message: '수학 공식 알려줘',
        conversationId: 'conv-1',
      };

      const response = await supervisor.process(request);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('분석 요청을 AnalystAgent로 라우팅한다', async () => {
      const request: AgentRequest = {
        studentId: 'student-1',
        message: '내 학습 현황 분석해줘',
        conversationId: 'conv-2',
      };

      const response = await supervisor.process(request);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('일정 변경 요청에 응답한다', async () => {
      // 먼저 활성 플랜을 등록
      const registry = supervisor.getStudentRegistry();
      registry.createStudent({ name: '테스트' });

      const request: AgentRequest = {
        studentId: 'student-1',
        message: '내일 공부 못해, 일정 조정해줘',
        conversationId: 'conv-3',
      };

      const response = await supervisor.process(request);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });
  });

  describe('실행 상태 추적', () => {
    it('실행 상태를 생성하고 추적한다', async () => {
      const request: AgentRequest = {
        studentId: 'student-1',
        message: '안녕',
        conversationId: 'conv-state-test',
      };

      await supervisor.process(request);

      const state = supervisor.getExecutionState('conv-state-test');
      expect(state).toBeDefined();
      expect(state?.conversationId).toBe('conv-state-test');
      expect(state?.turnCount).toBe(1);
      expect(state?.executionPath.length).toBeGreaterThan(0);
    });

    it('동일 대화에서 턴 카운트가 증가한다', async () => {
      const conversationId = 'conv-multi-turn';

      await supervisor.process({
        studentId: 'student-1',
        message: '첫 번째 메시지',
        conversationId,
      });

      await supervisor.process({
        studentId: 'student-1',
        message: '두 번째 메시지',
        conversationId,
      });

      const state = supervisor.getExecutionState(conversationId);
      expect(state?.turnCount).toBe(2);
    });
  });

  describe('플랜 API', () => {
    it('플랜 생성 API가 작동한다', async () => {
      const planResult = await supervisor.generatePlanFromAnalysis({
        studentId: 'student-1',
        materialName: '수학 기본서',
        analyzedUnits: [
          {
            unitId: 'unit-1',
            unitNumber: 1,
            unitTitle: '1단원',
            pageRange: { start: 1, end: 20 },
            estimatedDifficulty: 'MEDIUM',
            difficulty: 'MEDIUM',
            estimatedMinutes: 60,
            conceptTags: ['함수'],
            prerequisites: [],
            subSections: ['1-1. 함수의 정의', '1-2. 함수의 성질'],
          },
        ],
        targetDays: 30,
      });

      expect(planResult).toBeDefined();
      expect(planResult.plans).toBeDefined();
    });
  });
});
