/**
 * Supabase Memory Storage
 * 학습 메모리의 Supabase 저장 및 벡터 검색
 * - pgvector 확장 사용한 768차원 임베딩 저장
 * - ChromaMemoryStorage 대체
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { LearningMemory, Subject, MemoryType } from '../../types/memory.js';
import { EmbeddingGenerator } from './embeddings.js';

export interface SupabaseStorageConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  embeddingApiKey?: string;
}

const DEFAULT_CONFIG: Required<SupabaseStorageConfig> = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '',
  embeddingApiKey: process.env.OPENAI_API_KEY || '',
};

// Supabase 테이블 레코드 타입
interface MemoryRecord {
  id: string;
  student_id: string;
  type: string;
  subject: string;
  topic: string;
  title: string;
  content: string;
  confidence: number;
  difficulty: number;
  mastery_score: number;
  times_observed: number;
  recall_count: number;
  positive_feedback: number;
  negative_feedback: number;
  emotion_at_creation: string;
  embedding?: number[];
  created_at: string;
  last_recalled: string;
}

export class SupabaseMemoryStorage {
  private supabase: SupabaseClient | null = null;
  private embeddingGenerator: EmbeddingGenerator;
  private config: Required<SupabaseStorageConfig>;
  private initialized: boolean = false;
  private useFallback: boolean = false;

  // 인메모리 폴백 저장소
  private fallbackStore: Map<string, {
    memory: LearningMemory;
    embedding: number[];
    studentId: string;
  }[]> = new Map();

  constructor(config: SupabaseStorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embeddingGenerator = new EmbeddingGenerator({
      apiKey: this.config.embeddingApiKey,
    });
  }

  /**
   * Supabase 연결 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!this.config.supabaseUrl || !this.config.supabaseKey) {
        console.warn('[SupabaseMemoryStorage] Supabase 설정 없음, 인메모리 폴백 사용');
        this.useFallback = true;
        this.initialized = true;
        return;
      }

      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

      // 연결 테스트
      const { error } = await this.supabase
        .from('learning_memories')
        .select('id')
        .limit(1);

      if (error) {
        console.warn('[SupabaseMemoryStorage] Supabase 연결 테스트 실패:', error.message);
        this.useFallback = true;
      } else {
        console.log('[SupabaseMemoryStorage] Supabase 연결 성공');
      }

      this.initialized = true;
    } catch (error) {
      console.warn('[SupabaseMemoryStorage] Supabase 초기화 실패:', error);
      this.useFallback = true;
      this.initialized = true;
    }
  }

  /**
   * 메모리 저장
   */
  async storeMemory(studentId: string, memory: LearningMemory): Promise<void> {
    await this.initialize();

    const textForEmbedding = this.createEmbeddingText(memory);
    const embedding = await this.embeddingGenerator.generateEmbedding(textForEmbedding);

    if (this.useFallback) {
      this.storeFallback(studentId, memory, embedding);
      return;
    }

    const record = this.memoryToRecord(studentId, memory, embedding);
    const { error } = await this.supabase!.from('learning_memories').insert(record);

    if (error) {
      console.error('[SupabaseMemoryStorage] storeMemory 실패:', error.message);
      this.storeFallback(studentId, memory, embedding);
    }
  }

  /**
   * 배치 메모리 저장
   */
  async storeBatch(studentId: string, memories: LearningMemory[]): Promise<void> {
    await this.initialize();

    if (memories.length === 0) return;

    const texts = memories.map(m => this.createEmbeddingText(m));
    const embeddings = await this.embeddingGenerator.generateBatchEmbeddings(texts);

    if (this.useFallback) {
      memories.forEach((memory, idx) => {
        this.storeFallback(studentId, memory, embeddings[idx]);
      });
      return;
    }

    const records = memories.map((m, idx) => this.memoryToRecord(studentId, m, embeddings[idx]));
    const { error } = await this.supabase!.from('learning_memories').insert(records);

    if (error) {
      console.error('[SupabaseMemoryStorage] storeBatch 실패:', error.message);
      memories.forEach((memory, idx) => {
        this.storeFallback(studentId, memory, embeddings[idx]);
      });
    }
  }

  /**
   * Semantic Search - 벡터 유사도 기반 메모리 검색
   */
  async searchSimilar(params: {
    studentId: string;
    query: string;
    topK?: number;
    filters?: {
      subject?: Subject;
      types?: MemoryType[];
      minConfidence?: number;
    };
  }): Promise<Array<{ memory: LearningMemory; similarity: number }>> {
    await this.initialize();

    const { studentId, query, topK = 20, filters } = params;
    const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);

    if (this.useFallback) {
      return this.searchFallback(studentId, queryEmbedding, topK, filters);
    }

    // pgvector RPC 함수 호출
    const { data, error } = await this.supabase!.rpc('search_similar_memories', {
      query_embedding: queryEmbedding,
      target_student_id: studentId,
      target_subject: filters?.subject || null,
      min_confidence: filters?.minConfidence || 0.6,
      result_limit: topK,
    });

    if (error) {
      console.error('[SupabaseMemoryStorage] searchSimilar 실패:', error.message);
      return this.searchFallback(studentId, queryEmbedding, topK, filters);
    }

    return (data || []).map((row: MemoryRecord & { similarity: number }) => ({
      memory: this.recordToMemory(row),
      similarity: row.similarity,
    }));
  }

  /**
   * 학생의 모든 메모리 조회
   */
  async getAllMemories(studentId: string): Promise<LearningMemory[]> {
    await this.initialize();

    if (this.useFallback) {
      const items = this.fallbackStore.get(studentId) || [];
      return items.map(item => item.memory);
    }

    const { data, error } = await this.supabase!
      .from('learning_memories')
      .select('*')
      .eq('student_id', studentId);

    if (error) {
      console.error('[SupabaseMemoryStorage] getAllMemories 실패:', error.message);
      return [];
    }

    return (data || []).map((row: MemoryRecord) => this.recordToMemory(row));
  }

  /**
   * 메모리 업데이트
   */
  async updateMemory(studentId: string, memory: LearningMemory): Promise<void> {
    await this.initialize();

    if (this.useFallback) {
      const items = this.fallbackStore.get(studentId) || [];
      const idx = items.findIndex(item => item.memory.id === memory.id);
      if (idx !== -1) {
        const embedding = await this.embeddingGenerator.generateEmbedding(
          this.createEmbeddingText(memory)
        );
        items[idx] = { memory, embedding, studentId };
      }
      return;
    }

    const embedding = await this.embeddingGenerator.generateEmbedding(
      this.createEmbeddingText(memory)
    );

    const { error } = await this.supabase!
      .from('learning_memories')
      .update(this.memoryToRecord(studentId, memory, embedding))
      .eq('id', memory.id);

    if (error) {
      console.error('[SupabaseMemoryStorage] updateMemory 실패:', error.message);
    }
  }

  /**
   * 학생의 모든 메모리 삭제
   */
  async deleteAllMemories(studentId: string): Promise<void> {
    await this.initialize();

    if (this.useFallback) {
      this.fallbackStore.delete(studentId);
      return;
    }

    const { error } = await this.supabase!
      .from('learning_memories')
      .delete()
      .eq('student_id', studentId);

    if (error) {
      console.error('[SupabaseMemoryStorage] deleteAllMemories 실패:', error.message);
    }
  }

  // ==================== Helper 메서드 ====================

  private createEmbeddingText(memory: LearningMemory): string {
    return [
      `[${memory.type}]`,
      `제목: ${memory.title}`,
      `과목: ${memory.subject}`,
      `토픽: ${memory.topic}`,
      `내용: ${memory.content}`,
    ].join(' ');
  }

  private memoryToRecord(
    studentId: string,
    memory: LearningMemory,
    embedding: number[]
  ): Record<string, unknown> {
    return {
      id: memory.id,
      student_id: studentId,
      type: memory.type,
      subject: memory.subject,
      topic: memory.topic,
      title: memory.title,
      content: memory.content,
      confidence: memory.confidence,
      difficulty: memory.difficulty,
      mastery_score: memory.masteryScore,
      times_observed: memory.timesObserved,
      recall_count: memory.recallCount,
      positive_feedback: memory.positiveFeedback,
      negative_feedback: memory.negativeFeedback,
      emotion_at_creation: memory.emotionAtCreation,
      embedding,
      created_at: memory.createdAt.toISOString(),
      last_recalled: memory.lastRecalled.toISOString(),
    };
  }

  private recordToMemory(row: MemoryRecord): LearningMemory {
    return {
      id: row.id,
      type: row.type as MemoryType,
      subject: row.subject as Subject,
      topic: row.topic,
      title: row.title,
      content: row.content,
      confidence: row.confidence,
      difficulty: row.difficulty,
      masteryScore: row.mastery_score,
      timesObserved: row.times_observed,
      recallCount: row.recall_count,
      positiveFeedback: row.positive_feedback,
      negativeFeedback: row.negative_feedback,
      emotionAtCreation: row.emotion_at_creation as LearningMemory['emotionAtCreation'],
      createdAt: new Date(row.created_at),
      lastRecalled: new Date(row.last_recalled),
    };
  }

  // ==================== 폴백 메서드 ====================

  private storeFallback(studentId: string, memory: LearningMemory, embedding: number[]): void {
    const items = this.fallbackStore.get(studentId) || [];
    items.push({ memory, embedding, studentId });
    this.fallbackStore.set(studentId, items);
  }

  private searchFallback(
    studentId: string,
    queryEmbedding: number[],
    topK: number,
    filters?: {
      subject?: Subject;
      types?: MemoryType[];
      minConfidence?: number;
    }
  ): Array<{ memory: LearningMemory; similarity: number }> {
    const items = this.fallbackStore.get(studentId) || [];

    let filtered = items;
    if (filters?.subject) {
      filtered = filtered.filter(item => item.memory.subject === filters.subject);
    }
    if (filters?.types && filters.types.length > 0) {
      filtered = filtered.filter(item => filters.types!.includes(item.memory.type));
    }
    if (filters?.minConfidence !== undefined) {
      filtered = filtered.filter(item => item.memory.confidence >= filters.minConfidence!);
    }

    const withSimilarity = filtered.map(item => ({
      memory: item.memory,
      similarity: EmbeddingGenerator.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    return withSimilarity.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}
