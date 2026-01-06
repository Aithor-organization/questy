/**
 * QuestTracker
 * 퀘스트 진행 상황 추적 및 완료 처리
 */

import type {
  DailyQuest,
  TodayQuests,
  QuestProgressUpdate,
  QuestCompletionResult,
  QuestStatus,
  QuestStats,
  QuestFilter,
  Badge,
} from '../types/quest.js';
import type { Subject } from '../types/memory.js';

export class QuestTracker {
  // In-memory 저장소 (실제로는 DB 사용)
  private questStore: Map<string, TodayQuests[]>;  // studentId → quests by date
  private completedQuests: Map<string, DailyQuest[]>;
  private streakStore: Map<string, number>;  // studentId → streak days
  private lastActiveDate: Map<string, Date>;
  private xpStore: Map<string, number>;
  private badgeStore: Map<string, Badge[]>;

  constructor() {
    this.questStore = new Map();
    this.completedQuests = new Map();
    this.streakStore = new Map();
    this.lastActiveDate = new Map();
    this.xpStore = new Map();
    this.badgeStore = new Map();
  }

  /**
   * 오늘의 퀘스트 저장
   */
  saveTodayQuests(quests: TodayQuests): void {
    const existing = this.questStore.get(quests.studentId) ?? [];

    // 같은 날짜 퀘스트가 있으면 업데이트
    const dateStr = quests.date.toISOString().split('T')[0];
    const idx = existing.findIndex(
      q => q.date.toISOString().split('T')[0] === dateStr
    );

    if (idx >= 0) {
      existing[idx] = quests;
    } else {
      existing.push(quests);
    }

    // 최근 30일만 유지
    if (existing.length > 30) {
      existing.shift();
    }

    this.questStore.set(quests.studentId, existing);
  }

  /**
   * 오늘의 퀘스트 조회
   */
  getTodayQuests(studentId: string, date?: Date): TodayQuests | null {
    const targetDate = date ?? new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const quests = this.questStore.get(studentId) ?? [];
    return quests.find(q => q.date.toISOString().split('T')[0] === dateStr) ?? null;
  }

  /**
   * 퀘스트 진행 업데이트
   */
  updateProgress(update: QuestProgressUpdate): DailyQuest | null {
    const { questId, studentId, progressDelta } = update;

    const todayQuests = this.getTodayQuests(studentId);
    if (!todayQuests) return null;

    // 모든 퀘스트에서 검색
    const allQuests = [
      ...todayQuests.mainQuests,
      ...todayQuests.reviewQuests,
      ...todayQuests.bonusQuests,
    ];

    const quest = allQuests.find(q => q.id === questId);
    if (!quest) return null;

    // 상태 업데이트
    quest.currentValue += progressDelta;

    if (quest.status === 'AVAILABLE') {
      quest.status = 'IN_PROGRESS';
      quest.startedAt = new Date();
    }

    // 완료 체크
    if (quest.currentValue >= quest.targetValue && quest.status !== 'COMPLETED') {
      quest.status = 'COMPLETED';
      quest.completedAt = new Date();
    }

    // 요약 재계산
    todayQuests.summary = this.recalculateSummary(todayQuests);

    return quest;
  }

