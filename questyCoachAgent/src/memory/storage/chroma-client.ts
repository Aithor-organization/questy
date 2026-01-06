/**
 * ChromaDB Client
 * 학습 메모리의 벡터 저장 및 검색
 * - 768차원 임베딩 저장
 * - 메타데이터 필터링
 * - Semantic Search 지원
 */

import { ChromaClient, Collection, IncludeEnum } from 'chromadb';
import { v4 as uuidv4 } from 'uuid';
import type { LearningMemory, Subject, MemoryType } from '../../types/memory.js';
import { EmbeddingGenerator } from './embeddings.js';

export interface ChromaStorageConfig {
  collectionName?: string;
  chromaHost?: string;
  chromaPort?: number;
  embeddingApiKey?: string;
  persistDirectory?: string;
}

const DEFAULT_CONFIG: Required<ChromaStorageConfig> = {
  collectionName: 'questy_learning_memories',
  chromaHost: process.env.CHROMA_HOST || 'localhost',
  chromaPort: parseInt(process.env.CHROMA_PORT || '8000'),
  embeddingApiKey: process.env.OPENAI_API_KEY || '',
  persistDirectory: './chroma_data',
};

// ChromaDB 메타데이터 인터페이스 (인덱스 시그니처 포함)
interface ChromaMetadata {
  [key: string]: string | number | boolean;
  studentId: string;
  type: string;
  subject: string;
  topic: string;
  title: string;
  confidence: number;
  difficulty: number;
  masteryScore: number;
  createdAt: string;
  lastRecalled: string;
  emotionAtCreation: string;
  recallCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
  timesObserved: number;
}

export class ChromaMemoryStorage {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private embeddingGenerator: EmbeddingGenerator;
  private config: Required<ChromaStorageConfig>;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  // 인메모리 폴백 저장소 (ChromaDB 연결 실패 시)
  private fallbackStore: Map<string, {
    memory: LearningMemory;
    embedding: number[];
    studentId: string;
  }[]> = new Map();
  private useFallback: boolean = false;

  constructor(config: ChromaStorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embeddingGenerator = new EmbeddingGenerator({
      apiKey: this.config.embeddingApiKey,
    });
  }

  /**
   * ChromaDB 연결 초기화
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.client = new ChromaClient({
        path: `http://${this.config.chromaHost}:${this.config.chromaPort}`,
      });

      // 연결 테스트
      await this.client.heartbeat();

      // 컬렉션 생성 또는 가져오기
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        metadata: {
          description: 'QuestyBook 학습 메모리 저장소',
          dimensions: '768',
        },
      });

      this.initialized = true;
      console.log('[ChromaMemoryStorage] ChromaDB 연결 성공');
    } catch (error) {
      console.warn('[ChromaMemoryStorage] ChromaDB 연결 실패, 인메모리 폴백 사용:', error);
      this.useFallback = true;
      this.initialized = true;
    }
  }

  /**
   * 메모리 저장
   */
  async storeMemory(studentId: string, memory: LearningMemory): Promise<void> {
    await this.initialize();

    // 메모리 텍스트 생성 (임베딩용)
    const textForEmbedding = this.createEmbeddingText(memory);
    const embedding = await this.embeddingGenerator.generateEmbedding(textForEmbedding);

    if (this.useFallback) {
      this.storeFallback(studentId, memory, embedding);
      return;
    }

    const metadata: ChromaMetadata = {
      studentId,
      type: memory.type,
      subject: memory.subject,
      topic: memory.topic,
      title: memory.title,
      confidence: memory.confidence,
      difficulty: memory.difficulty,
      masteryScore: memory.masteryScore,
      createdAt: memory.createdAt.toISOString(),
      lastRecalled: memory.lastRecalled.toISOString(),
      emotionAtCreation: memory.emotionAtCreation,
      recallCount: memory.recallCount,
      positiveFeedback: memory.positiveFeedback,
      negativeFeedback: memory.negativeFeedback,
      timesObserved: memory.timesObserved,
    };

    await this.collection!.add({
      ids: [memory.id],
      embeddings: [embedding],
      metadatas: [metadata],
      documents: [memory.content],
    });
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

    const ids = memories.map(m => m.id);
    const metadatas: ChromaMetadata[] = memories.map(m => ({
      studentId,
      type: m.type,
      subject: m.subject,
      topic: m.topic,
      title: m.title,
      confidence: m.confidence,
      difficulty: m.difficulty,
      masteryScore: m.masteryScore,
      createdAt: m.createdAt.toISOString(),
      lastRecalled: m.lastRecalled.toISOString(),
      emotionAtCreation: m.emotionAtCreation,
      recallCount: m.recallCount,
      positiveFeedback: m.positiveFeedback,
      negativeFeedback: m.negativeFeedback,
      timesObserved: m.timesObserved,
    }));
    const documents = memories.map(m => m.content);

    await this.collection!.add({
      ids,
      embeddings,
      metadatas,
      documents,
    });
  }

