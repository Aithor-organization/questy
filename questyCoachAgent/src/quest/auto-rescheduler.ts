/**
 * AutoRescheduler
 * AI 기반 자동 일정 재조정 서비스
 *
 * 주말 미포함 플랜에서 미완료 퀘스트 발생 시:
 * - 주말로 이동 (WEEKEND_SPILLOVER)
 * - 다음 날 2개 퀘스트로 쌓기 (STACK_NEXT_DAY)
 * - AI가 상황에 맞게 자동 판단
 */

import type { DailyQuest, TodayQuests } from '../types/quest.js';
import type { MessageAction } from '../types/agent.js';

// 재조정 전략
export type RescheduleStrategy =
  | 'WEEKEND_SPILLOVER'   // 주말로 이동 (주말 미포함 플랜에서도 예외적으로 주말 사용)
  | 'STACK_NEXT_DAY'      // 다음 평일에 2개 퀘스트로 쌓기
  | 'EXTEND_DEADLINE'     // 전체 마감일 연장
  | 'REDUCE_LOAD';        // 분량 축소

// 자동 재조정 결과
export interface AutoRescheduleResult {
  strategy: RescheduleStrategy;
  originalQuest: IncompleteQuest;
  newDate: string;              // YYYY-MM-DD
  isWeekend: boolean;           // 주말 여부
  stackedCount?: number;        // STACK_NEXT_DAY일 경우 해당 날 퀘스트 수
  reasoning: string;            // AI의 판단 이유
  coachMessage: string;         // 학생에게 보여줄 메시지
  messageActions: MessageAction[];  // 액션 버튼
  confidence: number;           // 판단 신뢰도 0-1
}

// 미완료 퀘스트 정보
export interface IncompleteQuest {
  questId: string;
  planId: string;
  planName: string;
  unitTitle: string;
  range: string;
  day: number;
  originalDate: string;
  estimatedMinutes: number;
  excludeWeekends: boolean;     // 원래 플랜이 주말 미포함인지
}

// 플랜 설정 정보
export interface PlanSettings {
  planId: string;
  planName: string;
  excludeWeekends: boolean;
  totalDays: number;
  remainingDays: number;
  targetEndDate: string;
}

// 학생 학습 패턴
export interface StudentPattern {
  preferredStudyDays: ('weekday' | 'weekend')[];
  averageQuestsPerDay: number;
  completionRate: number;       // 최근 7일 완료율
  weekendAvailability: boolean; // 주말 학습 가능 여부
  consecutiveMissedDays: number;
}

export class AutoRescheduler {
  /**
   * 미완료 퀘스트에 대한 자동 재조정 결정
   */
  async evaluateAndReschedule(
    incompleteQuest: IncompleteQuest,
    planSettings: PlanSettings,
    studentPattern: StudentPattern,
    existingQuestsOnNextDay: number
  ): Promise<AutoRescheduleResult> {
    // AI 판단 로직
    const decision = this.makeAIDecision(
      incompleteQuest,
      planSettings,
      studentPattern,
      existingQuestsOnNextDay
    );

    // 새 날짜 계산
    const newDate = this.calculateNewDate(
      incompleteQuest.originalDate,
      decision.strategy,
      planSettings.excludeWeekends
    );

    // 코치 메시지 및 액션 생성
    const { coachMessage, messageActions } = this.generateCoachResponse(
      incompleteQuest,
      decision,
      newDate,
      existingQuestsOnNextDay
    );

    return {
      strategy: decision.strategy,
      originalQuest: incompleteQuest,
      newDate: newDate.dateString,
      isWeekend: newDate.isWeekend,
      stackedCount: decision.strategy === 'STACK_NEXT_DAY'
        ? existingQuestsOnNextDay + 1
        : undefined,
      reasoning: decision.reasoning,
      coachMessage,
      messageActions,
      confidence: decision.confidence,
    };
  }

