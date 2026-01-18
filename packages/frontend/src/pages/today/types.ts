/**
 * TodayPage 관련 타입 정의
 */

import type { QuestWithPlan } from '../../stores/questStore';

export interface RescheduleModalState {
  isOpen: boolean;
  quest: QuestWithPlan | null;
  mode: 'single' | 'bulk';
}

export interface DailyCoachData {
  dailyMessage: string;
  coachTip: string;
  streak: number;
  missedDays?: number;
  needsIntervention?: boolean;
}

export interface EveningReviewData {
  summary: string;
  completedCount: number;
  totalCount: number;
  tomorrowPreview: string;
}

export interface OverduePlanGroup {
  planId: string;
  planName: string;
  quests: QuestWithPlan[];
}
