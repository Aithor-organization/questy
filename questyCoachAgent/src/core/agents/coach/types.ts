/**
 * CoachAgent 타입 정의
 */

// 오늘의 학습 현황 인터페이스
export interface TodayStudyStatus {
  completedQuests: number;
  totalQuests: number;
  completedMinutes: number;
  remainingQuests: string[];
  streak: number;
}

// 미학습 상황 인터페이스
export interface MissedStudyContext {
  missedDays: number;
  lastStudyDate: string | null;
  missedQuests: string[];
  suggestedReschedule: boolean;
}

// 학생 상태
export interface StudentState {
  needsMotivation: boolean;
  isConfused: boolean;
  isConfident: boolean;
  emotion: string;
  burnoutLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// 응답 유형
export type ResponseType =
  | 'EMOTIONAL_SUPPORT'
  | 'MOTIVATION'
  | 'EXPLANATION'
  | 'PROBLEM_SOLVING'
  | 'FEEDBACK'
  | 'GENERAL'
  | 'EVENING_REVIEW'
  | 'MISSED_STUDY'
  | 'CRISIS_INTERVENTION';
