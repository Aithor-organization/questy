/**
 * Quest Type Definitions
 * 일일 퀘스트 및 학습 미션 관련 타입
 */

import type { Subject } from './memory.js';

// 퀘스트 타입
export type QuestType =
  | 'STUDY'          // 학습 퀘스트
  | 'REVIEW'         // 복습 퀘스트
  | 'PRACTICE'       // 연습 문제
  | 'CHALLENGE'      // 도전 과제
  | 'STREAK'         // 연속 학습
  | 'MILESTONE';     // 마일스톤 달성

// 퀘스트 상태
export type QuestStatus =
  | 'LOCKED'         // 잠김 (선행 조건 미충족)
  | 'AVAILABLE'      // 수행 가능
  | 'IN_PROGRESS'    // 진행 중
  | 'COMPLETED'      // 완료
  | 'EXPIRED';       // 만료

// 퀘스트 난이도
export type QuestDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

// 일일 퀘스트
export interface DailyQuest {
  id: string;
  studentId: string;
  date: Date;               // 퀘스트 날짜
  type: QuestType;
  title: string;
  description: string;
  subject: Subject;
  planId?: string;          // 연관된 학습 계획
  sessionId?: string;       // 연관된 세션
  topicId?: string;         // 연관된 토픽

  // 목표 및 진행
  targetValue: number;      // 목표치 (분, 문제수, 페이지 등)
  currentValue: number;     // 현재 진행치
  unit: string;             // 단위 (분, 문제, 페이지)

  // 상태
  status: QuestStatus;
  difficulty: QuestDifficulty;
  priority: number;         // 1(높음) - 5(낮음)

  // 보상
  xpReward: number;
  badgeId?: string;
  streakBonus?: number;

  // 시간
  estimatedMinutes: number;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;

  // 메타데이터
  prerequisites?: string[]; // 선행 퀘스트 ID
  tags: string[];
}

// 오늘의 퀘스트 목록
export interface TodayQuests {
  studentId: string;
  date: Date;

  // 메인 퀘스트 (필수)
  mainQuests: DailyQuest[];

  // 보너스 퀘스트 (선택)
  bonusQuests: DailyQuest[];

  // 복습 퀘스트 (SM-2 기반)
  reviewQuests: DailyQuest[];

  // 요약 통계
  summary: QuestSummary;

  // 개인화 메시지
  dailyMessage: string;
  coachTip: string;

  // 생성 정보
  generatedAt: Date;
  generatedBy: 'SYSTEM' | 'PLANNER' | 'COACH';
}

// 퀘스트 요약
export interface QuestSummary {
  totalQuests: number;
  completedQuests: number;
  inProgressQuests: number;
  availableQuests: number;

  totalXpAvailable: number;
  earnedXp: number;

  estimatedTotalMinutes: number;
  actualSpentMinutes: number;

  streakDays: number;
  isStreakActive: boolean;

  completionRate: number;  // 0-1
}

// 퀘스트 진행 업데이트
export interface QuestProgressUpdate {
  questId: string;
  studentId: string;
  progressDelta: number;   // 증가량
  timestamp: Date;
  source: 'USER' | 'SYSTEM' | 'COACH';
  notes?: string;
}

// 퀘스트 완료 결과
export interface QuestCompletionResult {
  quest: DailyQuest;
  earnedXp: number;
  earnedBadge?: Badge;
  streakBonus?: number;
  unlockedQuests: string[];
  nextRecommendedQuest?: DailyQuest;
  celebrationMessage: string;
}

// 배지
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'ACHIEVEMENT' | 'STREAK' | 'MASTERY' | 'SPECIAL';
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  earnedAt?: Date;
  criteria: string;
}

// 퀘스트 생성 요청
export interface QuestGenerationRequest {
  studentId: string;
  date: Date;
  activePlans: string[];   // 활성 학습 계획 ID들
  reviewTopics: string[];  // 복습 필요 토픽 ID들
  preferences?: {
    maxQuests?: number;
    maxMinutes?: number;
    focusSubjects?: Subject[];
    excludeTypes?: QuestType[];
  };
}

// 퀘스트 필터
export interface QuestFilter {
  studentId: string;
  dateRange?: { from: Date; to: Date };
  status?: QuestStatus[];
  type?: QuestType[];
  subject?: Subject[];
  planId?: string;
}

// 퀘스트 통계
export interface QuestStats {
  studentId: string;
  period: 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

  totalQuests: number;
  completedQuests: number;
  completionRate: number;

  totalXpEarned: number;
  badgesEarned: number;

  longestStreak: number;
  currentStreak: number;

  averageCompletionTime: number;  // 분
  mostActiveHour: number;         // 0-23

  favoriteSubject: Subject;
  strongestType: QuestType;
  weakestType: QuestType;

  bySubject: Record<Subject, {
    total: number;
    completed: number;
    xpEarned: number;
  }>;

  byType: Record<QuestType, {
    total: number;
    completed: number;
    avgTime: number;
  }>;
}
