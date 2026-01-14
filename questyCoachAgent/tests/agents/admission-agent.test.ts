/**
 * AdmissionAgent E2E 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdmissionAgent } from '../../src/core/agents/admission/index.js';
import type { AgentRequest, DirectorContext } from '../../src/types/agent.js';

// LLM 모킹
vi.mock('../../src/llm/index.js', () => ({
  getLLMClient: () => ({
    call: vi.fn().mockResolvedValue({
      content: '반가워요! 이름이 뭐예요?',
      model: 'claude-4.5-haiku',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
    callWithComplexity: vi.fn().mockResolvedValue({
      content: '반가워요! 이름이 뭐예요?',
      model: 'claude-4.5-haiku',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
    }),
  }),
}));

describe('AdmissionAgent', () => {
  let agent: AdmissionAgent;
  let mockContext: DirectorContext;
  let mockRequest: AgentRequest;

  beforeEach(() => {
    agent = new AdmissionAgent();

    mockContext = {
      studentProfile: {
        id: 'student-1',
        name: '신규 학생',
        grade: 'HIGH_1',
        subjects: [],
        enrolledSubjects: [],
        createdAt: new Date(),
      },
      activePlans: [],
      memoryContext: {
        relevantMemories: [],
        recentTopics: [],
        masteryInfo: [],
      },
      recentConversations: [],
    };

    mockRequest = {
      studentId: 'student-1',
      message: '안녕하세요, 처음이에요',
      conversationId: 'conv-1',
    };
  });

  describe('모듈 로딩', () => {
    it('AdmissionAgent가 정상적으로 로드된다', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(AdmissionAgent);
    });
  });

  describe('process()', () => {
    it('신규 학생에게 환영 메시지를 보낸다', async () => {
      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
      expect(response.agentRole).toBe('ADMISSION');
    });

    it('이름 제공 시 다음 단계로 진행한다', async () => {
      mockRequest.message = '제 이름은 김철수예요';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('학년 정보를 수집한다', async () => {
      mockRequest.message = '고등학교 2학년이에요';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('목표 정보를 수집한다', async () => {
      mockRequest.message = '서울대 합격이 목표예요';

      const response = await agent.process(mockRequest, mockContext);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });
  });

  describe('온보딩 단계', () => {
    it('suggestedFollowUp이 포함된 응답을 반환한다', async () => {
      const response = await agent.process(mockRequest, mockContext);

      expect(response.suggestedFollowUp).toBeDefined();
      expect(Array.isArray(response.suggestedFollowUp)).toBe(true);
    });
  });
});
