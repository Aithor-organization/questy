/**
 * Memory Lane Type Definitions
 * 12가지 학습 기억 유형과 관련 인터페이스
 */

// 14가지 메모리 유형 (플랜 성과 + 리뷰 패턴 추가)
export type MemoryType =
  | 'CORRECTION'        // 오답 교정 기록
  | 'DECISION'          // 학습 결정 사항
  | 'INSIGHT'           // 깨달음, 통찰
  | 'PATTERN'           // 반복되는 학습 패턴
  | 'GAP'               // 지식 격차, 약점
  | 'LEARNING'          // 일반 학습 내용
  | 'MASTERY'           // 숙달된 내용
  | 'STRUGGLE'          // 어려워하는 부분
  | 'WRONG_ANSWER'      // 오답 기록
  | 'STRATEGY'          // 문제 풀이 전략
  | 'PREFERENCE'        // 학습 선호도
  | 'EMOTION'           // 감정 상태
  | 'PLAN_PERFORMANCE'  // 플랜 성과 기록 (진화용)
  | 'REVIEW_PATTERN';   // 리뷰 패턴 기록 (진화용)

// 과목 유형
export type Subject =
  | 'KOREAN'     // 국어
  | 'MATH'       // 수학
  | 'ENGLISH'    // 영어
  | 'SCIENCE'    // 과학탐구
  | 'SOCIAL'     // 사회탐구
  | 'GENERAL';   // 일반

// 감정 상태
export type Emotion =
  | 'CONFIDENT'   // 자신감
  | 'CONFUSED'    // 혼란
  | 'FRUSTRATED'  // 좌절
  | 'CURIOUS'     // 호기심
  | 'TIRED'       // 피로
  | 'MOTIVATED'   // 동기부여
  | 'NEUTRAL';    // 중립

// 핵심 학습 기억 인터페이스
export interface LearningMemory {
  id: string;
  type: MemoryType;
  subject: Subject;
  topic: string;           // 토픽/단원
  title: string;           // 요약 제목
  content: string;         // 상세 내용
  confidence: number;      // 추출 신뢰도 (0.6-0.9)
  difficulty: number;      // 난이도 (1-5)
  masteryScore: number;    // 숙달도 (0-10, EMA 기반)
  timesObserved: number;   // 관찰 횟수
  recallCount: number;     // 인출 횟수
  positiveFeedback: number;
  negativeFeedback: number;
  createdAt: Date;
  lastRecalled: Date;
  emotionAtCreation: Emotion;

  // 메타데이터
  metadata?: {
    sourceConversationId?: string;
    relatedMemoryIds?: string[];
    tags?: string[];
  };
}

// 토픽 숙달도 (SM-2 알고리즘)
export interface TopicMastery {
  topicId: string;
  subject: Subject;
  masteryScore: number;      // 0-10
  easinessFactor: number;    // SM-2 EF (≥1.3)
  interval: number;          // 복습 간격 (일)
  repetitions: number;       // 반복 횟수
  nextReviewDate: Date;
  lastReviewDate: Date;
  totalAttempts: number;
  successfulAttempts: number;
}

// Query-Aware Boosting을 위한 쿼리 의도
export type QueryIntent =
  | 'RECALL_MISTAKES'    // "내가 틀린 거 뭐야?"
  | 'FIND_PATTERNS'      // "나한테 맞는 방법은?"
  | 'CHECK_PROGRESS'     // "어디까지 했지?"
  | 'REVIEW_DECISIONS'   // "뭘 결정했더라?"
  | 'GENERAL_SEARCH';    // 일반 검색

// 6-Factor Re-Ranking 가중치
export interface ReRankingWeights {
  semanticSimilarity: number;  // 0.45
  recency: number;             // 0.10
  confidence: number;          // 0.10
  typeBoost: number;           // 0.15
  subjectMatch: number;        // 0.10
  urgencyBoost: number;        // 0.10
}

// Memory Retrieval 결과
export interface RetrievedMemory extends LearningMemory {
  retrievalScore: number;      // 최종 점수 (0-1)
  scoreBreakdown: {
    semantic: number;
    recency: number;
    confidence: number;
    typeBoost: number;
    subjectMatch: number;
    urgency: number;
  };
}

// 번아웃 모니터링
export interface BurnoutIndicator {
  studentId: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  recentEmotions: Array<{
    emotion: Emotion;
    timestamp: Date;
  }>;
  warningSignals: string[];
  suggestedCopingStrategies: string[];
  lastAssessedAt: Date;
}

// Memory Extraction Request
export interface MemoryExtractionRequest {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  currentSubject?: Subject;
  studentContext?: {
    currentEmotion?: Emotion;
    recentTopics?: string[];
  };
}

