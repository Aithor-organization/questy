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

export async function chat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
) {
  const response = await openrouter.chat.completions.create({
    model: options?.model || DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
  });

  return response.choices[0]?.message?.content || '';
}

export async function chatJson<T>(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<T> {
  const response = await openrouter.chat.completions.create({
    model: options?.model || DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.3, // JSON 출력시 낮은 temperature
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content) as T;
}
