/**
 * Embeddings Module
 * OpenAI/OpenRouter 임베딩 API를 사용하여 768차원 벡터 생성
 * - text-embedding-3-small 모델 사용 (비용 효율적)
 * - OpenRouter 지원 (OPENROUTER_API_KEY 우선 사용)
 * - 배치 처리 지원
 */

import OpenAI from 'openai';

export interface EmbeddingConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  dimensions?: number;
}

const DEFAULT_CONFIG: Required<EmbeddingConfig> = {
  // OpenRouter 우선, 없으면 OpenAI 사용
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENROUTER_API_KEY
    ? (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1')
    : 'https://api.openai.com/v1',
  model: 'openai/text-embedding-3-small',  // OpenRouter 형식
  dimensions: 768,  // FR-081 스펙에 맞춤
};

export class EmbeddingGenerator {
  private openai: OpenAI | null = null;
  private config: Required<EmbeddingConfig>;
  private fallbackEnabled: boolean = false;

  constructor(config: EmbeddingConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // OpenRouter 사용 시 모델명 조정
    if (config.apiKey && !config.apiKey.startsWith('sk-or-')) {
      // OpenAI 직접 사용 시 모델명에서 'openai/' 제거
      if (this.config.model.startsWith('openai/')) {
        this.config.model = this.config.model.replace('openai/', '');
      }
      this.config.baseURL = 'https://api.openai.com/v1';
    }

    if (this.config.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });
      console.log(`[EmbeddingGenerator] ${this.config.baseURL.includes('openrouter') ? 'OpenRouter' : 'OpenAI'} 임베딩 사용`);
    } else {
      console.warn('[EmbeddingGenerator] API 키 없음, 폴백 모드 사용');
      this.fallbackEnabled = true;
    }
  }

  /**
   * 단일 텍스트 임베딩 생성
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.fallbackEnabled || !this.openai) {
      return this.generateFallbackEmbedding(text);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
        dimensions: this.config.dimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[EmbeddingGenerator] OpenAI 임베딩 실패, 폴백 사용:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * 배치 임베딩 생성 (최대 2048개)
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.fallbackEnabled || !this.openai) {
      return texts.map(text => this.generateFallbackEmbedding(text));
    }

    try {
      // OpenAI API는 한 번에 최대 2048개 처리 가능
      const batchSize = 2048;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: batch,
          dimensions: this.config.dimensions,
        });

        results.push(...response.data.map(d => d.embedding));
      }

      return results;
    } catch (error) {
      console.error('[EmbeddingGenerator] 배치 임베딩 실패, 폴백 사용:', error);
      return texts.map(text => this.generateFallbackEmbedding(text));
    }
  }

  /**
   * 폴백 임베딩 생성 (TF-IDF 스타일 해시 기반)
   * - OpenAI API 없이도 동작
   * - 정확도는 낮지만 기본 유사도 검색 가능
   */
  private generateFallbackEmbedding(text: string): number[] {
    const dimensions = this.config.dimensions;
    const embedding = new Array(dimensions).fill(0);

    // 텍스트 전처리
    const tokens = text.toLowerCase()
      .replace(/[^\w\s가-힣]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (tokens.length === 0) {
      return embedding;
    }

    // 각 토큰에 대해 해시 기반 벡터 생성
    for (const token of tokens) {
      const hash = this.hashString(token);

      // 여러 위치에 값 분산
      for (let i = 0; i < 5; i++) {
        const idx = Math.abs((hash + i * 31) % dimensions);
        const sign = (hash >> i) & 1 ? 1 : -1;
        embedding[idx] += sign * (1 / tokens.length);
      }
    }

    // 정규화
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * 문자열 해시 함수 (djb2 변형)
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash);
  }

  /**
   * 두 임베딩 간 코사인 유사도 계산
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('벡터 차원이 일치하지 않습니다');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}
