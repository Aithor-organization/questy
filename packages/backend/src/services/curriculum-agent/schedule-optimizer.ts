// ScheduleOptimizer - 퀘스트 스케줄 재조정
// Python curriculum-agent/handlers/schedule_optimizer.py의 TypeScript 변환

import {
  Quest,
  QuestSchedule,
  QuestStatus,
  QuestPriority,
  RescheduleStrategy,
  RescheduleResult,
  ExistingPlan,
} from './types.js';
import { QuestManager } from './quest-manager.js';

export class ScheduleOptimizer {
  private questManager: QuestManager;
  private maxDailyHours = 10;
  private minDailyHours = 2;
  private bufferRatio = 0.1; // 여유 시간 비율 (10%)

  constructor(questManager: QuestManager) {
    this.questManager = questManager;
  }

  /**
   * 날짜 포맷팅 (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 날짜 파싱
   */
  private parseDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  /**
   * 다른 플랜의 일별 시간 사용량 계산
   */
  private calculateExternalDailyUsage(existingPlans: ExistingPlan[]): Record<string, number> {
    const dailyUsage: Record<string, number> = {};

    for (const plan of existingPlans) {
      const quests = plan.quests || [];
      for (const quest of quests) {
        const scheduledDate = quest.scheduledDate;
        const estimatedMinutes = quest.estimatedMinutes || 0;

        if (scheduledDate && estimatedMinutes > 0) {
          if (!dailyUsage[scheduledDate]) {
            dailyUsage[scheduledDate] = 0;
          }
          dailyUsage[scheduledDate] += estimatedMinutes;
        }
      }
    }

    return dailyUsage;
  }

  /**
   * 일별 남은 용량 계산
   */
  private calculateDailyCapacity(
    startDate: Date,
    endDate: Date,
    dailyHours: number,
    existingQuests: Quest[],
    externalDailyUsage: Record<string, number> = {}
  ): Record<string, number> {
    const capacity: Record<string, number> = {};
    const dailyMinutes = dailyHours * 60;
    const bufferMinutes = Math.floor(dailyMinutes * this.bufferRatio);
    const available = dailyMinutes - bufferMinutes;

    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = this.formatDate(current);

      // 기존 퀘스트 시간 차감 (현재 플랜 내부)
      const internalMinutes = existingQuests
        .filter(q => q.scheduledDate === dateStr)
        .reduce((sum, q) => sum + q.estimatedMinutes, 0);

      // 외부 플랜 시간 차감
      const externalMinutes = externalDailyUsage[dateStr] || 0;

      // 최종 가용 시간
      const remaining = Math.max(0, available - internalMinutes - externalMinutes);
      capacity[dateStr] = remaining;

      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return capacity;
  }

  /**
   * 미완료 퀘스트 재조정
   */
  rescheduleOverdue(
    targetDate: string,
    dailyStudyHours = 6,
    strategy: RescheduleStrategy = RescheduleStrategy.SMART,
    existingPlans: ExistingPlan[] = []
  ): RescheduleResult {
    // 다른 플랜의 일별 시간 사용량 계산
    const externalDailyUsage = this.calculateExternalDailyUsage(existingPlans);

    // 미완료/기한초과 퀘스트 수집
    const overdueQuests = this.questManager.getOverdueQuests();
    const pendingQuests = this.questManager
      .getPendingQuests()
      .filter(q => !overdueQuests.includes(q));

    const questsToReschedule = [...overdueQuests];

    if (questsToReschedule.length === 0) {
      return {
        success: true,
        strategyUsed: strategy,
        rescheduledQuests: [],
        originalDates: {},
        newSchedules: {},
        warnings: ['재조정할 퀘스트가 없습니다.'],
        dailyOverload: [],
        metadata: { reason: 'no_overdue_quests' },
      };
    }

    // 원래 날짜 저장
    const originalDates: Record<string, string> = {};
    for (const q of questsToReschedule) {
      originalDates[q.id] = q.scheduledDate;
    }

    // 가용 날짜 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = this.parseDate(targetDate);
    const availableDays = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (availableDays <= 0) {
      return {
        success: false,
        strategyUsed: strategy,
        rescheduledQuests: [],
        originalDates,
        newSchedules: {},
        warnings: ['목표일이 이미 지났습니다.'],
        dailyOverload: [],
        metadata: { reason: 'target_date_passed' },
      };
    }

    // 일일 가용 시간 계산
    const dailyCapacity = this.calculateDailyCapacity(
      today,
      endDate,
      dailyStudyHours,
      pendingQuests,
      externalDailyUsage
    );

    // 전략에 따라 재조정
    let result: { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] };

