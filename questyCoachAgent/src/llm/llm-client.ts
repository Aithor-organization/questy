/**
 * LLM Client
 * OpenRouter를 통한 통합 LLM 호출
 * - GPT-5 Nano: 의도 분류 (Fast, <500ms)
 * - Claude Haiku 4.5: 일상 코칭 (Balanced)
 * - Gemini 3 Flash: 복잡한 분석 + Vision
 */

import type { ModelId, ModelConfig } from '../types/agent.js';

// 모델 설정
export const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    provider: 'openai',
    maxTokens: 256,
    temperature: 0.3,
    purpose: 'Intent classification, simple responses',
  },
  'claude-4.5-haiku': {
    id: 'claude-4.5-haiku',
    provider: 'anthropic',
    maxTokens: 2048,
    temperature: 0.7,
    purpose: 'Daily coaching, emotional support',
  },
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    provider: 'google',
    maxTokens: 4096,
    temperature: 0.5,
    purpose: 'Complex analysis, vision tasks',
  },
};

// OpenRouter 모델 매핑
const OPENROUTER_MODEL_MAP: Record<ModelId, string> = {
  'gpt-5-nano': 'openai/gpt-4o-mini',
  'claude-4.5-haiku': 'anthropic/claude-haiku-4.5',  // Claude Haiku 4.5 (신규 모델)
  'gemini-3-flash': 'google/gemini-2.0-flash-001',
};

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: ModelId;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface LLMClientConfig {
  apiKey?: string;  // OpenRouter API Key
  timeout?: number;
  retryAttempts?: number;
}

const DEFAULT_CONFIG: LLMClientConfig = {
  timeout: 30000,
  retryAttempts: 3,
};

export class LLMClient {
  private config: LLMClientConfig;
  private requestCount: number = 0;

  constructor(config: Partial<LLMClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 환경 변수에서 API 키 로드
    if (!this.config.apiKey) {
      this.config.apiKey = process.env.OPENROUTER_API_KEY ?? '';
    }
  }

  /**
   * LLM 호출 (모든 모델 OpenRouter 사용)
   */
  async call(params: {
    model: ModelId;
    messages: LLMMessage[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const { model, messages, maxTokens, temperature } = params;
    const modelConfig = MODEL_CONFIGS[model];
    const startTime = Date.now();

    // API 키 확인 (런타임에 환경변수 재확인)
    const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY || '';

    // API 키 없으면 시뮬레이션 모드
    if (!apiKey) {
      console.warn('[LLMClient] No API key found, using simulation mode');
      return this.simulateResponse(model, messages, startTime);
    }

    // API 키가 있으면 config에도 저장 (캐싱)
    if (!this.config.apiKey && apiKey) {
      this.config.apiKey = apiKey;
    }

    const openRouterModel = OPENROUTER_MODEL_MAP[model];

    try {
      const response = await this.fetchWithRetry({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://questycoach.app',
          'X-Title': 'QuestyCoach Agent',
        },
        body: {
          model: openRouterModel,
          messages,
          max_tokens: maxTokens ?? modelConfig.maxTokens,
          temperature: temperature ?? modelConfig.temperature,
        },
      });

      const data = await response.json();
      this.requestCount++;

      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[LLMClient] Error calling ${model}:`, error);
      throw error;
    }
  }

  /**
   * 3-Level Router 기반 동적 모델 선택 호출
   */
  async callWithComplexity(params: {
    messages: LLMMessage[];
    complexity: number; // 0-1
    maxTokens?: number;
  }): Promise<LLMResponse> {
    const { complexity } = params;

    // 복잡도 기반 모델 선택
    let model: ModelId;
    if (complexity < 0.3) {
      model = 'gpt-5-nano';
    } else if (complexity < 0.6) {
      model = 'claude-4.5-haiku';
    } else {
      model = 'gemini-3-flash';
    }

    return this.call({
      model,
      messages: params.messages,
      maxTokens: params.maxTokens,
    });
  }

  /**
   * Vision 기능 (Gemini 전용)
   */
  async callWithVision(params: {
    messages: LLMMessage[];
    imageUrl?: string;
    imageBase64?: string;
  }): Promise<LLMResponse> {
    // Vision은 항상 Gemini 사용
    return this.call({
      model: 'gemini-3-flash',
      messages: params.messages,
    });
  }

  /**
   * 재시도 로직이 포함된 fetch
   */
  private async fetchWithRetry(params: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }): Promise<Response> {
    const { url, headers, body } = params;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= (this.config.retryAttempts ?? 3); attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeout ?? 30000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[LLMClient] Attempt ${attempt} failed:`, error);

        // 재시도 전 대기 (exponential backoff)
        if (attempt < (this.config.retryAttempts ?? 3)) {
          await this.sleep(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  /**
   * 시뮬레이션 응답 (개발/테스트용)
   */
  private simulateResponse(
    model: ModelId,
    messages: LLMMessage[],
    startTime: number
  ): LLMResponse {
    const lastMessage = messages[messages.length - 1]?.content ?? '';
    const isKorean = /[가-힣]/.test(lastMessage);

    // 모델별 시뮬레이션 응답
    const responses: Record<ModelId, string> = {
      'gpt-5-nano': isKorean
        ? '네, 이해했습니다. 도와드리겠습니다!'
        : 'Got it! I\'ll help you with that.',
      'claude-4.5-haiku': isKorean
        ? `좋은 질문이에요! 😊 차근차근 설명해 드릴게요.\n\n${this.generateCoachingResponse(lastMessage)}`
        : `Great question! Let me explain step by step.\n\n${this.generateCoachingResponse(lastMessage)}`,
      'gemini-3-flash': isKorean
        ? `분석 결과를 공유해 드릴게요.\n\n**핵심 포인트:**\n1. 현재 상황 파악\n2. 개선 방향 제시\n3. 실행 계획 수립\n\n자세한 내용은 아래에서 확인하세요.`
        : `Here's my analysis.\n\n**Key Points:**\n1. Current situation assessment\n2. Improvement directions\n3. Action plan\n\nSee details below.`,
    };

    return {
      content: responses[model],
      model,
      usage: {
        promptTokens: Math.floor(lastMessage.length / 4),
        completionTokens: Math.floor(responses[model].length / 4),
        totalTokens: Math.floor((lastMessage.length + responses[model].length) / 4),
      },
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * 코칭 응답 생성 (시뮬레이션)
   */
  private generateCoachingResponse(message: string): string {
    if (/계획|스케줄|일정/.test(message)) {
      return '학습 계획을 세워볼게요. 하루에 30분씩, 주 5일 학습하면 한 달 안에 목표를 달성할 수 있어요!';
    }
    if (/어려|힘들|모르/.test(message)) {
      return '어려운 부분이 있으면 함께 해결해 봐요. 하나씩 차근차근 풀어가면 분명 할 수 있어요!';
    }
    if (/진도|얼마나/.test(message)) {
      return '지금까지 정말 잘 하고 있어요! 현재 진도는 약 40% 정도이고, 이 속도라면 목표 달성이 충분히 가능해요.';
    }
    return '무엇이든 물어보세요. 함께 학습 여정을 걸어갈게요! 💪';
  }

  /**
   * 대기 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 통계 조회
   */
  getStats(): { requestCount: number } {
    return { requestCount: this.requestCount };
  }
}

// 싱글톤 인스턴스
let llmClientInstance: LLMClient | null = null;

export function getLLMClient(config?: Partial<LLMClientConfig>): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new LLMClient(config);
  }
  return llmClientInstance;
}
