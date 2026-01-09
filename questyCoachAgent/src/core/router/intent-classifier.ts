/**
 * IntentClassifier
 * GPT-5-nano 기반 의도 분류 및 에이전트 라우팅
 * 3-Level Smart Router (Simple/Medium/Complex)
 */

import type {
  IntentCategory,
  RouteDecision,
  AgentRole
} from '../../types/agent.js';

// 의도별 키워드 매핑
const INTENT_KEYWORDS: Record<IntentCategory, RegExp[]> = {
  ENROLLMENT: [
    /등록|가입|신청|시작하고|새로|처음/i,
    /어떻게.*시작|어디서.*시작/i,
  ],
  STUDY_PLAN: [
    /계획.*짜|계획.*만들|계획.*생성/i,
    /스케줄.*짜|스케줄.*만들|스케줄.*생성/i,
    /커리큘럼.*짜|커리큘럼.*만들|커리큘럼.*생성/i,
    /로드맵.*짜|로드맵.*만들|로드맵.*생성/i,
    /계획.*세워|스케줄.*세워/i,
  ],
  QUESTION: [
    /뭐야|무엇|어떻게|왜|설명|알려/i,
    /이해.*안|모르겠|헷갈|문제.*풀어/i,
    /뭐.*공부|어떤.*공부|오늘.*공부/i, // 공부 추천/질문은 코치에게
    /공부.*법|공부.*방법/i,
  ],
  PROGRESS: [
    /진도|진행|얼마나|어디까지|완료|끝났/i,
    /지금.*상태|현재.*위치/i,
  ],
  MOTIVATION: [
    /자신.*없|할수.*있을까|포기|힘들|어려/i,
    /동기|의욕|응원|격려|힘내/i,
  ],
  EMOTIONAL: [
    /기분|느낌|스트레스|불안|걱정|우울/i,
    /피곤|지쳐|싫어|귀찮/i,
  ],
  FEEDBACK: [
    /피드백|리뷰|평가|채점|맞았|틀렸/i,
    /어땠|잘했|못했|개선/i,
  ],
  ADMIN: [
    /설정|변경|수정|삭제|취소|환불/i,
    /비밀번호|계정|프로필/i,
  ],
  SCHEDULE_CHANGE: [
    /일정.*변경|스케줄.*변경|일정.*조정|스케줄.*조정/i,
    /미루|미뤄|연기|늦춰|뒤로|당기|옮겨|옮기/i,
    /못할것.*같|못 할것.*같|바빠서|시간.*없|일이.*있어/i,
    /여행|휴가|아파서|병원|시험.*때문|행사/i,
    /퀘스트.*변경|일정.*다시|스케줄.*다시/i,
    /일요일|월요일|화요일|수요일|목요일|금요일|토요일/i,  // 특정 요일 언급
  ],
  SCHEDULE_REMINDER: [
    /알려줘|알림.*보내|리마인드|리마인더|reminder/i,
    /\d+\s*시.*알려|\d+\s*시.*알림/i,
    /오후.*알려|오전.*알려|저녁.*알려|아침.*알려/i,
    /내일.*알려|모레.*알려|다음.*알려/i,
    /잊지.*않게|까먹지.*않게|기억.*나게/i,
    /시간.*되면.*알려|때.*되면.*알려/i,
  ],
};

// 의도 → 에이전트 매핑
const INTENT_TO_AGENT: Record<IntentCategory, AgentRole> = {
  ENROLLMENT: 'ADMISSION',
  STUDY_PLAN: 'PLANNER',
  QUESTION: 'COACH',
  PROGRESS: 'ANALYST',
  MOTIVATION: 'COACH',
  EMOTIONAL: 'COACH',
  FEEDBACK: 'ANALYST',
  ADMIN: 'DIRECTOR',
  SCHEDULE_CHANGE: 'PLANNER',     // 일정 변경은 Planner가 처리
  SCHEDULE_REMINDER: 'COACH',     // 알림 예약은 Coach가 처리
};

