/**
 * MemoryLane
 * 학습 기억 시스템의 통합 인터페이스
 * - ChromaDB 벡터 저장소 기반 (FR-081)
 * - 768차원 임베딩
 * - 12가지 Memory Type
 * - 6-Factor Query-Aware Re-Ranking
 * - SM-2 Spaced Repetition
 * - Burnout Monitoring
 */

import type {
  LearningMemory,
  MemoryContext,
  RetrievedMemory,
  TopicMastery,
  Subject,
  Emotion,
  MemoryExtractionRequest,
  BurnoutIndicator,
} from '../types/memory.js';
import { LearningMemoryCatcher } from './catcher/index.js';
import { MemoryRetriever } from './retrieval/index.js';
import { SpacedRepetitionManager } from './mastery/index.js';
import { BurnoutMonitor } from './monitor/index.js';
import { MemoryContextInjector } from './injection/index.js';
import { ChromaMemoryStorage, type ChromaStorageConfig } from './storage/index.js';

export interface MemoryLaneConfig {
  enableAutoExtraction: boolean;
  enableBurnoutMonitoring: boolean;
  enableSpacedRepetition: boolean;
  enableChromaDB: boolean;  // ChromaDB 사용 여부
  maxMemoriesPerStudent: number;
  chromaConfig?: ChromaStorageConfig;
}

const DEFAULT_CONFIG: MemoryLaneConfig = {
  enableAutoExtraction: true,
  enableBurnoutMonitoring: true,
  enableSpacedRepetition: true,
  enableChromaDB: true,  // 기본 활성화
  maxMemoriesPerStudent: 1000,
};

export class MemoryLane {
  private config: MemoryLaneConfig;
  private memoryCatcher: LearningMemoryCatcher;
  private memoryRetriever: MemoryRetriever;
  private spacedRepetition: SpacedRepetitionManager;
  private burnoutMonitor: BurnoutMonitor;
  private contextInjector: MemoryContextInjector;

  // ChromaDB 벡터 저장소
  private chromaStorage: ChromaMemoryStorage;

  // 인메모리 캐시 (빠른 조회용)
  private memoryCache: Map<string, LearningMemory[]>;

  constructor(config: Partial<MemoryLaneConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.memoryCatcher = new LearningMemoryCatcher({
      enableAutoExtraction: this.config.enableAutoExtraction,
    });

    this.memoryRetriever = new MemoryRetriever();
    this.spacedRepetition = new SpacedRepetitionManager();
    this.burnoutMonitor = new BurnoutMonitor();
    this.contextInjector = new MemoryContextInjector();

    // ChromaDB 저장소 초기화
    this.chromaStorage = new ChromaMemoryStorage(this.config.chromaConfig);

    // 인메모리 캐시
    this.memoryCache = new Map();
  }

  /**
   * 대화에서 학습 기억 추출 및 저장
   */
  async extractAndStore(
    studentId: string,
    request: MemoryExtractionRequest
  ): Promise<LearningMemory[]> {
    // 1. 메모리 추출
    const extractedMemories = await this.memoryCatcher.extractMemories(request);

    if (extractedMemories.length === 0) {
      return [];
    }

    // 2. ChromaDB에 저장
    if (this.config.enableChromaDB) {
      await this.chromaStorage.storeBatch(studentId, extractedMemories);
    }

    // 3. 캐시 업데이트
    const cached = this.memoryCache.get(studentId) ?? [];
    const updatedCache = [...cached, ...extractedMemories];

    // 캐시 크기 제한
    if (updatedCache.length > this.config.maxMemoriesPerStudent) {
      updatedCache.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      updatedCache.splice(this.config.maxMemoriesPerStudent);
    }

    this.memoryCache.set(studentId, updatedCache);

    // 4. 감정 기록 (번아웃 모니터링)
    if (this.config.enableBurnoutMonitoring) {
      for (const memory of extractedMemories) {
        this.burnoutMonitor.recordEmotion(studentId, memory.emotionAtCreation);
      }
    }

    // 5. 숙달도 초기화 (새 토픽)
    if (this.config.enableSpacedRepetition) {
      for (const memory of extractedMemories) {
        if (!this.spacedRepetition.getMastery(memory.topic)) {
          this.spacedRepetition.initializeMastery({
            topicId: memory.topic,
            subject: memory.subject,
          });
        }
      }
    }

    return extractedMemories;
  }