  /**
   * 퀘스트 완료 처리
   */
  completeQuest(studentId: string, questId: string): QuestCompletionResult | null {
    const todayQuests = this.getTodayQuests(studentId);
    if (!todayQuests) return null;

    const allQuests = [
      ...todayQuests.mainQuests,
      ...todayQuests.reviewQuests,
      ...todayQuests.bonusQuests,
    ];

    const quest = allQuests.find(q => q.id === questId);
    if (!quest || quest.status === 'COMPLETED') return null;

    // 완료 처리
    quest.status = 'COMPLETED';
    quest.completedAt = new Date();
    quest.currentValue = quest.targetValue;

    // XP 적립
    const currentXp = this.xpStore.get(studentId) ?? 0;
    const totalXp = currentXp + quest.xpReward + (quest.streakBonus ?? 0);
    this.xpStore.set(studentId, totalXp);

    // 연속 학습 업데이트
    this.updateStreak(studentId);

    // 배지 체크
    const earnedBadge = this.checkBadgeEarned(studentId, quest);

    // 잠금 해제된 퀘스트 확인
    const unlockedQuests = this.checkUnlockedQuests(todayQuests, quest);

    // 요약 재계산
    todayQuests.summary = this.recalculateSummary(todayQuests);

    // 완료 기록
    const completed = this.completedQuests.get(studentId) ?? [];
    completed.push(quest);
    this.completedQuests.set(studentId, completed);

    // 다음 추천 퀘스트
    const nextQuest = allQuests.find(q => q.status === 'AVAILABLE');

    return {
      quest,
      earnedXp: quest.xpReward + (quest.streakBonus ?? 0),
      earnedBadge,
      streakBonus: quest.streakBonus,
      unlockedQuests: unlockedQuests.map(q => q.id),
      nextRecommendedQuest: nextQuest,
      celebrationMessage: this.generateCelebrationMessage(quest, earnedBadge),
    };
  }

  /**
   * 연속 학습 조회
   */
  getStreak(studentId: string): number {
    return this.streakStore.get(studentId) ?? 0;
  }

  /**
   * XP 조회
   */
  getXp(studentId: string): number {
    return this.xpStore.get(studentId) ?? 0;
  }

  /**
   * 배지 조회
   */
  getBadges(studentId: string): Badge[] {
    return this.badgeStore.get(studentId) ?? [];
  }

  /**
   * 퀘스트 통계 조회
   */
  getStats(studentId: string, period: 'DAY' | 'WEEK' | 'MONTH' | 'ALL'): QuestStats {
    const completed = this.completedQuests.get(studentId) ?? [];
    const now = new Date();

    // 기간 필터
    let filteredQuests: DailyQuest[];
    switch (period) {
      case 'DAY':
        filteredQuests = completed.filter(q =>
          this.isSameDay(q.completedAt ?? q.date, now)
        );
        break;
      case 'WEEK':
        filteredQuests = completed.filter(q =>
          this.isWithinDays(q.completedAt ?? q.date, now, 7)
        );
        break;
      case 'MONTH':
        filteredQuests = completed.filter(q =>
          this.isWithinDays(q.completedAt ?? q.date, now, 30)
        );
        break;
      default:
        filteredQuests = completed;
    }

    // 통계 계산
    const bySubject: Record<string, { total: number; completed: number; xpEarned: number }> = {};
    const byType: Record<string, { total: number; completed: number; avgTime: number }> = {};

    for (const quest of filteredQuests) {
      // Subject 통계
      if (!bySubject[quest.subject]) {
        bySubject[quest.subject] = { total: 0, completed: 0, xpEarned: 0 };
      }
      bySubject[quest.subject].total++;
      if (quest.status === 'COMPLETED') {
        bySubject[quest.subject].completed++;
        bySubject[quest.subject].xpEarned += quest.xpReward;
      }

      // Type 통계
      if (!byType[quest.type]) {
        byType[quest.type] = { total: 0, completed: 0, avgTime: 0 };
      }
      byType[quest.type].total++;
      if (quest.status === 'COMPLETED') {
        byType[quest.type].completed++;
      }
    }

    const totalCompleted = filteredQuests.filter(q => q.status === 'COMPLETED').length;
    const totalXp = filteredQuests.reduce((sum, q) =>
      q.status === 'COMPLETED' ? sum + q.xpReward : sum, 0
    );

    return {
      studentId,
      period,
      totalQuests: filteredQuests.length,
      completedQuests: totalCompleted,
      completionRate: filteredQuests.length > 0 ? totalCompleted / filteredQuests.length : 0,
      totalXpEarned: totalXp,
      badgesEarned: this.getBadges(studentId).length,
      longestStreak: this.calculateLongestStreak(studentId),
      currentStreak: this.getStreak(studentId),
      averageCompletionTime: this.calculateAvgTime(filteredQuests),
      mostActiveHour: this.calculateMostActiveHour(filteredQuests),
      favoriteSubject: this.findMostFrequent(filteredQuests, 'subject') as Subject,
      strongestType: this.findMostFrequent(filteredQuests, 'type') as any,
      weakestType: this.findLeastFrequent(filteredQuests, 'type') as any,
      bySubject: bySubject as any,
      byType: byType as any,
    };
  }

