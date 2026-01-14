/**
 * Supervisor 타입 정의
 */

import type { AgentRole } from '../../../types/agent.js';
import type { Subject } from '../../../types/memory.js';

// Supervisor 설정
export interface SupervisorConfig {
  enableMemoryExtraction: boolean;
  enableBurnoutCheck: boolean;
  enableQuestSystem: boolean;
  defaultSubject: Subject;
  maxConcurrentAgents: number;
}

export const DEFAULT_CONFIG: SupervisorConfig = {
  enableMemoryExtraction: true,
  enableBurnoutCheck: true,
  enableQuestSystem: true,
  defaultSubject: 'GENERAL',
  maxConcurrentAgents: 3,
};

// 실행 상태 추적
export interface ExecutionState {
  conversationId: string;
  studentId: string;
  activeAgent: AgentRole;
  executionPath: Array<{
    agent: AgentRole;
    timestamp: Date;
    duration?: number;
  }>;
  turnCount: number;
}

// 프론트엔드 퀘스트 컨텍스트
export interface FrontendQuestContext {
  todayQuests?: Array<{
    unitTitle: string;
    range: string;
    completed?: boolean;
    estimatedMinutes?: number;
    planName?: string;
    planId?: string;
    day?: number;
  }>;
  activePlans?: Array<{
    id: string;
    title: string;
    textbookTitle?: string;
    subject?: string;
    totalDays: number;
    completedDays: number;
    startDate: string;
    targetEndDate: string;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    dailyQuests?: Array<{
      day: number;
      date: string;
      unitTitle: string;
      range: string;
      completed: boolean;
      estimatedMinutes?: number;
    }>;
  }>;
  upcomingQuests?: Array<{
    date: string;
    quests: Array<{
      planId: string;
      planTitle: string;
      day: number;
      unitTitle: string;
      range: string;
      estimatedMinutes?: number;
    }>;
  }>;
  weeklyStats?: {
    totalQuests: number;
    completedQuests: number;
    completionRate: number;
    streakDays: number;
    averageMinutesPerDay: number;
  };
  plansCount?: number;
  completedToday?: number;
  totalToday?: number;
}