  /**
   * Query-Aware 메모리 검색 (ChromaDB Semantic Search 활용)
   */
  async retrieveContext(params: {
    studentId: string;
    query: string;
    currentSubject?: Subject;
  }): Promise<MemoryContext> {
    const { studentId, query, currentSubject } = params;

    // 1. ChromaDB Semantic Search
    let semanticResults: Array<{ memory: LearningMemory; similarity: number }> = [];

    if (this.config.enableChromaDB) {
      semanticResults = await this.chromaStorage.searchSimilar({
        studentId,
        query,
        topK: 50,  // 상위 50개 후보
        filters: {
          subject: currentSubject,
          minConfidence: 0.6,
        },
      });
    }

    // 2. 검색 결과에서 메모리와 점수 추출
    const memories = semanticResults.map(r => r.memory);
    const semanticScores = new Map(
      semanticResults.map(r => [r.memory.id, r.similarity])
    );

    // 3. 폴백: 캐시에서 검색 (ChromaDB 결과가 없을 경우)
    if (memories.length === 0) {
      const cachedMemories = this.memoryCache.get(studentId) ?? [];
      const fallbackScores = this.calculateFallbackScores(query, cachedMemories);

      for (const memory of cachedMemories) {
        if (!semanticScores.has(memory.id)) {
          memories.push(memory);
          semanticScores.set(memory.id, fallbackScores.get(memory.id) ?? 0);
        }
      }
    }

    // 4. 복습 필요 토픽
    const reviewDue = this.config.enableSpacedRepetition
      ? this.spacedRepetition.getTopicsDueForReview(currentSubject)
      : [];

    const urgentTopics = reviewDue.map((t) => t.topicId);

    // 5. 6-Factor Re-Ranking 기반 최종 검색
    const relevantMemories = await this.memoryRetriever.retrieve({
      query,
      memories,
      semanticScores,
      currentSubject,
      urgentTopics,
    });

    // 6. 숙달도 정보
    const masteryInfo = this.getMasteryInfo(studentId, currentSubject);

    // 7. 번아웃 상태
    const burnoutStatus = this.config.enableBurnoutMonitoring
      ? this.burnoutMonitor.assessBurnout(studentId)
      : undefined;

    return {
      relevantMemories,
      masteryInfo,
      burnoutStatus,
      reviewDue,
    };
  }

  /**
   * 프롬프트용 컨텍스트 텍스트 생성
   */
  async getContextForPrompt(params: {
    studentId: string;
    query: string;
    currentSubject?: Subject;
    compact?: boolean;
  }): Promise<string> {
    const context = await this.retrieveContext(params);

    if (params.compact) {
      return this.contextInjector.createCompactContext(context);
    }

    return this.contextInjector.injectContext(context, params.currentSubject);
  }

  /**
   * 학습 결과 기록 (숙달도 업데이트)
   */
  recordLearningResult(params: {
    studentId: string;
    topicId: string;
    quality: number;  // 0-5 (SM-2)
    emotion?: Emotion;
  }): TopicMastery {
    const { studentId, topicId, quality, emotion } = params;

    // 숙달도 업데이트
    const updatedMastery = this.spacedRepetition.updateMastery(topicId, quality);

    // 감정 기록
    if (emotion && this.config.enableBurnoutMonitoring) {
      this.burnoutMonitor.recordEmotion(studentId, emotion);
    }

    return updatedMastery;
  }

  /**
   * 피드백 기록
   */
  async recordFeedback(memoryId: string, studentId: string, isPositive: boolean): Promise<void> {
    // 캐시에서 찾기
    const memories = this.memoryCache.get(studentId);
    if (!memories) return;

    const memory = memories.find((m) => m.id === memoryId);
    if (!memory) return;

    if (isPositive) {
      memory.positiveFeedback++;
    } else {
      memory.negativeFeedback++;
    }

    // 인출 횟수 증가
    memory.recallCount++;
    memory.lastRecalled = new Date();

    // ChromaDB 업데이트
    if (this.config.enableChromaDB) {
      await this.chromaStorage.updateMemory(studentId, memory);
    }
  }

