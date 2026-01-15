/**
 * BaseAgent
 * 모든 AI Coach 에이전트의 기본 클래스
 * ACE Framework V5.2 패턴 적용 + LLM 클라이언트 통합
 */

import type {
  IAgent,
  AgentRole,
  AgentRequest,
  AgentResponse,
  DirectorContext,
  ModelConfig,
  ModelId,
} from '../../types/agent.js';
import { getLLMClient, type LLMClient, type LLMMessage, type LLMStreamChunk } from '../../llm/index.js';

export interface BaseAgentConfig {
  role: AgentRole;
  modelConfig: ModelConfig;
  systemPrompt: string;
  maxTokens?: number;
}

export abstract class BaseAgent implements IAgent {
  readonly role: AgentRole;
  protected modelConfig: ModelConfig;
  protected systemPrompt: string;
  protected maxTokens: number;
  protected llmClient: LLMClient;

  constructor(config: BaseAgentConfig) {
    this.role = config.role;
    this.modelConfig = config.modelConfig;
    this.systemPrompt = config.systemPrompt;
    this.maxTokens = config.maxTokens ?? 2048;
    this.llmClient = getLLMClient();
  }

  /**
   * 요청 처리 (각 에이전트가 구현)
   */
  abstract process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse>;

  /**
   * 시스템 프롬프트에 컨텍스트 주입
   */
  protected buildPrompt(
    basePrompt: string,
    memoryContext: string,
    studentInfo: string
  ): string {
    return `${basePrompt}

${memoryContext}

${studentInfo}`.trim();
  }

  /**
   * LLM을 통한 응답 생성
   */
  protected async generateResponse(
    prompt: string,
    userMessage: string,
    options?: {
      model?: ModelId;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.llmClient.call({
      model: options?.model ?? this.modelConfig.id,
      messages,
      maxTokens: options?.maxTokens ?? this.maxTokens,
      temperature: options?.temperature ?? this.modelConfig.temperature,
    });

    console.log(`[${this.role}] Generated with ${response.model} in ${response.latencyMs}ms`);

    return response.content;
  }

  /**
   * 복잡도 기반 모델 선택 응답 생성
   */
  protected async generateWithComplexity(
    prompt: string,
    userMessage: string,
    complexity: number
  ): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.llmClient.callWithComplexity({
      messages,
      complexity,
      maxTokens: this.maxTokens,
    });

    console.log(`[${this.role}] Complexity-based: ${response.model} (${(complexity * 100).toFixed(0)}%) in ${response.latencyMs}ms`);

    return response.content;
  }

  /**
   * 스트리밍 응답 생성 (SSE)
   */
  protected async *generateStreamResponse(
    prompt: string,
    userMessage: string,
    options?: {
      model?: ModelId;
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<LLMStreamChunk> {
    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage },
    ];

    console.log(`[${this.role}] Starting stream with ${options?.model ?? this.modelConfig.id}`);

    yield* this.llmClient.callStream({
      model: options?.model ?? this.modelConfig.id,
      messages,
      maxTokens: options?.maxTokens ?? this.maxTokens,
      temperature: options?.temperature ?? this.modelConfig.temperature,
    });
  }

  /**
   * 스트리밍 처리 (각 에이전트가 오버라이드 가능)
   * 기본 구현: generateStreamResponse 호출
   */
  async *processStream(
    request: AgentRequest,
    context: DirectorContext
  ): AsyncGenerator<LLMStreamChunk> {
    // 서브클래스에서 오버라이드하여 구현
    // 기본 구현은 빈 제너레이터
    console.warn(`[${this.role}] processStream not implemented, using empty generator`);
    yield { content: '', done: true };
  }

  /**
   * 기본 응답 포맷 생성
   */
  protected createResponse(
    message: string,
    options: Partial<AgentResponse> = {}
  ): AgentResponse {
    return {
      agentRole: this.role,
      message,
      actions: options.actions ?? [],
      memoryExtracted: options.memoryExtracted ?? false,
      suggestedFollowUp: options.suggestedFollowUp ?? [],
      messageActions: options.messageActions,
      rescheduleOptions: options.rescheduleOptions,
    };
  }
}
