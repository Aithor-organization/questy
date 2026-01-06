/**
 * QuestGenerator
 * 일일 퀘스트 생성기
 * - 학습 계획 기반 메인 퀘스트
 * - SM-2 복습 퀘스트
 * - 개인화된 보너스 퀘스트
 */

import type {
  DailyQuest,
  TodayQuests,
  QuestGenerationRequest,
  QuestSummary,
  QuestType,
  QuestStatus,
  QuestDifficulty,
} from '../types/quest.js';
import type { StudyPlan, StudySession, StudentProfile } from '../types/agent.js';
import type { TopicMastery, Subject } from '../types/memory.js';

export interface QuestGeneratorConfig {
  defaultMaxQuests: number;
  defaultMaxMinutes: number;
  reviewQuestPriority: number;
  streakBonusMultiplier: number;
}

const DEFAULT_CONFIG: QuestGeneratorConfig = {
  defaultMaxQuests: 5,
  defaultMaxMinutes: 120,
  reviewQuestPriority: 2,
  streakBonusMultiplier: 1.5,
};

// 난이도별 XP 보상
const XP_BY_DIFFICULTY: Record<QuestDifficulty, number> = {
  EASY: 10,
  MEDIUM: 25,
  HARD: 50,
  EXTREME: 100,
};

export class QuestGenerator {
  private config: QuestGeneratorConfig;