// 복잡도 키워드
const COMPLEXITY_KEYWORDS: Record<string, number> = {
  // High (0.25+)
  '구현': 0.35,
  'implement': 0.35,
  '설계': 0.35,
  '분석': 0.30,
  'analyze': 0.30,
  '최적화': 0.30,
  '아키텍처': 0.40,
  '종합': 0.30,
  '비교': 0.25,
  // Medium (0.15-0.24)
  '만들어': 0.20,
  'create': 0.20,
  '설명': 0.15,
  'explain': 0.15,
  '왜': 0.20,
  '어떻게': 0.20,
  // Low (0-0.14)
  '안녕': 0.05,
  'hello': 0.05,
  '뭐야': 0.10,
  'what': 0.10,
  '네': 0.05,
  '아니': 0.05,
};

export interface IntentClassifierConfig {
  simpleThreshold: number;   // Simple 임계값 (기본 0.3)
  complexThreshold: number;  // Complex 임계값 (기본 0.6)
}

const DEFAULT_CONFIG: IntentClassifierConfig = {
  simpleThreshold: 0.3,
  complexThreshold: 0.6,
};

export class IntentClassifier {
  private config: IntentClassifierConfig;

  constructor(config: Partial<IntentClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 메시지 의도 분류 및 라우팅 결정
   */
  classify(message: string): RouteDecision {
    // 1. 의도 감지
    const intent = this.detectIntent(message);

    // 2. 복잡도 계산
    const complexity = this.calculateComplexity(message);

    // 3. 대상 에이전트 결정
    const targetAgent = INTENT_TO_AGENT[intent];

    // 4. 신뢰도 계산
    const confidence = this.calculateConfidence(message, intent);

    return {
      targetAgent,
      confidence,
      intent,
      reasoning: this.generateReasoning(intent, complexity, targetAgent),
    };
  }

  /**
   * 의도 감지
   */
  private detectIntent(message: string): IntentCategory {
    let bestMatch: IntentCategory = 'QUESTION';  // 기본값
    let bestScore = 0;

    for (const [intent, patterns] of Object.entries(INTENT_KEYWORDS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent as IntentCategory;
      }
    }

    return bestMatch;
  }

  /**
   * 복잡도 계산 (0-1)
   */
  calculateComplexity(message: string): number {
    let complexity = 0;
    const lowerMessage = message.toLowerCase();

    for (const [keyword, weight] of Object.entries(COMPLEXITY_KEYWORDS)) {
      if (lowerMessage.includes(keyword)) {
        complexity += weight;
      }
    }

    // 메시지 길이 가중치
    if (message.length > 100) complexity += 0.1;
    if (message.length > 200) complexity += 0.1;

    // 질문 수 가중치
    const questionCount = (message.match(/\?/g) ?? []).length;
    complexity += questionCount * 0.05;

    return Math.min(1, complexity);
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(message: string, intent: IntentCategory): number {
    let confidence = 0.5;  // 기본 신뢰도

    // 키워드 매칭 강도
    const patterns = INTENT_KEYWORDS[intent];
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) matchCount++;
    }
    confidence += matchCount * 0.15;

    // 메시지 길이에 따른 조정
    if (message.length > 20) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  /**
   * 라우팅 이유 생성
   */
  private generateReasoning(
    intent: IntentCategory,
    complexity: number,
    agent: AgentRole
  ): string {
    const complexityLevel = complexity < this.config.simpleThreshold
      ? 'Simple'
      : complexity < this.config.complexThreshold
        ? 'Medium'
        : 'Complex';

    return `Intent: ${intent}, Complexity: ${complexityLevel} (${(complexity * 100).toFixed(0)}%), Agent: ${agent}`;
  }

  /**
   * 모델 선택 (3-Level Router)
   */
  selectModel(complexity: number): 'gpt-5-nano' | 'claude-4.5-haiku' | 'gemini-3-flash' {
    if (complexity < this.config.simpleThreshold) {
      return 'gpt-5-nano';  // Simple → Fast
    } else if (complexity < this.config.complexThreshold) {
      return 'claude-4.5-haiku';  // Medium → Balanced
    } else {
      return 'gemini-3-flash';  // Complex → Analytical
    }
  }

  /**
   * 멀티모달 감지
   */
  hasMultimodalContent(message: string): boolean {
    return /이미지|사진|그림|스크린샷|pdf|파일/.test(message.toLowerCase());
  }
}
