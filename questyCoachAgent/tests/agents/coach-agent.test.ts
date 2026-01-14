/**
 * CoachAgent E2E 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachAgent } from '../../src/core/agents/coach/index.js';
import type { AgentRequest, DirectorContext } from '../../src/types/agent.js';

// 의존성 모킹
vi.mock('../../src/llm/index.js', () => ({
  getLLMClient: () => ({
    call: vi.fn().mockResolvedValue({
      content: '좋은 질문이야! 차근차근 알려줄게.',
      model: 'claude-4.5-haiku',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
    callWithComplexity: vi.fn().mockResolvedValue({
      content: '좋은 질문이야! 차근차근 알려줄게.',
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
      query: vi.fn().mockResolvedValue({ documents: [], ids: [], metadatas: [] }),
    }),
  })),
}));

describe('CoachAgent', () => {
  let agent: CoachAgent;
  let mockContext: DirectorContext;
  let mockRequest: AgentRequest;

  beforeEach(() => {
    agent = new CoachAgent();

    mockContext = {
      studentProfile: {
        id: 'student-1',
        name: '테스트 학생',
        grade: 'HIGH_3',
        subjects: ['MATH'],
        enrolledSubjects: ['MATH'],
        createdAt: new Date(),
        learningStyle: 'VISUAL',
      },
      activePlans: [],
      memoryContext: {
        relevantMemories: [],
        burnoutStatus: { level: 'LOW', indicators: [], lastChecked: new Date() },
        recentTopics: [],
        masteryInfo: [],
      },
      recentConversations: [],
    };

    mockRequest = {
      studentId: 'student-1',
      message: '수학 공식이 헷갈려요',
      conversationId: 'conv-1',
    };
  });

  describe('모듈 로딩', () => {
    it('CoachAgent가 정상적으로 로드된다', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(CoachAgent);
    });
  });

  describe('process()', () => {
    it('일반 학습 질문에 응답한다', async () => {
      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
      expect(response.agentRole).toBe('COACH');
    });

    it('동기부여가 필요한 메시지에 적절히 응답한다', async () => {
      mockRequest.message = '너무 힘들어요, 포기하고 싶어요';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('일정 조회 요청을 처리한다', async () => {
      mockRequest.message = '오늘 일정 알려줘';
      mockContext.activePlans = [
        {
          id: 'plan-1',
          studentId: 'student-1',
          name: '수학 마스터 플랜',
          title: '수학 마스터 플랜',
          subject: 'MATH',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(),
          dailyTargetMinutes: 60,
          totalDays: 30,
          completedDays: 5,
          createdAt: new Date(),
          sessions: [
            { id: 's1', status: 'PENDING', date: new Date(), estimatedMinutes: 30 },
          ],
        },
      ];

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });
  });

  describe('FR 기능', () => {
    it('FR-025: 저녁 리뷰를 생성한다', async () => {
      const review = await agent.generateEveningReview(
        '테스트 학생',
        {
          completedQuests: 3,
          totalQuests: 5,
          completedMinutes: 90,
          remainingQuests: ['수학 문제 풀기', '영어 단어 암기'],
          streak: 7,
        },
        ['내일 수학 퀘스트']
      );

      expect(review).toBeTruthy();
      expect(typeof review).toBe('string');
    });

    it('FR-024: 미학습 대응 메시지를 생성한다', async () => {
      const response = await agent.generateMissedStudyResponse('테스트 학생', {
        missedDays: 2,
        lastStudyDate: '2025-01-10',
        missedQuests: ['수학 복습'],
        suggestedReschedule: true,
      });

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
    });

    it('FR-026: 위기 개입 메시지를 생성한다', async () => {
      const response = await agent.generateCrisisIntervention(
        '테스트 학생',
        5,
        ['NEGATIVE', 'FRUSTRATED']
      );

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
    });

    it('FR-021: 학습 시작 알림을 생성한다', async () => {
      const reminder = await agent.generateStudyStartReminder(
        '테스트 학생',
        'first',
        '수학 1단원',
        30
      );

      expect(reminder).toBeTruthy();
      expect(reminder).toContain('테스트 학생');
      expect(reminder).toContain('수학 1단원');
    });
  });
});
