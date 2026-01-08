/**
 * Agent Type Definitions
 * AI Coach 에이전트 관련 타입 정의
 */

import type { Subject, Emotion, MemoryContext } from './memory.js';
import type { TodayQuests, QuestStats } from './quest.js';
import type { DelayAnalysis } from '../quest/schedule-delay-handler.js';
import type { RescheduleOption } from '../quest/schedule-modifier.js';

// 에이전트 유형
export type AgentRole =
  | 'DIRECTOR'    // 오케스트레이터
  | 'ADMISSION'   // 입학 상담
  | 'PLANNER'     // 학습 계획
  | 'COACH'       // 학습 코칭
  | 'ANALYST';    // 학습 분석

// 의도 분류 결과
export type IntentCategory =
  | 'ENROLLMENT'      // 등록 관련
  | 'STUDY_PLAN'      // 학습 계획
  | 'QUESTION'        // 질문/학습
  | 'PROGRESS'        // 진도 확인
  | 'MOTIVATION'      // 동기부여
  | 'EMOTIONAL'       // 감정 지원
  | 'FEEDBACK'        // 피드백
  | 'ADMIN'           // 관리
  | 'SCHEDULE_CHANGE'; // 일정 변경

// 라우팅 결정
export interface RouteDecision {
  targetAgent: AgentRole;
  confidence: number;
  intent: IntentCategory;
  reasoning?: string;
}

// 학생 프로필
export interface StudentProfile {
  id: string;
  name: string;
  grade: string;               // 학년
  targetExam?: string;         // 목표 시험
  enrolledSubjects: Subject[];
  learningStyle?: LearningStyle;
  preferredStudyTime?: string;
  goals: string[];
  createdAt: Date;
  lastActiveAt: Date;
}

// 학습 스타일
export interface LearningStyle {
  preferredPace: 'SLOW' | 'MEDIUM' | 'FAST';
  visualLearner: boolean;
  needsRepetition: boolean;
  prefersChallenges: boolean;
  attentionSpan: 'SHORT' | 'MEDIUM' | 'LONG';
}

// 학습 계획
export interface StudyPlan {
  id: string;
  studentId: string;
  textbookId: string;
  subject: Subject;
  title: string;
  totalSessions: number;
  completedSessions: number;
  startDate: Date;
  targetEndDate: Date;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  sessions: StudySession[];
}

// 학습 세션
export interface StudySession {
  id: string;
  planId: string;
  order: number;
  topic: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedAt?: Date;
  notes?: string;
}

// 에이전트 요청
export interface AgentRequest {
  studentId: string;
  message: string;
  conversationId: string;
  metadata?: {
    currentSubject?: Subject;
    currentPlanId?: string;
    currentSessionId?: string;
    emotion?: Emotion;
    // Admission 관련 메타데이터
    stage?: string;
    extractedInfo?: {
      name?: string;
      grade?: string;
      subjects?: string[];
      goals?: string[];
    };
    currentInfo?: {
      name?: string;
      grade?: string;
      subjects?: string[];
      goals?: string[];
    };
  };
}

// 에이전트 응답
export interface AgentResponse {
  agentRole: AgentRole;
  message: string;
  actions?: AgentAction[];
  memoryExtracted?: boolean;
  suggestedFollowUp?: string[];
  // 일정 변경 옵션 (코치 채팅용)
  rescheduleOptions?: RescheduleOption[];
}

// 에이전트 액션
export interface AgentAction {
  type: 'CREATE_PLAN' | 'UPDATE_PROGRESS' | 'SEND_NOTIFICATION' | 'SCHEDULE_REVIEW';
  payload: Record<string, unknown>;
}

// Director 컨텍스트
export interface DirectorContext {
  studentProfile: StudentProfile;
  activePlans: StudyPlan[];
  memoryContext: MemoryContext;
  recentConversations: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  // 퀘스트 컨텍스트 (코치 대화용)
  todayQuests?: TodayQuests;
  delayAnalysis?: DelayAnalysis;
  questStats?: QuestStats;
}

// 모델 설정
export type ModelId =
  | 'gpt-5-nano'        // 의도 분류
  | 'claude-4.5-haiku'  // 코칭
  | 'gemini-3-flash';   // 분석

export interface ModelConfig {
  id: ModelId;
  provider: 'openai' | 'anthropic' | 'google';
  maxTokens: number;
  temperature: number;
  purpose: string;
}

// 에이전트 인터페이스
export interface IAgent {
  role: AgentRole;
  process(request: AgentRequest, context: DirectorContext): Promise<AgentResponse>;
}