    switch (strategy) {
      case RescheduleStrategy.SMART:
        result = this.smartReschedule(questsToReschedule, dailyCapacity, today, endDate);
        break;
      case RescheduleStrategy.SPREAD:
        result = this.spreadReschedule(questsToReschedule, dailyCapacity, today, endDate);
        break;
      case RescheduleStrategy.PRIORITY_FIRST:
        result = this.priorityReschedule(questsToReschedule, dailyCapacity, today, endDate);
        break;
      case RescheduleStrategy.FRONT_LOAD:
        result = this.frontLoadReschedule(questsToReschedule, dailyCapacity, today, endDate);
        break;
      case RescheduleStrategy.BACK_LOAD:
        result = this.backLoadReschedule(questsToReschedule, dailyCapacity, today, endDate);
        break;
      default:
        result = this.smartReschedule(questsToReschedule, dailyCapacity, today, endDate);
    }

    // 퀘스트 상태 업데이트
    const quests = this.questManager.getQuests();
    for (const quest of result.rescheduled) {
      quest.status = QuestStatus.RESCHEDULED;
      quests.set(quest.id, quest);
    }

    // 스케줄 재구축
    const allQuests = Array.from(quests.values());
    this.buildSchedules(allQuests, dailyStudyHours * 60);

    // 새 스케줄 객체 생성
    const newSchedules: Record<string, QuestSchedule> = {};
    for (const [date, schedule] of this.questManager.getSchedules().entries()) {
      newSchedules[date] = { ...schedule };
    }