// Memory Context Injection
export interface MemoryContext {
  relevantMemories: RetrievedMemory[];
  masteryInfo: TopicMastery[];
  burnoutStatus?: BurnoutIndicator;
  reviewDue: TopicMastery[];  // 복습 필요한 토픽
}

// ===================== 플랜 진화 시스템 타입 =====================

/**
 * 플랜 성과 기록 (진화 학습용)
 * - 플랜 생성 후 실제 수행 결과를 기록
 * - 다음 플랜 생성 시 학습 데이터로 활용
 */
export interface PlanPerformanceMemory {
  id: string;
  type: 'PLAN_PERFORMANCE';
  studentId: string;
  planId: string;

  // 플랜 특성
  subject: Subject;
  materialName: string;
  totalDays: number;
  dailyMinutes: number;
  totalUnits: number;

  // 성과 지표
  completionRate: number;       // 완료율 (0-1)
  averageQuestSuccess: number;  // 퀘스트 성공률 (0-1)
  averageStudyTime: number;     // 실제 평균 학습 시간 (분)
  dropOffDay?: number;          // 이탈 시점 (일차)
  streakDays: number;           // 연속 학습 일수

  // 학생 피드백
  studentRating?: number;       // 학생 평가 (1-5)
  studentFeedback?: string;     // 학생 코멘트
  difficultyPerception: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' | 'UNKNOWN';

  // 메타데이터
  createdAt: Date;
  completedAt?: Date;
  metadata?: {
    unitCompletionRates?: Record<number, number>;  // 단원별 완료율
    weeklyProgressPattern?: number[];  // 주차별 진행률
    peakStudyHour?: number;  // 가장 학습 많이 한 시간대
  };
}

/**
 * 리뷰 패턴 기록 (리뷰어 진화용)
 * - 플랜 리뷰 시 발견한 문제점과 개선 결과 기록
 * - 비슷한 플랜 리뷰 시 학습된 패턴 활용
 */
export interface ReviewPatternMemory {
  id: string;
  type: 'REVIEW_PATTERN';

  // 패턴 식별
  patternId: string;
  patternName: string;
  description: string;

  // 감지 조건
  triggerConditions: {
    planDuration?: { min?: number; max?: number };
    dailyMinutes?: { min?: number; max?: number };
    subject?: Subject[];
    unitCount?: { min?: number; max?: number };
  };

  // 문제와 해결책
  issueDescription: string;
  suggestedFix: string;
  successfulFixCount: number;
  failedFixCount: number;

  // 신뢰도
  confidence: number;  // 0-1, 검증된 정도
  validationScore: number;  // 실제 효과 점수

  // 메타데이터
  createdAt: Date;
  lastUsedAt: Date;
  usageCount: number;
}

/**
 * 학습된 최적값 (개인화용)
 */
export interface LearnedOptimalValues {
  studentId: string;
  subject: Subject;

  // 학습된 최적값
  optimalDailyMinutes: number;
  optimalSessionLength: number;  // 한 세션 권장 길이
  preferredStudyHour: number;    // 선호 학습 시간대

  // 위험 패턴
  dropOffRiskDays: number[];     // 이탈 위험 높은 일차
  fatigueThreshold: number;      // 피로 임계값 (연속 학습 분)

  // 신뢰도
  dataPoints: number;            // 학습에 사용된 데이터 수
  lastUpdated: Date;
}

/**
 * 분석된 단원 정보 (이미지 분석 결과)
 */
export interface AnalyzedUnit {
  unitNumber: number;
  unitTitle: string;
  subSections: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 감지된 학습계획표 일정
 */
export interface DetectedScheduleItem {
  day: number;
  unitNumber: number;
  unitTitle: string;
  range: string;
  topics?: string[];
  pages?: string;
  estimatedMinutes?: number;
  objectives?: string[];
  notes?: string;
}

/**
 * 감지된 학습계획표
 */
export interface DetectedStudyPlan {
  hasSchedule: boolean;
  totalDays: number;
  scheduleItems: DetectedScheduleItem[];
  source: string;
  weeklyStructure?: string;
  dailyTimeGuide?: string;
}

/**
 * AI 생성 퀘스트
 */
export interface AIGeneratedQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  topics?: string[];
  pages?: string;
  objectives?: string[];
}

/**
 * 생성된 플랜
 */
export interface GeneratedPlan {
  planType: 'original' | 'custom';
  planName: string;
  description: string;
  dailyQuests: AIGeneratedQuest[];
  totalDays: number;
  totalEstimatedHours: number;
}

/**
 * AI 플랜 리뷰 결과
 */
export interface PlanReview {
  overallScore: number;  // 1-10
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  riskAssessment: {
    burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    dropOffRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overloadDays: number[];
  };
  coachMessage: string;
}