  /**
   * AI 기반 전략 결정
   */
  private makeAIDecision(
    quest: IncompleteQuest,
    plan: PlanSettings,
    pattern: StudentPattern,
    existingQuestsOnNextDay: number
  ): { strategy: RescheduleStrategy; reasoning: string; confidence: number } {
    // 요인 분석
    const factors = {
      // 다음 날 부담이 너무 크면 주말 사용
      nextDayOverloaded: existingQuestsOnNextDay >= 2,

      // 학생이 주말에 학습 가능한지
      weekendAvailable: pattern.weekendAvailability,

      // 연속 미학습 상태 (위기 상황)
      inCrisis: pattern.consecutiveMissedDays >= 2,

      // 최근 완료율이 낮으면 분량 축소 고려
      lowCompletionRate: pattern.completionRate < 0.5,

      // 마감이 임박한 경우
      deadlineNear: plan.remainingDays <= 3,

      // 퀘스트가 짧으면 쌓기 가능
      shortQuest: quest.estimatedMinutes <= 30,

      // 원래 주말 미포함 플랜인지
      wasWeekendExcluded: quest.excludeWeekends,
    };

    // 의사결정 트리

    // 1. 위기 상황: 분량 축소 우선
    if (factors.inCrisis && factors.lowCompletionRate) {
      return {
        strategy: 'REDUCE_LOAD',
        reasoning: '연속 미학습 상태 + 낮은 완료율로 분량 축소가 필요합니다.',
        confidence: 0.9,
      };
    }

    // 2. 다음 날 이미 2개 이상 → 주말 사용 (주말 가능 시)
    if (factors.nextDayOverloaded && factors.weekendAvailable && factors.wasWeekendExcluded) {
      return {
        strategy: 'WEEKEND_SPILLOVER',
        reasoning: '내일 퀘스트가 이미 많아서 주말에 배치합니다.',
        confidence: 0.85,
      };
    }

    // 3. 짧은 퀘스트는 다음 날에 쌓기
    if (factors.shortQuest && existingQuestsOnNextDay <= 1) {
      return {
        strategy: 'STACK_NEXT_DAY',
        reasoning: '30분 이하 퀘스트라서 내일 추가로 배치합니다.',
        confidence: 0.8,
      };
    }

    // 4. 주말 미포함 플랜 + 주말 가능 → 주말 사용
    if (factors.wasWeekendExcluded && factors.weekendAvailable) {
      return {
        strategy: 'WEEKEND_SPILLOVER',
        reasoning: '평일 부담을 줄이기 위해 주말에 배치합니다.',
        confidence: 0.75,
      };
    }

    // 5. 마감 임박 → 쌓기
    if (factors.deadlineNear) {
      return {
        strategy: 'STACK_NEXT_DAY',
        reasoning: '마감이 가까워 내일 추가로 배치합니다.',
        confidence: 0.7,
      };
    }

    // 6. 기본: 다음 날 쌓기
    return {
      strategy: 'STACK_NEXT_DAY',
      reasoning: '기본 전략으로 내일 추가 배치합니다.',
      confidence: 0.65,
    };
  }

  /**
   * 새 날짜 계산
   */
  private calculateNewDate(
    originalDate: string,
    strategy: RescheduleStrategy,
    excludeWeekends: boolean
  ): { dateString: string; isWeekend: boolean } {
    const original = new Date(originalDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (strategy === 'WEEKEND_SPILLOVER') {
      // 가장 가까운 주말 찾기
      const nextSaturday = this.getNextWeekend(today);
      return {
        dateString: this.formatDate(nextSaturday),
        isWeekend: true,
      };
    }

    // STACK_NEXT_DAY 또는 기타: 다음 평일
    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);

    // 주말 미포함 플랜이 아닌 경우 그대로 다음 날
    if (!excludeWeekends) {
      return {
        dateString: this.formatDate(nextDay),
        isWeekend: this.isWeekend(nextDay),
      };
    }

    // 주말 미포함: 평일로 이동
    while (this.isWeekend(nextDay)) {
      nextDay.setDate(nextDay.getDate() + 1);
    }

    return {
      dateString: this.formatDate(nextDay),
      isWeekend: false,
    };
  }

