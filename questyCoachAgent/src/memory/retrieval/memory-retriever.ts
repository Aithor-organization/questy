/**
 * MemoryRetriever
 * Query-Aware 6-Factor Re-Ranking 시스템
 * spec.md 기준: semanticSimilarity(0.45), recency(0.10), confidence(0.10),
 *              typeBoost(0.15), subjectMatch(0.10), urgencyBoost(0.10)
 */

import type {
  LearningMemory,
  RetrievedMemory,
  ReRankingWeights,
  MemoryType,
  Subject,
  QueryIntent,
} from '../../types/memory.js';

// Query Intent → Memory Type 부스트 매핑
const INTENT_TYPE_BOOST: Record<QueryIntent, MemoryType[]> = {
  RECALL_MISTAKES: ['WRONG_ANSWER', 'CORRECTION', 'GAP', 'STRUGGLE'],
  FIND_PATTERNS: ['PATTERN', 'STRATEGY', 'PREFERENCE'],
  CHECK_PROGRESS: ['MASTERY', 'LEARNING', 'DECISION'],
  REVIEW_DECISIONS: ['DECISION', 'STRATEGY', 'INSIGHT'],
  GENERAL_SEARCH: [],
};

// 의도 감지 패턴
const INTENT_PATTERNS: Record<QueryIntent, RegExp[]> = {
  RECALL_MISTAKES: [
    /틀린|실수|오답|잘못|모르/i,
    /왜.*틀렸|어디.*틀렸/i,
  ],
  FIND_PATTERNS: [
    /패턴|방법|어떻게|전략|습관/i,
    /나한테.*맞는|효과적/i,
  ],
  CHECK_PROGRESS: [
    /진도|어디까지|얼마나|완료/i,
    /진행.*상황|상태/i,
  ],
  REVIEW_DECISIONS: [
    /결정|선택|정했|했던/i,
    /뭘.*하기로|무엇.*선택/i,
  ],
  GENERAL_SEARCH: [/.*/],
};

export interface MemoryRetrieverConfig {
  weights: ReRankingWeights;
  typeBoostAmount: number;      // 타입 부스트 양 (기본 0.15)
  maxResults: number;           // 최대 반환 개수
  minScore: number;             // 최소 점수 임계값
}

const DEFAULT_WEIGHTS: ReRankingWeights = {
  semanticSimilarity: 0.45,
  recency: 0.10,
  confidence: 0.10,
  typeBoost: 0.15,
  subjectMatch: 0.10,
  urgencyBoost: 0.10,
};

export class MemoryRetriever {
  private config: MemoryRetrieverConfig;

  constructor(config: Partial<MemoryRetrieverConfig> = {}) {
    this.config = {
      weights: config.weights ?? DEFAULT_WEIGHTS,
      typeBoostAmount: config.typeBoostAmount ?? 0.15,
      maxResults: config.maxResults ?? 10,
      minScore: config.minScore ?? 0.3,
    };
  }

  /**
   * Query-Aware Memory Retrieval with 6-Factor Re-Ranking
   */
  async retrieve(params: {
    query: string;
    memories: LearningMemory[];
    semanticScores: Map<string, number>;  // memoryId → semantic similarity
    currentSubject?: Subject;
    urgentTopics?: string[];
  }): Promise<RetrievedMemory[]> {
    const { query, memories, semanticScores, currentSubject, urgentTopics } = params;

    // 1. 쿼리 의도 감지
    const intent = this.detectQueryIntent(query);

    // 2. 부스트할 메모리 유형 결정
    const boostedTypes = INTENT_TYPE_BOOST[intent];

    // 3. 각 메모리에 대해 6-Factor 점수 계산
    const scoredMemories: RetrievedMemory[] = memories.map((memory) => {
      const scores = this.calculate6FactorScore({
        memory,
        semanticScore: semanticScores.get(memory.id) ?? 0,
        boostedTypes,
        currentSubject,
        urgentTopics,
      });

      return {
        ...memory,
        retrievalScore: scores.total,
        scoreBreakdown: scores.breakdown,
      };
    });

    // 4. 점수로 정렬 및 필터링
    return scoredMemories
      .filter((m) => m.retrievalScore >= this.config.minScore)
      .sort((a, b) => b.retrievalScore - a.retrievalScore)
      .slice(0, this.config.maxResults);
  }

  /**
   * 6-Factor 점수 계산
   */
  private calculate6FactorScore(params: {
    memory: LearningMemory;
    semanticScore: number;
    boostedTypes: MemoryType[];
    currentSubject?: Subject;
    urgentTopics?: string[];
  }): { total: number; breakdown: RetrievedMemory['scoreBreakdown'] } {
    const { memory, semanticScore, boostedTypes, currentSubject, urgentTopics } = params;
    const w = this.config.weights;

    // 1. Semantic Similarity (0.45)
    const semantic = semanticScore * w.semanticSimilarity;

    // 2. Recency (0.10) - 최근일수록 높음
    const daysSinceRecall = this.daysSince(memory.lastRecalled);
    const recencyScore = Math.max(0, 1 - daysSinceRecall / 30); // 30일 기준
    const recency = recencyScore * w.recency;

    // 3. Confidence (0.10)
    const confidence = memory.confidence * w.confidence;

    // 4. Type Boost (0.15) - Query Intent에 따른 부스트
    const typeBoost = boostedTypes.includes(memory.type)
      ? this.config.typeBoostAmount
      : 0;

    // 5. Subject Match (0.10) - 현재 과목과 일치
    const subjectMatch = currentSubject && memory.subject === currentSubject
      ? w.subjectMatch
      : 0;

    // 6. Urgency Boost (0.10) - 복습 필요 토픽
    const urgency = urgentTopics?.includes(memory.topic)
      ? w.urgencyBoost
      : 0;

    const total = semantic + recency + confidence + typeBoost + subjectMatch + urgency;

    return {
      total: Math.min(1, total),
      breakdown: {
        semantic,
        recency,
        confidence,
        typeBoost,
        subjectMatch,
        urgency,
      },
    };
  }

  /**
   * 쿼리 의도 감지
   */
  private detectQueryIntent(query: string): QueryIntent {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (intent === 'GENERAL_SEARCH') continue;
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return intent as QueryIntent;
        }
      }
    }
    return 'GENERAL_SEARCH';
  }

  /**
   * 날짜 차이 계산 (일 단위)
   */
  private daysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Re-Ranking 가중치 업데이트
   */
  updateWeights(newWeights: Partial<ReRankingWeights>): void {
    this.config.weights = {
      ...this.config.weights,
      ...newWeights,
    };
  }

  /**
   * 현재 가중치 반환
   */
  getWeights(): ReRankingWeights {
    return { ...this.config.weights };
  }
}
