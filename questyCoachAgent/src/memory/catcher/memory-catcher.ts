/**
 * LearningMemoryCatcher
 * 대화에서 학습 기억을 자동으로 추출하는 시스템
 * Teacher 모델이 메모리 유형을 분류 (90%+ 정확도 목표)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  LearningMemory,
  MemoryType,
  Subject,
  Emotion,
  MemoryExtractionRequest,
} from '../../types/memory.js';

// 메모리 유형별 트리거 패턴
const MEMORY_TYPE_PATTERNS: Record<MemoryType, RegExp[]> = {
  CORRECTION: [
    /아니[야요]?,?\s*(그게 아니라|X 말고|틀렸어)/i,
    /수정해|고쳐|바꿔/i,
    /오답.*교정/i,
  ],
  DECISION: [
    /결정했[어요다]|선택했[어요다]/i,
    /(으로|로)\s*(하기로|결정)/i,
    /이걸로\s*(할게|하자)/i,
  ],
  INSIGHT: [
    /깨달았[어요다]|알았[어요다]|이해했[어요다]/i,
    /아하|그렇구나|이래서/i,
    /드디어.*알겠/i,
  ],
  PATTERN: [
    /항상|매번|늘|습관적으로/i,
    /이런\s*식으로|이\s*패턴/i,
    /나는.*경향/i,
  ],
  GAP: [
    /모르겠|어렵|이해.*안/i,
    /헷갈|혼란|막막/i,
    /부족|약한|취약/i,
  ],
  LEARNING: [
    /배웠|공부했|학습했/i,
    /이것.*기억|외웠/i,
    /새로.*알게/i,
  ],
  MASTERY: [
    /완벽|자신\s*있|할\s*수\s*있/i,
    /이건\s*알|다\s*알/i,
    /쉬워|문제\s*없/i,
  ],
  STRUGGLE: [
    /어려워|힘들어|못\s*하겠/i,
    /계속.*틀려|반복.*실패/i,
    /포기|지쳐/i,
  ],
  WRONG_ANSWER: [
    /틀렸[어요다]|오답|실수했/i,
    /맞히지.*못|틀린\s*이유/i,
    /왜\s*틀렸/i,
  ],
  STRATEGY: [
    /이렇게.*풀[어면]|방법|전략/i,
    /접근.*방식|순서대로/i,
    /먼저.*그다음/i,
  ],
  PREFERENCE: [
    /좋아|선호|편해/i,
    /싫어|불편|귀찮/i,
    /이게\s*더\s*나/i,
  ],
  EMOTION: [
    /기분|느낌|감정/i,
    /스트레스|불안|걱정/i,
    /기뻐|뿌듯|자랑스러/i,
  ],
  PLAN_PERFORMANCE: [
    /플랜.*완료|계획.*끝|학습.*마무리/i,
    /진행.*완료|달성.*목표/i,
  ],
  REVIEW_PATTERN: [
    /리뷰.*패턴|개선.*필요|반복.*문제/i,
    /학습.*패턴|효과.*검증/i,
  ],
};

// 과목 감지 패턴
const SUBJECT_PATTERNS: Record<Subject, RegExp[]> = {
  KOREAN: [/국어|문학|비문학|독해|문법|화법|작문/i],
  MATH: [/수학|미적분|확률|통계|기하|대수|함수|방정식/i],
  ENGLISH: [/영어|영문|단어|문법|독해|리스닝|스피킹/i],
  SCIENCE: [/과학|물리|화학|생물|지구과학|실험/i],
  SOCIAL: [/사회|역사|지리|경제|정치|윤리/i],
  GENERAL: [/.*/],
};

// 감정 감지 패턴
const EMOTION_PATTERNS: Record<Emotion, RegExp[]> = {
  CONFIDENT: [/자신\s*있|할\s*수\s*있|쉬워|완벽/i],
  CONFUSED: [/헷갈|혼란|모르겠|이해.*안/i],
  FRUSTRATED: [/짜증|화나|답답|왜.*안/i],
  CURIOUS: [/궁금|알고\s*싶|왜|어떻게/i],
  TIRED: [/피곤|지쳐|힘들어|졸려/i],
  MOTIVATED: [/열심히|해볼|도전|흥미/i],
  NEUTRAL: [/.*/],
};

export interface MemoryCatcherConfig {
  minConfidence: number;      // 최소 신뢰도 (기본 0.6)
  enableAutoExtraction: boolean;
  teacherModel?: string;      // Teacher 모델 (분류용)
}

export class LearningMemoryCatcher {
  private config: MemoryCatcherConfig;