  /**
   * 번아웃 상태 확인
   */
  checkBurnoutStatus(studentId: string): BurnoutIndicator {
    return this.burnoutMonitor.assessBurnout(studentId);
  }

  /**
   * 학습 권장 여부
   */
  shouldContinueStudying(studentId: string): {
    recommendation: 'CONTINUE' | 'TAKE_BREAK' | 'STOP_TODAY';
    reason: string;
  } {
    return this.burnoutMonitor.shouldContinueStudying(studentId);
  }

  /**
   * 복습 권장 사항
   */
  getReviewRecommendations(studentId: string, subject?: Subject): string[] {
    return this.spacedRepetition.generateRecommendations(subject);
  }

  /**
   * 과목별 통계
   */
  getSubjectStats(studentId: string, subject: Subject) {
    return this.spacedRepetition.getSubjectStats(subject);
  }

  /**
   * 메모리 직접 추가
   */
  async addMemory(studentId: string, memory: LearningMemory): Promise<void> {
    // ChromaDB에 저장
    if (this.config.enableChromaDB) {
      await this.chromaStorage.storeMemory(studentId, memory);
    }

    // 캐시 업데이트
    const memories = this.memoryCache.get(studentId) ?? [];
    memories.push(memory);
    this.memoryCache.set(studentId, memories);
  }

  /**
   * 학생의 모든 메모리 조회
   */
  async getAllMemories(studentId: string): Promise<LearningMemory[]> {
    if (this.config.enableChromaDB) {
      const memories = await this.chromaStorage.getAllMemories(studentId);

      // 캐시 갱신
      this.memoryCache.set(studentId, memories);

      return memories;
    }

    return this.memoryCache.get(studentId) ?? [];
  }

  /**
   * 폴백 유사도 계산 (키워드 매칭)
   */
  private calculateFallbackScores(
    query: string,
    memories: LearningMemory[]
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const queryTokens = query.toLowerCase().split(/\s+/);

    for (const memory of memories) {
      const contentTokens = memory.content.toLowerCase().split(/\s+/);
      const titleTokens = memory.title.toLowerCase().split(/\s+/);
      const allTokens = [...contentTokens, ...titleTokens];

      // 간단한 Jaccard 유사도
      const intersection = queryTokens.filter((t) => allTokens.includes(t));
      const union = new Set([...queryTokens, ...allTokens]);

      const score = intersection.length / union.size;
      scores.set(memory.id, score);
    }

    return scores;
  }

  /**
   * 숙달도 정보 조회
   */
  private getMasteryInfo(studentId: string, subject?: Subject): TopicMastery[] {
    const allMastery = this.spacedRepetition.exportAll();

    if (subject) {
      return allMastery.filter((m) => m.subject === subject);
    }

    return allMastery;
  }

  /**
   * 데이터 내보내기
   */
  async exportData(studentId: string) {
    const memories = await this.getAllMemories(studentId);

    return {
      memories,
      mastery: this.spacedRepetition.exportAll(),
      emotions: this.burnoutMonitor.exportHistory(studentId),
    };
  }

  /**
   * 데이터 가져오기
   */
  async importData(studentId: string, data: Awaited<ReturnType<typeof this.exportData>>) {
    // ChromaDB에 저장
    if (this.config.enableChromaDB && data.memories.length > 0) {
      await this.chromaStorage.storeBatch(studentId, data.memories);
    }

    // 캐시 업데이트
    this.memoryCache.set(studentId, data.memories);

    // 숙달도 가져오기
    this.spacedRepetition.importAll(data.mastery);
  }

  /**
   * 학생 데이터 삭제
   */
  async deleteStudentData(studentId: string): Promise<void> {
    // ChromaDB에서 삭제
    if (this.config.enableChromaDB) {
      await this.chromaStorage.deleteAllMemories(studentId);
    }

    // 캐시에서 삭제
    this.memoryCache.delete(studentId);
  }
}
