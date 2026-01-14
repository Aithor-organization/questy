/**
 * 테스트 환경 설정
 * Vitest 전역 설정 및 모킹
 */

import { vi } from 'vitest';

// 환경 변수 설정
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// LLM Client 싱글톤 리셋을 위한 모듈 모킹
vi.mock('../src/llm/index.js', () => {
  const mockCall = vi.fn().mockImplementation(async (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }) => {
    const lastMessage = params.messages[params.messages.length - 1]?.content ?? '';

    // 컨텍스트 기반 응답 생성
    let content = '모의 LLM 응답입니다.';

    if (lastMessage.includes('저녁 리뷰') || lastMessage.includes('evening')) {
      content = '오늘도 수고했어! 내일도 화이팅!';
    } else if (lastMessage.includes('위기') || lastMessage.includes('힘들')) {
      content = '괜찮아, 천천히 해보자. 언제든 도움이 필요하면 말해줘.';
    } else if (lastMessage.includes('일정') || lastMessage.includes('스케줄')) {
      content = '오늘의 일정을 안내해 드릴게요! 현재 활성 플랜이 있어요.';
    } else if (lastMessage.includes('분석') || lastMessage.includes('현황')) {
      content = '학습 현황 분석 결과입니다. 진도율: 75%, 약점: 수학 기초';
    } else if (lastMessage.includes('플랜') || lastMessage.includes('계획')) {
      content = JSON.stringify({
        overallScore: 8,
        balanceScore: 7,
        difficultyScore: 8,
        feasibilityScore: 9,
        recommendations: ['적절한 난이도입니다'],
        potentialIssues: [],
        patternApplied: null,
      });
    }

    return {
      content,
      model: params.model,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      latencyMs: 100,
    };
  });

  const mockCallWithComplexity = vi.fn().mockImplementation(async (params: {
    messages: Array<{ role: string; content: string }>;
    complexity: number;
    maxTokens?: number;
  }) => {
    return mockCall({
      model: params.complexity < 0.3 ? 'gpt-5-nano' :
             params.complexity < 0.6 ? 'claude-4.5-haiku' : 'gemini-3-flash',
      messages: params.messages,
      maxTokens: params.maxTokens,
    });
  });

  const MockLLMClient = vi.fn().mockImplementation(() => ({
    call: mockCall,
    callWithComplexity: mockCallWithComplexity,
    callWithVision: mockCall,
    getStats: () => ({ requestCount: 0 }),
  }));

  return {
    LLMClient: MockLLMClient,
    getLLMClient: vi.fn(() => new MockLLMClient()),
    MODEL_CONFIGS: {
      'gpt-5-nano': { id: 'gpt-5-nano', provider: 'openai', maxTokens: 256, temperature: 0.3 },
      'claude-4.5-haiku': { id: 'claude-4.5-haiku', provider: 'anthropic', maxTokens: 2048, temperature: 0.7 },
      'gemini-3-flash': { id: 'gemini-3-flash', provider: 'google', maxTokens: 4096, temperature: 0.5 },
    },
  };
});

// ChromaDB 모킹
vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    getOrCreateCollection: vi.fn().mockResolvedValue({
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        documents: [[]],
        ids: [[]],
        metadatas: [[]],
        distances: [[]]
      }),
      get: vi.fn().mockResolvedValue({
        documents: [],
        ids: [],
        metadatas: []
      }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
    }),
    heartbeat: vi.fn().mockResolvedValue(Date.now()),
    listCollections: vi.fn().mockResolvedValue([]),
  })),
}));
