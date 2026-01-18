/**
 * 컨텍스트 빌더 유틸리티
 */

import type { DirectorContext, Subject } from '../../../../types/agent.js';
import type { TopicMastery } from '../../../../types/memory.js';
import type { TodayQuests, DailyQuest } from '../../../../types/quest.js';
import type { FrontendQuestContext, SupervisorConfig } from '../types.js';
import type { MemoryLane } from '../../../../memory/index.js';
import type { StudentRegistry } from '../../../../registry/index.js';
import type { QuestTracker, ScheduleDelayHandler } from '../../../../quest/index.js';

/**
 * 프론트엔드 questContext를 TodayQuests 형식으로 변환
 */
export function convertFrontendQuestContext(
  studentId: string,
  frontendContext: FrontendQuestContext
): TodayQuests {
  const now = new Date();
  const quests = frontendContext.todayQuests ?? [];

  // 프론트엔드 퀘스트를 DailyQuest 형식으로 변환
  const mainQuests: DailyQuest[] = quests.map((q, idx) => {
    const estimatedMins = q.estimatedMinutes ?? 30;
    const isCompleted = q.completed ?? false;
    return {
      id: `frontend-quest-${idx}-${Date.now()}`,
      studentId,
      date: now,
      type: 'STUDY' as const,
      title: q.unitTitle,
      description: q.range,
      subject: 'GENERAL' as const,
      planId: q.planId,
      targetValue: estimatedMins,
      currentValue: isCompleted ? estimatedMins : 0,
      unit: '분',
      status: isCompleted ? 'COMPLETED' as const : 'AVAILABLE' as const,
      difficulty: 'MEDIUM' as const,
      priority: 1,
      xpReward: 100,
      estimatedMinutes: estimatedMins,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      tags: q.planName ? [q.planName] : [],
      ...(q.day !== undefined && { day: q.day }),
    };
  });

  return {
    studentId,
    date: now,
    mainQuests,
    bonusQuests: [],
    reviewQuests: [],
    summary: {
      totalQuests: quests.length,
      completedQuests: frontendContext.completedToday ?? quests.filter(q => q.completed === true).length,
      inProgressQuests: 0,
      availableQuests: quests.filter(q => q.completed !== true).length,
      totalXpAvailable: quests.length * 100,
      earnedXp: (frontendContext.completedToday ?? 0) * 100,
      estimatedTotalMinutes: quests.reduce((sum, q) => sum + (q.estimatedMinutes ?? 30), 0),
      actualSpentMinutes: 0,
      streakDays: 0,
      isStreakActive: false,
      completionRate: frontendContext.completedToday && frontendContext.totalToday
        ? frontendContext.completedToday / frontendContext.totalToday
        : 0,
    },
    dailyMessage: '오늘도 화이팅!',
    coachTip: '',
    generatedAt: now,
    generatedBy: 'SYSTEM',
  };
}

// 학습 프로필 타입
interface UserProfile {
  age?: number | null;
  examYear?: number;
  targetUniversity?: string;
  targetGrades?: Record<string, number>;
  currentGrades?: Record<string, number>;
  selectedTamgu1?: string;
  selectedTamgu2?: string;
  subscribedPlatforms?: string[];
  dailyStudyHours?: number;
}

/**
 * 컨텍스트 구성
 */
export async function buildContext(
  studentId: string,
  query: string,
  currentSubject: Subject | undefined,
  frontendQuestContext: FrontendQuestContext | undefined,
  config: SupervisorConfig,
  studentRegistry: StudentRegistry,
  memoryLane: MemoryLane,
  questTracker: QuestTracker,
  scheduleDelayHandler: ScheduleDelayHandler,
  conversationHistory?: DirectorContext['recentConversations'],
  userProfile?: UserProfile  // 학습 프로필 (온보딩에서 수집한 정보)
): Promise<DirectorContext> {
  // 학생 프로필
  const studentProfile = studentRegistry.getStudent(studentId) ??
    studentRegistry.createStudent({ name: '학생' });

  // 활성 학습 계획
  const activePlans = studentRegistry.getActivePlans(studentId);

  // 메모리 컨텍스트
  const memoryContext = await memoryLane.retrieveContext({
    studentId,
    query,
    currentSubject: currentSubject ?? config.defaultSubject,
  });

  // 최근 대화 기록 (전달받은 기록 사용)
  const recentConversations: DirectorContext['recentConversations'] = conversationHistory ?? [];

  // 퀘스트 컨텍스트
  let todayQuests = questTracker.getTodayQuests(studentId);

  // 프론트엔드 questContext가 있고 내부 tracker가 비어있으면 변환하여 사용
  if (!todayQuests && frontendQuestContext?.todayQuests && frontendQuestContext.todayQuests.length > 0) {
    console.log(`[Supervisor] Using frontend questContext: ${frontendQuestContext.todayQuests.length} quests`);
    todayQuests = convertFrontendQuestContext(studentId, frontendQuestContext);
  }

  const delayAnalysis = scheduleDelayHandler.analyzeDelays(studentId, todayQuests);
  const questStats = questTracker.getStats(studentId, 'WEEK');

  // 전체 일정 컨텍스트 추출
  const fullScheduleContext = frontendQuestContext ? {
    activePlans: frontendQuestContext.activePlans,
    upcomingQuests: frontendQuestContext.upcomingQuests,
    weeklyStats: frontendQuestContext.weeklyStats,
  } : undefined;

  if (fullScheduleContext?.activePlans?.length) {
    console.log(`[Supervisor] Full schedule: ${fullScheduleContext.activePlans.length} active plans`);
  }
  if (fullScheduleContext?.upcomingQuests?.length) {
    console.log(`[Supervisor] Upcoming quests: ${fullScheduleContext.upcomingQuests.length} days scheduled`);
  }

  // userProfile 로그
  if (userProfile?.targetUniversity) {
    console.log(`[Supervisor] User profile: 목표대학=${userProfile.targetUniversity}`);
  }

  return {
    studentProfile,
    activePlans,
    memoryContext,
    recentConversations,
    todayQuests: todayQuests ?? undefined,
    delayAnalysis,
    questStats,
    fullScheduleContext,
    userProfile,  // 학습 프로필 (온보딩에서 수집한 정보)
  };
}