  constructor(config: Partial<MemoryCatcherConfig> = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.6,
      enableAutoExtraction: config.enableAutoExtraction ?? true,
      teacherModel: config.teacherModel ?? 'gpt-5-nano',
    };
  }

  /**
   * 대화에서 학습 기억을 추출
   */
  async extractMemories(
    request: MemoryExtractionRequest
  ): Promise<LearningMemory[]> {
    const memories: LearningMemory[] = [];

    for (const message of request.messages) {
      if (message.role !== 'user') continue;

      const detectedType = this.detectMemoryType(message.content);
      if (!detectedType) continue;

      const confidence = this.calculateConfidence(message.content, detectedType);
      if (confidence < this.config.minConfidence) continue;

      const memory = this.createMemory({
        content: message.content,
        type: detectedType,
        confidence,
        subject: this.detectSubject(message.content) ?? request.currentSubject ?? 'GENERAL',
        emotion: this.detectEmotion(message.content) ?? request.studentContext?.currentEmotion ?? 'NEUTRAL',
        conversationId: request.conversationId,
      });

      memories.push(memory);
    }

    return memories;
  }

  /**
   * 메모리 유형 감지
   */
  private detectMemoryType(content: string): MemoryType | null {
    for (const [type, patterns] of Object.entries(MEMORY_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return type as MemoryType;
        }
      }
    }
    return null;
  }

  /**
   * 과목 감지
   */
  private detectSubject(content: string): Subject | null {
    for (const [subject, patterns] of Object.entries(SUBJECT_PATTERNS)) {
      if (subject === 'GENERAL') continue;
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return subject as Subject;
        }
      }
    }
    return null;
  }

  /**
   * 감정 감지
   */
  private detectEmotion(content: string): Emotion | null {
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
      if (emotion === 'NEUTRAL') continue;
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return emotion as Emotion;
        }
      }
    }
    return null;
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(content: string, type: MemoryType): number {
    let confidence = 0.6; // 기본 신뢰도

    // 패턴 매칭 강도에 따른 가중치
    const patterns = MEMORY_TYPE_PATTERNS[type];
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(content)) matchCount++;
    }
    confidence += Math.min(matchCount * 0.1, 0.2);

    // 내용 길이에 따른 가중치 (너무 짧으면 낮음)
    if (content.length > 50) confidence += 0.05;
    if (content.length > 100) confidence += 0.05;

    return Math.min(confidence, 0.9);
  }

  /**
   * 메모리 객체 생성
   */
  private createMemory(params: {
    content: string;
    type: MemoryType;
    confidence: number;
    subject: Subject;
    emotion: Emotion;
    conversationId: string;
  }): LearningMemory {
    const now = new Date();

    return {
      id: uuidv4(),
      type: params.type,
      subject: params.subject,
      topic: this.extractTopic(params.content),
      title: this.generateTitle(params.content, params.type),
      content: params.content,
      confidence: params.confidence,
      difficulty: this.estimateDifficulty(params.content),
      masteryScore: 0, // 초기값
      timesObserved: 1,
      recallCount: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      createdAt: now,
      lastRecalled: now,
      emotionAtCreation: params.emotion,
      metadata: {
        sourceConversationId: params.conversationId,
        tags: this.extractTags(params.content),
      },
    };
  }

  /**
   * 토픽 추출 (간단한 키워드 기반)
   */
  private extractTopic(content: string): string {
    // 주요 명사구 추출 시도 (간단한 휴리스틱)
    const match = content.match(/([가-힣]+)\s*(문제|단원|개념|공식|이론)/);
    return match ? match[1] : '일반';
  }

  /**
   * 제목 생성
   */
  private generateTitle(content: string, type: MemoryType): string {
    const prefix = {
      CORRECTION: '🔄 교정: ',
      DECISION: '📌 결정: ',
      INSIGHT: '💡 통찰: ',
      PATTERN: '🔁 패턴: ',
      GAP: '⚠️ 격차: ',
      LEARNING: '📚 학습: ',
      MASTERY: '✅ 숙달: ',
      STRUGGLE: '😓 어려움: ',
      WRONG_ANSWER: '❌ 오답: ',
      STRATEGY: '🎯 전략: ',
      PREFERENCE: '❤️ 선호: ',
      EMOTION: '💭 감정: ',
      PLAN_PERFORMANCE: '📊 성과: ',
      REVIEW_PATTERN: '🔍 리뷰패턴: ',
    }[type];

    const summary = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    return `${prefix}${summary}`;
  }

  /**
   * 난이도 추정
   */
  private estimateDifficulty(content: string): number {
    let difficulty = 3; // 기본 중간

    // 어려움 관련 키워드
    if (/어려|힘들|복잡|심화/i.test(content)) difficulty++;
    if (/매우\s*(어려|힘들)/i.test(content)) difficulty++;

    // 쉬움 관련 키워드
    if (/쉬워|간단|기초|기본/i.test(content)) difficulty--;
    if (/매우\s*(쉬워|간단)/i.test(content)) difficulty--;

    return Math.max(1, Math.min(5, difficulty));
  }

  /**
   * 태그 추출
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // 과목 태그
    for (const subject of Object.keys(SUBJECT_PATTERNS)) {
      if (subject !== 'GENERAL') {
        const patterns = SUBJECT_PATTERNS[subject as Subject];
        if (patterns.some((p) => p.test(content))) {
          tags.push(subject.toLowerCase());
        }
      }
    }

    return tags;
  }
}