  /**
   * 코치 메시지 및 액션 버튼 생성
   */
  private generateCoachResponse(
    quest: IncompleteQuest,
    decision: { strategy: RescheduleStrategy; reasoning: string; confidence: number },
    newDate: { dateString: string; isWeekend: boolean },
    existingQuestsOnNextDay: number
  ): { coachMessage: string; messageActions: MessageAction[] } {
    const dayName = newDate.isWeekend ? '주말' : '평일';
    const formattedDate = this.formatDateKorean(newDate.dateString);

    let coachMessage: string;
    const messageActions: MessageAction[] = [];

    switch (decision.strategy) {
      case 'WEEKEND_SPILLOVER':
        coachMessage = `📅 오늘 못 끝낸 "${quest.unitTitle}"을 **${formattedDate}(${dayName})**로 옮겼어요!\n\n` +
          `평일에 너무 몰리지 않게 주말에 배치했어요. 부담 없이 해보자! 💪`;

        messageActions.push({
          id: `accept-weekend-${quest.questId}`,
          type: 'CUSTOM',
          label: '👍 좋아요',
          icon: '✅',
          data: { customHandler: 'accept_reschedule' },
        });
        messageActions.push({
          id: `change-to-weekday-${quest.questId}`,
          type: 'RESCHEDULE_QUEST',
          label: '평일로 변경',
          icon: '📆',
          data: {
            planId: quest.planId,
            questDay: quest.day,
            newDate: this.getNextWeekday(newDate.dateString),
          },
        });
        break;

      case 'STACK_NEXT_DAY':
        const totalTomorrow = existingQuestsOnNextDay + 1;
        coachMessage = `📚 오늘 못 끝낸 "${quest.unitTitle}"을 **${formattedDate}**에 추가했어요!\n\n` +
          `내일은 총 ${totalTomorrow}개 퀘스트가 있어요. ${totalTomorrow >= 2 ? '조금 바쁘지만 할 수 있어! 💪' : '무리 없이 해보자! 😊'}`;

        messageActions.push({
          id: `accept-stack-${quest.questId}`,
          type: 'CUSTOM',
          label: '👍 알겠어요',
          icon: '✅',
          data: { customHandler: 'accept_reschedule' },
        });
        if (quest.excludeWeekends) {
          messageActions.push({
            id: `move-to-weekend-${quest.questId}`,
            type: 'RESCHEDULE_QUEST',
            label: '주말로 옮기기',
            icon: '🗓️',
            data: {
              planId: quest.planId,
              questDay: quest.day,
              newDate: this.formatDate(this.getNextWeekend(new Date())),
            },
          });
        }
        break;

      case 'REDUCE_LOAD':
        coachMessage = `😊 요즘 많이 바쁘셨죠? "${quest.unitTitle}" 분량을 **절반으로 줄여서** ${formattedDate}에 배치했어요.\n\n` +
          `무리하지 말고 천천히 해봐요! 💕`;

        messageActions.push({
          id: `accept-reduce-${quest.questId}`,
          type: 'CUSTOM',
          label: '👍 고마워요',
          icon: '💕',
          data: { customHandler: 'accept_reduced' },
        });
        break;

      default:
        coachMessage = `📅 "${quest.unitTitle}"을 ${formattedDate}로 옮겼어요!`;
    }

    // 공통: 직접 날짜 선택 옵션
    messageActions.push({
      id: `custom-date-${quest.questId}`,
      type: 'NAVIGATE',
      label: '직접 날짜 선택',
      icon: '📆',
      data: { navigateTo: `/plans/${quest.planId}/reschedule` },
    });

    return { coachMessage, messageActions };
  }

  /**
   * 여러 미완료 퀘스트를 한 번에 재조정
   */
  async batchReschedule(
    incompleteQuests: IncompleteQuest[],
    planSettings: PlanSettings,
    studentPattern: StudentPattern
  ): Promise<AutoRescheduleResult[]> {
    const results: AutoRescheduleResult[] = [];
    let existingQuestsOnNextDay = 0;

    // 날짜별로 그룹화하여 처리
    for (const quest of incompleteQuests) {
      const result = await this.evaluateAndReschedule(
        quest,
        planSettings,
        studentPattern,
        existingQuestsOnNextDay
      );

      results.push(result);

      // 다음 날에 쌓이는 퀘스트 수 업데이트
      if (result.strategy === 'STACK_NEXT_DAY') {
        existingQuestsOnNextDay++;
      }
    }

    return results;
  }

  /**
   * 미완료 퀘스트 탐지 (하루가 지났을 때 호출)
   */
  detectIncompleteQuests(
    todayQuests: TodayQuests,
    planId: string,
    planName: string,
    excludeWeekends: boolean
  ): IncompleteQuest[] {
    const incomplete: IncompleteQuest[] = [];
    const allQuests = [
      ...todayQuests.mainQuests,
      ...todayQuests.reviewQuests,
    ];

    for (const quest of allQuests) {
      if (quest.status !== 'COMPLETED' && quest.status !== 'EXPIRED') {
        incomplete.push({
          questId: quest.id,
          planId: quest.planId || planId,
          planName,
          unitTitle: quest.title,
          range: quest.description,
          day: 0, // 프론트엔드에서 채워야 함
          originalDate: this.formatDate(quest.date),
          estimatedMinutes: quest.estimatedMinutes,
          excludeWeekends,
        });
      }
    }

    return incomplete;
  }

  // ==================== 유틸리티 함수 ====================

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
  }

  private getNextWeekend(fromDate: Date): Date {
    const date = new Date(fromDate);
    const day = date.getDay();

    // 토요일까지 남은 일수
    const daysUntilSaturday = day === 6 ? 7 : (6 - day);
    date.setDate(date.getDate() + daysUntilSaturday);

    return date;
  }

  private getNextWeekday(fromDateString: string): string {
    const date = new Date(fromDateString);
    date.setDate(date.getDate() + 1);

    while (this.isWeekend(date)) {
      date.setDate(date.getDate() + 1);
    }

    return this.formatDate(date);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateKorean(dateString: string): string {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일(${weekday})`;
  }
}