    return {
      success: result.success,
      strategyUsed: strategy,
      rescheduledQuests: result.rescheduled,
      originalDates,
      newSchedules,
      warnings: result.warnings,
      dailyOverload: result.overloadDays,
      metadata: {
        totalRescheduled: result.rescheduled.length,
        availableDays,
        totalMinutesRescheduled: result.rescheduled.reduce((sum, q) => sum + q.estimatedMinutes, 0),
      },
    };
  }

  /**
   * 스케줄 구축
   */
  private buildSchedules(quests: Quest[], dailyMinutes: number): void {
    const schedules = this.questManager.getSchedules();
    schedules.clear();

    const dateQuests: Record<string, Quest[]> = {};
    for (const quest of quests) {
      const date = quest.scheduledDate;
      if (!dateQuests[date]) {
        dateQuests[date] = [];
      }
      dateQuests[date].push(quest);
    }

    for (const [date, dayQuests] of Object.entries(dateQuests)) {
      const totalMinutes = dayQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
      const utilization = dailyMinutes > 0 ? totalMinutes / dailyMinutes : 0;

      schedules.set(date, {
        date,
        quests: dayQuests,
        totalMinutes,
        availableMinutes: dailyMinutes,
        utilizationRate: Math.round(utilization * 100) / 100,
        isOverloaded: totalMinutes > dailyMinutes,
      });
    }
  }

  /**
   * 지능형 재조정
   */
  private smartReschedule(
    quests: Quest[],
    capacity: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] } {
    const rescheduled: Quest[] = [];
    const warnings: string[] = [];
    const overloadDays: string[] = [];

    // 우선순위로 정렬
    const sortedQuests = [...quests].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.chapter.localeCompare(b.chapter);
    });

    // 과목별 그룹화
    const subjectQuests: Record<string, Quest[]> = {};
    for (const q of sortedQuests) {
      if (!subjectQuests[q.subject]) {
        subjectQuests[q.subject] = [];
      }
      subjectQuests[q.subject].push(q);
    }

    // 라운드 로빈으로 과목별 배치
    const dates = Object.keys(capacity).sort();
    let dateIdx = 0;
    let subjectIdx = 0;
    const subjects = Object.keys(subjectQuests);

    const remainingQuests = [...sortedQuests];
    const capacityCopy = { ...capacity };

    while (remainingQuests.length > 0 && dateIdx < dates.length) {
      const currentDate = dates[dateIdx];
      const currentCapacity = capacityCopy[currentDate];

      if (currentCapacity <= 0) {
        dateIdx++;
        continue;
      }

      // 현재 과목에서 배치 가능한 퀘스트 찾기
      let placed = false;
      for (let i = 0; i < subjects.length; i++) {
        const subject = subjects[(subjectIdx + i) % subjects.length];

        for (const quest of remainingQuests) {
          if (quest.subject === subject && quest.estimatedMinutes <= currentCapacity) {
            quest.scheduledDate = currentDate;
            rescheduled.push(quest);
            remainingQuests.splice(remainingQuests.indexOf(quest), 1);
            capacityCopy[currentDate] -= quest.estimatedMinutes;
            placed = true;
            subjectIdx = (subjectIdx + i + 1) % subjects.length;
            break;
          }
        }

        if (placed) break;
      }

      if (!placed) {
        dateIdx++;
      }
    }

    // 남은 퀘스트 강제 배치 (과부하 허용)
    if (remainingQuests.length > 0) {
      warnings.push(`${remainingQuests.length}개 퀘스트가 과부하로 배치되었습니다.`);
      for (const quest of remainingQuests) {
        // 가장 여유 있는 날에 배치
        const bestDate = Object.keys(capacityCopy).reduce((a, b) =>
          capacityCopy[a] > capacityCopy[b] ? a : b
        );
        quest.scheduledDate = bestDate;
        rescheduled.push(quest);
        capacityCopy[bestDate] -= quest.estimatedMinutes;
        if (capacityCopy[bestDate] < 0 && !overloadDays.includes(bestDate)) {
          overloadDays.push(bestDate);
        }
      }
    }

    return {
      success: remainingQuests.length === 0 || overloadDays.length <= 3,
      rescheduled,
      warnings,
      overloadDays,
    };
  }

  /**
   * 균등 분배 재조정
   */
  private spreadReschedule(
    quests: Quest[],
    capacity: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] } {
    const rescheduled: Quest[] = [];
    const warnings: string[] = [];
    const overloadDays: string[] = [];
    const capacityCopy = { ...capacity };

    const dates = Object.keys(capacity).sort();
    const questsPerDay = Math.max(1, Math.floor(quests.length / dates.length));

    let questIdx = 0;
    for (const date of dates) {
      let dayCount = 0;
      while (questIdx < quests.length && dayCount < questsPerDay) {
        const quest = quests[questIdx];
        if (capacityCopy[date] >= quest.estimatedMinutes) {
          quest.scheduledDate = date;
          capacityCopy[date] -= quest.estimatedMinutes;
          rescheduled.push(quest);
          dayCount++;
        }
        questIdx++;
      }
    }

    // 남은 퀘스트 배치
    while (questIdx < quests.length) {
      const quest = quests[questIdx];
      const bestDate = Object.keys(capacityCopy).reduce((a, b) =>
        capacityCopy[a] > capacityCopy[b] ? a : b
      );
      quest.scheduledDate = bestDate;
      capacityCopy[bestDate] -= quest.estimatedMinutes;
      rescheduled.push(quest);
      if (capacityCopy[bestDate] < 0 && !overloadDays.includes(bestDate)) {
        overloadDays.push(bestDate);
      }
      questIdx++;
    }

    return {
      success: true,
      rescheduled,
      warnings,
      overloadDays,
    };
  }

  /**
   * 우선순위 기반 재조정
   */
  private priorityReschedule(
    quests: Quest[],
    capacity: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] } {
    const sortedQuests = [...quests].sort((a, b) => b.priority - a.priority);
    return this.spreadReschedule(sortedQuests, capacity, startDate, endDate);
  }

  /**
   * 앞쪽 집중 재조정
   */
  private frontLoadReschedule(
    quests: Quest[],
    capacity: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] } {
    const rescheduled: Quest[] = [];
    const warnings: string[] = [];
    const overloadDays: string[] = [];
    const capacityCopy = { ...capacity };

    const dates = Object.keys(capacity).sort();

    for (const quest of quests) {
      let placed = false;
      for (const date of dates) {
        if (capacityCopy[date] >= quest.estimatedMinutes) {
          quest.scheduledDate = date;
          capacityCopy[date] -= quest.estimatedMinutes;
          rescheduled.push(quest);
          placed = true;
          break;
        }
      }

      if (!placed) {
        // 여유 없으면 첫 날에 강제 배치
        quest.scheduledDate = dates[0];
        capacityCopy[dates[0]] -= quest.estimatedMinutes;
        rescheduled.push(quest);
        if (!overloadDays.includes(dates[0])) {
          overloadDays.push(dates[0]);
        }
      }
    }

    if (overloadDays.length > 0) {
      warnings.push('일부 날짜에 학습량이 과부하되었습니다.');
    }

    return {
      success: true,
      rescheduled,
      warnings,
      overloadDays,
    };
  }

  /**
   * 뒤쪽 집중 재조정
   */
  private backLoadReschedule(
    quests: Quest[],
    capacity: Record<string, number>,
    startDate: Date,
    endDate: Date
  ): { success: boolean; rescheduled: Quest[]; warnings: string[]; overloadDays: string[] } {
    const rescheduled: Quest[] = [];
    const warnings: string[] = [];
    const overloadDays: string[] = [];
    const capacityCopy = { ...capacity };

    const dates = Object.keys(capacity).sort().reverse(); // 역순

    for (const quest of quests) {
      let placed = false;
      for (const date of dates) {
        if (capacityCopy[date] >= quest.estimatedMinutes) {
          quest.scheduledDate = date;
          capacityCopy[date] -= quest.estimatedMinutes;
          rescheduled.push(quest);
          placed = true;
          break;
        }
      }

      if (!placed) {
        // 마지막 날에 강제 배치
        quest.scheduledDate = dates[0];
        capacityCopy[dates[0]] -= quest.estimatedMinutes;
        rescheduled.push(quest);
        if (!overloadDays.includes(dates[0])) {
          overloadDays.push(dates[0]);
        }
      }
    }

    if (overloadDays.length > 0) {
      warnings.push('마감일 근처에 학습량이 집중되었습니다.');
    }

    return {
      success: true,
      rescheduled,
      warnings,
      overloadDays,
    };
  }

  /**
   * 일별 부하 균형 최적화
   */
  optimizeDailyBalance(dailyStudyHours = 6): { adjustments: any[]; totalMoved: number } {
    const dailyMinutes = dailyStudyHours * 60;
    const adjustments: any[] = [];
    const schedules = this.questManager.getSchedules();

    for (const [date, schedule] of schedules.entries()) {
      if (schedule.isOverloaded) {
        let overflow = schedule.totalMinutes - dailyMinutes;

        for (const [otherDate, otherSchedule] of schedules.entries()) {
          if (otherDate !== date && !otherSchedule.isOverloaded) {
            const available = dailyMinutes - otherSchedule.totalMinutes;

            for (const quest of schedule.quests) {
              if (quest.estimatedMinutes <= available && quest.estimatedMinutes <= overflow) {
                quest.scheduledDate = otherDate;
                adjustments.push({
                  questId: quest.id,
                  fromDate: date,
                  toDate: otherDate,
                });
                overflow -= quest.estimatedMinutes;
                if (overflow <= 0) break;
              }
            }
          }
        }
      }
    }

    // 스케줄 재구축
    const allQuests = Array.from(this.questManager.getQuests().values());
    this.buildSchedules(allQuests, dailyMinutes);

    return {
      adjustments,
      totalMoved: adjustments.length,
    };
  }

  /**
   * 따라잡기 계획 제안
   */
  suggestCatchUpPlan(
    targetDate: string,
    extraHoursPerDay = 2
  ): Record<string, any> {
    const overdue = this.questManager.getOverdueQuests();
    if (overdue.length === 0) {
      return {
        message: '모든 퀘스트가 예정대로 진행 중입니다.',
        extraNeeded: false,
      };
    }

    const totalOverdueMinutes = overdue.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    const extraMinutesPerDay = extraHoursPerDay * 60;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = this.parseDate(targetDate);
    const daysRemaining = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const daysNeeded = Math.ceil(totalOverdueMinutes / extraMinutesPerDay);

    return {
      overdueCount: overdue.length,
      totalMinutesBehind: totalOverdueMinutes,
      daysRemaining,
      extraHoursNeededTotal: totalOverdueMinutes / 60,
      daysNeededWithExtra: daysNeeded,
      feasible: daysNeeded <= daysRemaining,
      recommendation: daysNeeded <= daysRemaining
        ? `하루 ${extraHoursPerDay}시간 추가 학습 시 ${daysNeeded}일 내 완료 가능`
        : `목표일까지 완료 어려움. 하루 ${(totalOverdueMinutes / daysRemaining / 60).toFixed(1)}시간 추가 필요`,
      overdueQuests: overdue.map(q => ({ ...q })),
    };
  }
}