  constructor(config: Partial<QuestGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 오늘의 퀘스트 생성
   */
  async generateTodayQuests(params: {
    request: QuestGenerationRequest;
    studentProfile: StudentProfile;
    activePlans: StudyPlan[];
    reviewDueTopics: TopicMastery[];
    currentStreak: number;
  }): Promise<TodayQuests> {
    const { request, studentProfile, activePlans, reviewDueTopics, currentStreak } = params;
    const { date, preferences } = request;

    const maxQuests = preferences?.maxQuests ?? this.config.defaultMaxQuests;
    const maxMinutes = preferences?.maxMinutes ?? this.config.defaultMaxMinutes;

    // 1. 메인 퀘스트 생성 (학습 계획 기반)
    const mainQuests = this.generateMainQuests({
      studentId: request.studentId,
      date,
      activePlans,
      maxQuests: Math.ceil(maxQuests * 0.6), // 60% 메인
      maxMinutes: Math.ceil(maxMinutes * 0.6),
      focusSubjects: preferences?.focusSubjects,
    });

    // 2. 복습 퀘스트 생성 (SM-2 기반)
    const reviewQuests = this.generateReviewQuests({
      studentId: request.studentId,
      date,
      reviewTopics: reviewDueTopics,
      maxQuests: Math.ceil(maxQuests * 0.3), // 30% 복습
    });

    // 3. 보너스 퀘스트 생성
    const bonusQuests = this.generateBonusQuests({
      studentId: request.studentId,
      date,
      studentProfile,
      currentStreak,
      maxQuests: Math.ceil(maxQuests * 0.1), // 10% 보너스
      excludeTypes: preferences?.excludeTypes,
    });

    // 4. 요약 계산
    const allQuests = [...mainQuests, ...reviewQuests, ...bonusQuests];
    const summary = this.calculateSummary(allQuests, currentStreak);

    // 5. 개인화 메시지 생성
    const dailyMessage = this.generateDailyMessage(studentProfile, currentStreak, summary);
    const coachTip = this.generateCoachTip(studentProfile, activePlans, reviewDueTopics);

    return {
      studentId: request.studentId,
      date,
      mainQuests,
      bonusQuests,
      reviewQuests,
      summary,
      dailyMessage,
      coachTip,
      generatedAt: new Date(),
      generatedBy: 'SYSTEM',
    };
  }

  /**
   * 메인 퀘스트 생성
   */
  private generateMainQuests(params: {
    studentId: string;
    date: Date;
    activePlans: StudyPlan[];
    maxQuests: number;
    maxMinutes: number;
    focusSubjects?: Subject[];
  }): DailyQuest[] {
    const { studentId, date, activePlans, maxQuests, maxMinutes, focusSubjects } = params;
    const quests: DailyQuest[] = [];
    let totalMinutes = 0;

    // 활성 계획에서 다음 세션 추출
    const pendingSessions: Array<{ plan: StudyPlan; session: StudySession }> = [];

    for (const plan of activePlans) {
      if (focusSubjects && !focusSubjects.includes(plan.subject)) continue;

      const nextSession = plan.sessions.find(s => s.status === 'PENDING');
      if (nextSession) {
        pendingSessions.push({ plan, session: nextSession });
      }
    }

    // 우선순위 정렬 (마감일 가까운 순)
    pendingSessions.sort((a, b) =>
      a.plan.targetEndDate.getTime() - b.plan.targetEndDate.getTime()
    );

    // 퀘스트 생성
    for (const { plan, session } of pendingSessions) {
      if (quests.length >= maxQuests) break;
      if (totalMinutes + session.estimatedMinutes > maxMinutes) continue;

      const quest = this.createStudyQuest({
        studentId,
        date,
        plan,
        session,
        priority: quests.length + 1,
      });

      quests.push(quest);
      totalMinutes += session.estimatedMinutes;
    }

    return quests;
  }

  /**
   * 복습 퀘스트 생성
   */
  private generateReviewQuests(params: {
    studentId: string;
    date: Date;
    reviewTopics: TopicMastery[];
    maxQuests: number;
  }): DailyQuest[] {
    const { studentId, date, reviewTopics, maxQuests } = params;
    const quests: DailyQuest[] = [];

    // 우선순위: overdue + low mastery
    const sortedTopics = [...reviewTopics].sort((a, b) => {
      const aOverdue = this.isOverdue(a.nextReviewDate);
      const bOverdue = this.isOverdue(b.nextReviewDate);

      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return a.masteryScore - b.masteryScore;
    });

    for (const topic of sortedTopics) {
      if (quests.length >= maxQuests) break;

      const quest: DailyQuest = {
        id: `review-${studentId}-${date.toISOString().split('T')[0]}-${quests.length}`,
        studentId,
        date,
        type: 'REVIEW',
        title: `📚 복습: ${topic.topicId}`,
        description: `이전에 배운 내용을 복습해요. 기억을 강화하면 오래 남아요!`,
        subject: topic.subject,
        topicId: topic.topicId,
        targetValue: 1,
        currentValue: 0,
        unit: '회',
        status: 'AVAILABLE',
        difficulty: this.getMasteryDifficulty(topic.masteryScore),
        priority: this.config.reviewQuestPriority,
        xpReward: XP_BY_DIFFICULTY[this.getMasteryDifficulty(topic.masteryScore)],
        estimatedMinutes: 15,
        expiresAt: this.getEndOfDay(date),
        tags: ['review', 'spaced-repetition'],
      };

      quests.push(quest);
    }

    return quests;
  }

  /**
   * 보너스 퀘스트 생성
   */
  private generateBonusQuests(params: {
    studentId: string;
    date: Date;
    studentProfile: StudentProfile;
    currentStreak: number;
    maxQuests: number;
    excludeTypes?: QuestType[];
  }): DailyQuest[] {
    const { studentId, date, currentStreak, maxQuests, excludeTypes } = params;
    const quests: DailyQuest[] = [];

    // 연속 학습 보너스
    if (currentStreak >= 3 && !excludeTypes?.includes('STREAK')) {
      const streakQuest: DailyQuest = {
        id: `streak-${studentId}-${date.toISOString().split('T')[0]}`,
        studentId,
        date,
        type: 'STREAK',
        title: `🔥 ${currentStreak + 1}일 연속 학습 도전!`,
        description: `오늘도 학습을 완료하면 ${currentStreak + 1}일 연속 달성! 보너스 XP를 획득하세요.`,
        subject: 'GENERAL',
        targetValue: 1,
        currentValue: 0,
        unit: '일',
        status: 'AVAILABLE',
        difficulty: currentStreak >= 7 ? 'HARD' : currentStreak >= 3 ? 'MEDIUM' : 'EASY',
        priority: 3,
        xpReward: Math.floor(currentStreak * 10 * this.config.streakBonusMultiplier),
        streakBonus: Math.floor(currentStreak * 5),
        estimatedMinutes: 0, // 메인 퀘스트 완료 시 자동 달성
        expiresAt: this.getEndOfDay(date),
        tags: ['streak', 'bonus'],
      };
      quests.push(streakQuest);
    }

    // 마일스톤 체크
    if (quests.length < maxQuests && !excludeTypes?.includes('MILESTONE')) {
      // 마일스톤 퀘스트 로직 (생략 - 확장 가능)
    }

    return quests;
  }

  /**
   * 학습 퀘스트 생성 헬퍼
   */
  private createStudyQuest(params: {
    studentId: string;
    date: Date;
    plan: StudyPlan;
    session: StudySession;
    priority: number;
  }): DailyQuest {
    const { studentId, date, plan, session, priority } = params;

    return {
      id: `study-${studentId}-${date.toISOString().split('T')[0]}-${session.id}`,
      studentId,
      date,
      type: 'STUDY',
      title: `📖 ${session.topic}`,
      description: `${plan.title}의 ${session.order}번째 학습입니다.`,
      subject: plan.subject,
      planId: plan.id,
      sessionId: session.id,
      topicId: session.topic,
      targetValue: session.estimatedMinutes,
      currentValue: 0,
      unit: '분',
      status: 'AVAILABLE',
      difficulty: this.getSessionDifficulty(session, plan),
      priority,
      xpReward: this.calculateSessionXP(session),
      estimatedMinutes: session.estimatedMinutes,
      expiresAt: this.getEndOfDay(date),
      tags: ['study', plan.subject.toLowerCase()],
    };
  }

  /**
   * 요약 계산
   */
  private calculateSummary(quests: DailyQuest[], currentStreak: number): QuestSummary {
    const completed = quests.filter(q => q.status === 'COMPLETED');
    const inProgress = quests.filter(q => q.status === 'IN_PROGRESS');
    const available = quests.filter(q => q.status === 'AVAILABLE');

    return {
      totalQuests: quests.length,
      completedQuests: completed.length,
      inProgressQuests: inProgress.length,
      availableQuests: available.length,
      totalXpAvailable: quests.reduce((sum, q) => sum + q.xpReward, 0),
      earnedXp: completed.reduce((sum, q) => sum + q.xpReward, 0),
      estimatedTotalMinutes: quests.reduce((sum, q) => sum + q.estimatedMinutes, 0),
      actualSpentMinutes: 0, // 진행 중 업데이트
      streakDays: currentStreak,
      isStreakActive: currentStreak > 0,
      completionRate: quests.length > 0 ? completed.length / quests.length : 0,
    };
  }

  /**
   * 일일 메시지 생성
   */
  private generateDailyMessage(
    profile: StudentProfile,
    streak: number,
    summary: QuestSummary
  ): string {
    const name = profile.name || '학생';
    const hour = new Date().getHours();

    let greeting: string;
    if (hour < 12) greeting = '좋은 아침이에요';
    else if (hour < 18) greeting = '좋은 오후예요';
    else greeting = '좋은 저녁이에요';

    if (streak >= 7) {
      return `🎉 ${greeting}, ${name}! ${streak}일 연속 학습 중이에요! 대단해요! 오늘도 함께 달려봐요! 💪`;
    } else if (streak >= 3) {
      return `🔥 ${greeting}, ${name}! ${streak}일째 연속 학습 중! 이 기세를 유지해요!`;
    } else if (summary.totalQuests > 0) {
      return `${greeting}, ${name}! 오늘 ${summary.totalQuests}개의 퀘스트가 기다리고 있어요. 화이팅! 📚`;
    } else {
      return `${greeting}, ${name}! 오늘도 학습할 준비 되셨나요? 😊`;
    }
  }

  /**
   * 코치 팁 생성
   */
  private generateCoachTip(
    profile: StudentProfile,
    plans: StudyPlan[],
    reviewTopics: TopicMastery[]
  ): string {
    // 복습 필요한 토픽이 많으면
    if (reviewTopics.length >= 5) {
      return '💡 Tip: 오늘은 복습 퀘스트를 먼저 완료해보세요. 기억 강화에 최적의 시간이에요!';
    }

    // 마감일이 가까운 계획이 있으면
    const urgentPlan = plans.find(p => {
      const daysLeft = Math.ceil(
        (p.targetEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft <= 7 && p.completedSessions < p.totalSessions;
    });

    if (urgentPlan) {
      return `💡 Tip: "${urgentPlan.title}" 마감이 곧이에요. 오늘 조금 더 집중해볼까요?`;
    }

    // 기본 팁
    const tips = [
      '💡 Tip: 25분 집중 후 5분 휴식하는 뽀모도로 기법을 활용해보세요!',
      '💡 Tip: 어려운 퀘스트는 아침에, 쉬운 퀘스트는 저녁에 하면 효율적이에요.',
      '💡 Tip: 완료한 퀘스트를 체크하는 것만으로도 성취감이 올라가요!',
      '💡 Tip: 학습 전 간단한 스트레칭으로 집중력을 높여보세요.',
    ];

    return tips[Math.floor(Math.random() * tips.length)];
  }

  // 유틸리티 함수들

  private isOverdue(date?: Date): boolean {
    if (!date) return false;
    return date.getTime() < Date.now();
  }

  private getMasteryDifficulty(score: number): QuestDifficulty {
    if (score >= 0.8) return 'EASY';
    if (score >= 0.5) return 'MEDIUM';
    if (score >= 0.3) return 'HARD';
    return 'EXTREME';
  }

  private getSessionDifficulty(session: StudySession, plan: StudyPlan): QuestDifficulty {
    const progress = plan.completedSessions / plan.totalSessions;
    if (progress < 0.3) return 'EASY';
    if (progress < 0.6) return 'MEDIUM';
    if (progress < 0.9) return 'HARD';
    return 'EXTREME';
  }

  private calculateSessionXP(session: StudySession): number {
    const baseXP = 20;
    const timeBonus = Math.floor(session.estimatedMinutes / 10) * 5;
    return baseXP + timeBonus;
  }

  private getEndOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}
