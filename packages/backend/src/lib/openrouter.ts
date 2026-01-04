import OpenAI from 'openai';

// OpenRouter는 OpenAI SDK 호환
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
    'X-Title': 'QuestyBook',
  },
});

// Gemini 3 Flash - 빠른 속도, 저렴한 비용, Vision 지원
export const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Gemini 3 Flash 가격 (OpenRouter 기준)
const PRICING = {
  'google/gemini-3-flash-preview': {
    input: 0.10 / 1_000_000,  // $0.10 per 1M tokens
    output: 0.40 / 1_000_000, // $0.40 per 1M tokens
  },
  'google/gemini-2.0-flash-001': {
    input: 0.10 / 1_000_000,
    output: 0.40 / 1_000_000,
  },
};

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

// 누적 사용량 추적
let sessionUsage: UsageInfo = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostUSD: 0,
};

export function getSessionUsage(): UsageInfo {
  return { ...sessionUsage };
}

export function resetSessionUsage(): void {
  sessionUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUSD: 0,
  };
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['google/gemini-3-flash-preview'];
  return (promptTokens * pricing.input) + (completionTokens * pricing.output);
}

function logUsage(model: string, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || 0;
  const cost = calculateCost(model, promptTokens, completionTokens);

  // 세션 누적
  sessionUsage.promptTokens += promptTokens;
  sessionUsage.completionTokens += completionTokens;
  sessionUsage.totalTokens += totalTokens;
  sessionUsage.estimatedCostUSD += cost;

  console.log(`[API Usage] Model: ${model}`);
  console.log(`  - Input: ${promptTokens.toLocaleString()} tokens`);
  console.log(`  - Output: ${completionTokens.toLocaleString()} tokens`);
  console.log(`  - Total: ${totalTokens.toLocaleString()} tokens`);
  console.log(`  - Cost: $${cost.toFixed(6)} (Session total: $${sessionUsage.estimatedCostUSD.toFixed(6)})`);
}

export async function chat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const model = options?.model || DEFAULT_MODEL;
  const response = await openrouter.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
  });

  if (response.usage) {
    logUsage(model, response.usage);
  }

  return response.choices[0]?.message?.content || '';
}

export async function chatJson<T>(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<T> {
  const model = options?.model || DEFAULT_MODEL;
  const response = await openrouter.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.3, // JSON 출력시 낮은 temperature
    response_format: { type: 'json_object' },
  });

  if (response.usage) {
    logUsage(model, response.usage);
  }

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content) as T;
}