  /**
   * Semantic Search - 유사도 기반 메모리 검색
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
  }): Promise<Array<{
    memory: LearningMemory;
    similarity: number;
  }>> {
    await this.initialize();

    const { studentId, query, topK = 20, filters } = params;

    const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);

    if (this.useFallback) {
      return this.searchFallback(studentId, queryEmbedding, topK, filters);
    }

    // ChromaDB 필터 구성
    const whereFilters: Record<string, unknown> = {
      studentId: { $eq: studentId },
    };

    if (filters?.subject) {
      whereFilters.subject = { $eq: filters.subject };
    }

    if (filters?.minConfidence !== undefined) {
      whereFilters.confidence = { $gte: filters.minConfidence };
    }

    // ChromaDB는 $in 연산자로 여러 값 필터링
    if (filters?.types && filters.types.length > 0) {
      whereFilters.type = { $in: filters.types };
    }

    const results = await this.collection!.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      where: whereFilters,
      include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances],
    });

    if (!results.ids[0] || results.ids[0].length === 0) {
      return [];
    }

    return results.ids[0].map((id, idx) => {
      const metadata = results.metadatas?.[0]?.[idx] as unknown as ChromaMetadata | undefined;
      const document = results.documents?.[0]?.[idx];
      const distance = results.distances?.[0]?.[idx] ?? 1;

      // ChromaDB는 거리(distance)를 반환하므로 유사도로 변환
      // L2 거리: similarity = 1 / (1 + distance)
      // 코사인 거리: similarity = 1 - distance
      const similarity = 1 - distance;

      const memory: LearningMemory = {
        id,
        type: (metadata?.type || 'LEARNING') as MemoryType,
        subject: (metadata?.subject || 'GENERAL') as Subject,
        topic: metadata?.topic || '',
        title: metadata?.title || '',
        content: document || '',
        confidence: metadata?.confidence || 0.8,
        difficulty: metadata?.difficulty || 3,
        masteryScore: metadata?.masteryScore || 5,
        timesObserved: metadata?.timesObserved || 1,
        recallCount: metadata?.recallCount || 0,
        positiveFeedback: metadata?.positiveFeedback || 0,
        negativeFeedback: metadata?.negativeFeedback || 0,
        createdAt: new Date(metadata?.createdAt || Date.now()),
        lastRecalled: new Date(metadata?.lastRecalled || Date.now()),
        emotionAtCreation: (metadata?.emotionAtCreation || 'NEUTRAL') as LearningMemory['emotionAtCreation'],
      };

      return { memory, similarity };
    });
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

    const results = await this.collection!.get({
      where: { studentId: { $eq: studentId } },
      include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
    });

    if (!results.ids || results.ids.length === 0) {
      return [];
    }

    return results.ids.map((id, idx) => {
      const metadata = results.metadatas?.[idx] as unknown as ChromaMetadata | undefined;
      const document = results.documents?.[idx];

      return {
        id,
        type: (metadata?.type || 'LEARNING') as MemoryType,
        subject: (metadata?.subject || 'GENERAL') as Subject,
        topic: metadata?.topic || '',
        title: metadata?.title || '',
        content: document || '',
        confidence: metadata?.confidence || 0.8,
        difficulty: metadata?.difficulty || 3,
        masteryScore: metadata?.masteryScore || 5,
        timesObserved: metadata?.timesObserved || 1,
        recallCount: metadata?.recallCount || 0,
        positiveFeedback: metadata?.positiveFeedback || 0,
        negativeFeedback: metadata?.negativeFeedback || 0,
        createdAt: new Date(metadata?.createdAt || Date.now()),
        lastRecalled: new Date(metadata?.lastRecalled || Date.now()),
        emotionAtCreation: (metadata?.emotionAtCreation || 'NEUTRAL') as LearningMemory['emotionAtCreation'],
      };
    });
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
        const textForEmbedding = this.createEmbeddingText(memory);
        const embedding = await this.embeddingGenerator.generateEmbedding(textForEmbedding);
        items[idx] = { memory, embedding, studentId };
      }
      return;
    }

    const textForEmbedding = this.createEmbeddingText(memory);
    const embedding = await this.embeddingGenerator.generateEmbedding(textForEmbedding);

    const metadata: ChromaMetadata = {
      studentId,
      type: memory.type,
      subject: memory.subject,
      topic: memory.topic,
      title: memory.title,
      confidence: memory.confidence,
      difficulty: memory.difficulty,
      masteryScore: memory.masteryScore,
      createdAt: memory.createdAt.toISOString(),
      lastRecalled: memory.lastRecalled.toISOString(),
      emotionAtCreation: memory.emotionAtCreation,
      recallCount: memory.recallCount,
      positiveFeedback: memory.positiveFeedback,
      negativeFeedback: memory.negativeFeedback,
      timesObserved: memory.timesObserved,
    };

    await this.collection!.update({
      ids: [memory.id],
      embeddings: [embedding],
      metadatas: [metadata],
      documents: [memory.content],
    });
  }

  /**
   * 메모리 삭제
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.initialize();

    if (this.useFallback) {
      for (const [studentId, items] of this.fallbackStore.entries()) {
        const filtered = items.filter(item => item.memory.id !== memoryId);
        this.fallbackStore.set(studentId, filtered);
      }
      return;
    }

    await this.collection!.delete({
      ids: [memoryId],
    });
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

    // ChromaDB에서 studentId로 필터링하여 삭제
    const all = await this.getAllMemories(studentId);
    if (all.length > 0) {
      await this.collection!.delete({
        ids: all.map(m => m.id),
      });
    }
  }

  /**
   * 임베딩용 텍스트 생성
   */
  private createEmbeddingText(memory: LearningMemory): string {
    return [
      `[${memory.type}]`,
      `제목: ${memory.title}`,
      `과목: ${memory.subject}`,
      `토픽: ${memory.topic}`,
      `내용: ${memory.content}`,
    ].join(' ');
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

    // 필터 적용
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

    // 유사도 계산
    const withSimilarity = filtered.map(item => ({
      memory: item.memory,
      similarity: EmbeddingGenerator.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    // 정렬 및 상위 K개 반환
    return withSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}