  /**
   * 퀘스트 필터 조회
   */
  filterQuests(filter: QuestFilter): DailyQuest[] {
    const allQuests = this.questStore.get(filter.studentId) ?? [];
    let result: DailyQuest[] = [];

    for (const dayQuests of allQuests) {
      const quests = [
        ...dayQuests.mainQuests,
        ...dayQuests.reviewQuests,
        ...dayQuests.bonusQuests,
      ];

      for (const quest of quests) {
        let match = true;

        if (filter.dateRange) {
          const questDate = quest.date.getTime();
          if (questDate < filter.dateRange.from.getTime() ||
              questDate > filter.dateRange.to.getTime()) {
            match = false;
          }
        }

        if (filter.status && !filter.status.includes(quest.status)) {
          match = false;
        }

        if (filter.type && !filter.type.includes(quest.type)) {
          match = false;
        }

        if (filter.subject && !filter.subject.includes(quest.subject)) {
          match = false;
        }

        if (filter.planId && quest.planId !== filter.planId) {
          match = false;
        }

        if (match) result.push(quest);
      }
    }

    return result;
  }

  // Private 헬퍼 함수들

  private recalculateSummary(quests: TodayQuests): TodayQuests['summary'] {
    const allQuests = [
      ...quests.mainQuests,
      ...quests.reviewQuests,
      ...quests.bonusQuests,
    ];

    const completed = allQuests.filter(q => q.status === 'COMPLETED');
    const inProgress = allQuests.filter(q => q.status === 'IN_PROGRESS');
    const available = allQuests.filter(q => q.status === 'AVAILABLE');

    return {
      ...quests.summary,
      completedQuests: completed.length,
      inProgressQuests: inProgress.length,
      availableQuests: available.length,
      earnedXp: completed.reduce((sum, q) => sum + q.xpReward, 0),
      completionRate: allQuests.length > 0 ? completed.length / allQuests.length : 0,
    };
  }

  private updateStreak(studentId: string): void {
    const lastActive = this.lastActiveDate.get(studentId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastActive) {
      const lastDay = new Date(lastActive);
      lastDay.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        // 같은 날 - 스트릭 유지
      } else if (diffDays === 1) {
        // 연속 - 스트릭 증가
        const current = this.streakStore.get(studentId) ?? 0;
        this.streakStore.set(studentId, current + 1);
      } else {
        // 연속 끊김 - 리셋
        this.streakStore.set(studentId, 1);
      }
    } else {
      this.streakStore.set(studentId, 1);
    }

