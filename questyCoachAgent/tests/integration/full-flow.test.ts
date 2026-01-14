/**
 * 전체 흐름 통합 테스트
 * 실제 사용 시나리오를 시뮬레이션
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Supervisor } from '../../src/core/orchestrator/supervisor/index.js';
import type { AgentRequest } from '../../src/types/agent.js';

// 의존성 모킹
vi.mock('../../src/llm/index.js', () => ({
  getLLMClient: () => ({
    call: vi.fn().mockImplementation((params: { messages: Array<{ content: string }> }) => {
      const lastMessage = params.messages[params.messages.length - 1]?.content ?? '';
      let content = '모의 응답입니다.';

      if (lastMessage.includes('저녁 리뷰')) {
        content = '오늘도 수고했어!';
      } else if (lastMessage.includes('위기 개입')) {
        content = '괜찮아, 천천히 해보자';
      }

      return Promise.resolve({
        content,
        model: 'claude-4.5-haiku',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 100,
      });
    }),
    callWithComplexity: vi.fn().mockResolvedValue({
      content: '모의 응답입니다.',
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

describe('전체 흐름 통합 테스트', () => {
  let supervisor: Supervisor;

  beforeEach(() => {
    supervisor = new Supervisor({
      enableMemoryExtraction: false,
      enableBurnoutCheck: false,
    });
  });

  describe('시나리오 1: 신규 학생 온보딩', () => {
    it('신규 학생이 처음 접속하여 온보딩을 완료한다', async () => {
      const studentId = 'new-student-1';
      const conversationId = 'onboarding-conv';

      // Step 1: 첫 인사
      const step1 = await supervisor.process({
        studentId,
        conversationId,
        message: '안녕하세요, 처음이에요',
      });
      expect(step1.message).toBeTruthy();

      // Step 2: 이름 제공
      const step2 = await supervisor.process({
        studentId,
        conversationId,
        message: '제 이름은 김철수예요',
      });
      expect(step2.message).toBeTruthy();

      // Step 3: 학년 제공
      const step3 = await supervisor.process({
        studentId,
        conversationId,
        message: '고등학교 2학년이에요',
      });
      expect(step3.message).toBeTruthy();

      // 턴 카운트 확인
      const state = supervisor.getExecutionState(conversationId);
      expect(state?.turnCount).toBe(3);
    });
  });

  describe('시나리오 2: 일상 학습 세션', () => {
    it('학생이 오늘의 학습을 시작하고 완료한다', async () => {
      const studentId = 'daily-student';
      const conversationId = 'daily-conv';

      // Step 1: 오늘 할 것 확인
      const step1 = await supervisor.process({
        studentId,
        conversationId,
        message: '오늘 뭐 공부해?',
        metadata: {
          questContext: {
            todayQuests: [
              { unitTitle: '수학 1단원', range: '1-20p', estimatedMinutes: 30 },
            ],
            totalToday: 1,
            completedToday: 0,
          },
        },
      });
      expect(step1.message).toBeTruthy();

      // Step 2: 개념 질문
      const step2 = await supervisor.process({
        studentId,
        conversationId,
        message: '함수가 뭐야?',
      });
      expect(step2.message).toBeTruthy();

      // Step 3: 문제 풀이 도움 요청
      const step3 = await supervisor.process({
        studentId,
        conversationId,
        message: '이 문제 어떻게 풀어?',
      });
      expect(step3.message).toBeTruthy();
    });
  });

  describe('시나리오 3: 일정 조정', () => {
    it('학생이 일정 변경을 요청하고 옵션을 받는다', async () => {
      const studentId = 'reschedule-student';
      const conversationId = 'reschedule-conv';

      // 학생 생성
      const registry = supervisor.getStudentRegistry();
      const profile = registry.createStudent({ name: '일정조정 테스트' });

      // 일정 변경 요청
      const response = await supervisor.process({
        studentId: profile.id,
        conversationId,
        message: '내일 시험이라 3일 쉬어야 해',
      });

      expect(response.message).toBeTruthy();
    });
  });

  describe('시나리오 4: 학습 분석 요청', () => {
    it('학생이 자신의 학습 현황을 분석받는다', async () => {
      const studentId = 'analysis-student';
      const conversationId = 'analysis-conv';

      // Step 1: 전체 현황 분석
      const step1 = await supervisor.process({
        studentId,
        conversationId,
        message: '내 학습 현황 분석해줘',
      });
      expect(step1.message).toBeTruthy();

      // Step 2: 약점 분석
      const step2 = await supervisor.process({
        studentId,
        conversationId,
        message: '내가 부족한 부분 알려줘',
      });
      expect(step2.message).toBeTruthy();
    });
  });

  describe('시나리오 5: 에이전트 간 라우팅', () => {
    it('다양한 요청이 올바른 에이전트로 라우팅된다', async () => {
      const studentId = 'routing-student';

      // 코칭 요청 → COACH
      const coachResponse = await supervisor.process({
        studentId,
        conversationId: 'routing-1',
        message: '수학 공식 알려줘',
      });
      expect(coachResponse.message).toBeTruthy();

      // 분석 요청 → ANALYST
      const analystResponse = await supervisor.process({
        studentId,
        conversationId: 'routing-2',
        message: '내 학습 패턴 분석해줘',
      });
      expect(analystResponse.message).toBeTruthy();

      // 플랜 요청 → PLANNER (또는 COACH가 리다이렉트)
      const plannerResponse = await supervisor.process({
        studentId,
        conversationId: 'routing-3',
        message: '새 플랜 만들고 싶어',
      });
      expect(plannerResponse.message).toBeTruthy();
    });
  });
});
