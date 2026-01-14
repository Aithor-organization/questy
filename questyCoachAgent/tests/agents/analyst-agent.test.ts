/**
 * AnalystAgent E2E 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalystAgent } from '../../src/core/agents/analyst/index.js';
import type { AgentRequest, DirectorContext } from '../../src/types/agent.js';

// LLM 모킹
vi.mock('../../src/llm/index.js', () => ({
  getLLMClient: () => ({
    call: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        overallScore: 8,
        balanceScore: 7,
        difficultyScore: 8,
        feasibilityScore: 9,
        recommendations: ['적절한 난이도입니다'],
        potentialIssues: [],
        patternApplied: null,
      }),
      model: 'gemini-3-flash',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
    callWithComplexity: vi.fn().mockResolvedValue({
      content: '학습 분석 결과입니다.',
      model: 'gemini-3-flash',
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

describe('AnalystAgent', () => {
  let agent: AnalystAgent;
  let mockContext: DirectorContext;
  let mockRequest: AgentRequest;

  beforeEach(() => {
    agent = new AnalystAgent();

    mockContext = {
      studentProfile: {
        id: 'student-1',
        name: '테스트 학생',
        grade: 'HIGH_2',
        subjects: ['MATH', 'ENGLISH'],
        enrolledSubjects: ['MATH', 'ENGLISH'],
        createdAt: new Date(),
      },
      activePlans: [
        {
          id: 'plan-1',
          studentId: 'student-1',
          name: '수학 마스터',
          title: '수학 마스터',
          subject: 'MATH',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          dailyTargetMinutes: 60,
          totalDays: 30,
          completedDays: 10,
          createdAt: new Date(),
          sessions: [],
        },
      ],
      memoryContext: {
        relevantMemories: [],
        recentTopics: [{ topicId: 'math-1', subject: 'MATH', masteryScore: 0.7 }],
        masteryInfo: [
          { topicId: 'math-1', topicName: '함수', masteryScore: 7, lastPracticed: new Date() },
          { topicId: 'math-2', topicName: '미분', masteryScore: 3, lastPracticed: new Date() },
        ],
      },
      recentConversations: [],
      questStats: {
        totalQuests: 100,
        completedQuests: 75,
        averageCompletionTime: 45,
        streakDays: 7,
        period: 'WEEK',
      },
    };

    mockRequest = {
      studentId: 'student-1',
      message: '내 학습 현황 분석해줘',
      conversationId: 'conv-1',
    };
  });

  describe('모듈 로딩', () => {
    it('AnalystAgent가 정상적으로 로드된다', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(AnalystAgent);
    });
  });

  describe('process()', () => {
    it('진도 분석 요청에 응답한다', async () => {
      mockRequest.message = '내 진도 분석해줘';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
      expect(response.agentRole).toBe('ANALYST');
    });

    it('약점 분석 요청에 응답한다', async () => {
      mockRequest.message = '내가 부족한 부분 알려줘';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('전체 리포트 요청에 응답한다', async () => {
      mockRequest.message = '전체 학습 리포트 보여줘';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });
  });

  describe('reviewPlan()', () => {
    it('플랜 리뷰를 수행한다', async () => {
      const review = await agent.reviewPlan({
        materialName: '수학 기본서',
        planName: '수학 마스터 플랜',
        dailyQuests: [
          {
            day: 1,
            unitTitle: '1단원',
            range: '1-20페이지',
            estimatedMinutes: 60,
            difficultyTier: 'MEDIUM',
            conceptTags: ['함수'],
          },
        ],
        totalDays: 30,
        totalEstimatedHours: 30,
        subject: 'MATH',
      });

      expect(review).toBeDefined();
      expect(review.overallScore).toBeGreaterThanOrEqual(0);
      expect(review.overallScore).toBeLessThanOrEqual(10);
    });
  });

  describe('패턴 학습', () => {
    it('패턴 결과를 기록한다', async () => {
      // 패턴 기록은 오류 없이 완료되어야 함
      await expect(
        agent.recordPatternOutcome('pattern-1', true, '좋은 피드백')
      ).resolves.not.toThrow();
    });
  });
});