    this.lastActiveDate.set(studentId, today);
  }

  private checkBadgeEarned(studentId: string, quest: DailyQuest): Badge | undefined {
    const badges = this.badgeStore.get(studentId) ?? [];
    const streak = this.getStreak(studentId);
    const xp = this.getXp(studentId);

    // 연속 학습 배지
    if (streak === 7 && !badges.find(b => b.id === 'streak-7')) {
      const badge: Badge = {
        id: 'streak-7',
        name: '일주일 연속 학습자',
        description: '7일 연속 학습 달성!',
        icon: '🔥',
        category: 'STREAK',
        rarity: 'UNCOMMON',
        earnedAt: new Date(),
        criteria: '7일 연속 학습',
      };
      badges.push(badge);
      this.badgeStore.set(studentId, badges);
      return badge;
    }

    // XP 마일스톤 배지
    if (xp >= 1000 && !badges.find(b => b.id === 'xp-1000')) {
      const badge: Badge = {
        id: 'xp-1000',
        name: 'XP 마스터',
        description: '1000 XP 달성!',
        icon: '⭐',
        category: 'ACHIEVEMENT',
        rarity: 'RARE',
        earnedAt: new Date(),
        criteria: '1000 XP 획득',
      };
      badges.push(badge);
      this.badgeStore.set(studentId, badges);
      return badge;
    }

    return undefined;
  }

  private checkUnlockedQuests(quests: TodayQuests, completedQuest: DailyQuest): DailyQuest[] {
    const allQuests = [
      ...quests.mainQuests,
      ...quests.reviewQuests,
      ...quests.bonusQuests,
    ];

    const unlocked: DailyQuest[] = [];

    for (const quest of allQuests) {
      if (quest.status === 'LOCKED' && quest.prerequisites?.includes(completedQuest.id)) {
        const allPrereqsMet = quest.prerequisites.every(prereqId => {
          const prereq = allQuests.find(q => q.id === prereqId);
          return prereq?.status === 'COMPLETED';
        });

        if (allPrereqsMet) {
          quest.status = 'AVAILABLE';
          unlocked.push(quest);
        }
      }
    }

    return unlocked;
  }

  private generateCelebrationMessage(quest: DailyQuest, badge?: Badge): string {
    let message = `🎉 "${quest.title}" 완료! +${quest.xpReward} XP`;

    if (quest.streakBonus) {
      message += ` (+${quest.streakBonus} 연속 보너스!)`;
    }

    if (badge) {
      message += `\n\n🏆 새 배지 획득: ${badge.icon} ${badge.name}`;
    }

    return message;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0];
  }

  private isWithinDays(d1: Date, d2: Date, days: number): boolean {
    const diff = Math.abs(d1.getTime() - d2.getTime());
    return diff <= days * 24 * 60 * 60 * 1000;
  }

  private calculateLongestStreak(studentId: string): number {
    // 간단한 구현 - 실제로는 히스토리 기반 계산
    return Math.max(this.getStreak(studentId), 7);
  }

  private calculateAvgTime(quests: DailyQuest[]): number {
    const completedWithTime = quests.filter(q =>
      q.status === 'COMPLETED' && q.startedAt && q.completedAt
    );

    if (completedWithTime.length === 0) return 0;

    const total = completedWithTime.reduce((sum, q) => {
      const duration = q.completedAt!.getTime() - q.startedAt!.getTime();
      return sum + duration / (1000 * 60); // 분
    }, 0);

    return Math.floor(total / completedWithTime.length);
  }

  private calculateMostActiveHour(quests: DailyQuest[]): number {
    const hourCounts: number[] = new Array(24).fill(0);

    for (const quest of quests) {
      if (quest.completedAt) {
        const hour = quest.completedAt.getHours();
        hourCounts[hour]++;
      }
    }

    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private findMostFrequent(quests: DailyQuest[], field: 'subject' | 'type'): string {
    const counts: Record<string, number> = {};

    for (const quest of quests) {
      const value = quest[field];
      counts[value] = (counts[value] ?? 0) + 1;
    }

    let maxKey = '';
    let maxCount = 0;

    for (const [key, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxKey = key;
      }
    }

    return maxKey || 'GENERAL';
  }

  private findLeastFrequent(quests: DailyQuest[], field: 'subject' | 'type'): string {
    const counts: Record<string, number> = {};

    for (const quest of quests) {
      const value = quest[field];
      counts[value] = (counts[value] ?? 0) + 1;
    }

    let minKey = '';
    let minCount = Infinity;

    for (const [key, count] of Object.entries(counts)) {
      if (count < minCount) {
        minCount = count;
        minKey = key;
      }
    }

    return minKey || 'STUDY';
  }
}
