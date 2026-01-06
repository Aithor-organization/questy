/**
 * ScheduleDelayHandler
 * 스케줄 밀림 처리 및 재조정 시스템
 *
 * FR-024: 미학습 대응 - 공감적 메시지, 일정 재조정 제안
 * FR-026: 위기 개입 - 연속 3일 미학습 감지
 */

import type { DailyQuest, QuestStatus, TodayQuests } from '../types/quest.js';

// 밀림 상태 분석 결과
export interface DelayAnalysis {
  studentId: string;
  analyzedAt: Date;

  // 밀린 퀘스트들
  expiredQuests: ExpiredQuest[];

  // 연속 미학습 정보
  consecutiveMissedDays: number;
  lastCompletedDate: Date | null;

  // 위기 레벨
  crisisLevel: 'NONE' | 'WARNING' | 'CONCERN' | 'CRISIS';

  // 재조정 제안
  rescheduleSuggestion: RescheduleSuggestion | null;
}

// 만료된 퀘스트 정보
export interface ExpiredQuest {
  quest: DailyQuest;
  expiredAt: Date;
  daysOverdue: number;
  carryOverSuggestion: 'CARRY_OVER' | 'COMBINE' | 'SKIP' | 'REDUCE';
}

// 재조정 제안
export interface RescheduleSuggestion {
  type: 'CARRY_OVER' | 'REDUCE_LOAD' | 'EXTEND_PLAN' | 'SKIP_TODAY';
  message: string;
  suggestedQuests: SuggestedQuest[];
  estimatedMinutes: number;
}

// 제안된 퀘스트
export interface SuggestedQuest {
  originalQuestId: string;
  newDate: Date;
  reducedTargetValue?: number;
  reason: string;
}

// 밀림 알림
export interface DelayNotification {
  id: string;
  studentId: string;
  type: 'REMINDER' | 'OVERDUE' | 'CRISIS' | 'ENCOURAGEMENT';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: Date;
  questIds: string[];
  actionButtons: ActionButton[];
}

interface ActionButton {
  label: string;
  action: 'START_NOW' | 'RESCHEDULE' | 'SKIP_TODAY' | 'TALK_TO_COACH';
}

export class ScheduleDelayHandler {
  // In-memory 저장소 (MVP)
  private completionHistory: Map<string, Date[]>; // studentId → completion dates
  private pendingNotifications: Map<string, DelayNotification[]>;

  constructor() {
    this.completionHistory = new Map();
    this.pendingNotifications = new Map();
  }

  /**
   * 만료된 퀘스트 분석
   */
  analyzeDelays(
    studentId: string,
    todayQuests: TodayQuests | null,
    pastQuests: TodayQuests[] = []
  ): DelayAnalysis {
    const now = new Date();
    const expiredQuests: ExpiredQuest[] = [];

    // 1. 오늘의 만료된 퀘스트 찾기
    if (todayQuests) {
      const allQuests = [
        ...todayQuests.mainQuests,
        ...todayQuests.reviewQuests,
        ...todayQuests.bonusQuests,
      ];

      for (const quest of allQuests) {
        if (this.isExpired(quest, now)) {
          expiredQuests.push(this.createExpiredQuest(quest, now));
        }
      }
    }

    // 2. 과거 미완료 퀘스트 찾기 (최근 7일)
    for (const dayQuests of pastQuests) {
      const allQuests = [
        ...dayQuests.mainQuests,
        ...dayQuests.reviewQuests,
      ];

      for (const quest of allQuests) {
        if (quest.status !== 'COMPLETED' && quest.status !== 'EXPIRED') {
          expiredQuests.push(this.createExpiredQuest(quest, now));
        }
      }
    }

    // 3. 연속 미학습일 계산
    const consecutiveMissedDays = this.calculateConsecutiveMissedDays(studentId);
    const lastCompletedDate = this.getLastCompletedDate(studentId);

    // 4. 위기 레벨 판정
    const crisisLevel = this.determineCrisisLevel(consecutiveMissedDays, expiredQuests.length);

    // 5. 재조정 제안 생성
    const rescheduleSuggestion = this.generateRescheduleSuggestion(
      studentId,
      expiredQuests,
      crisisLevel
    );

    return {
      studentId,
      analyzedAt: now,
      expiredQuests,
      consecutiveMissedDays,
      lastCompletedDate,
      crisisLevel,
      rescheduleSuggestion,
    };
  }

  /**
   * 퀘스트 만료 체크
   */
  private isExpired(quest: DailyQuest, now: Date): boolean {
    if (quest.status === 'COMPLETED' || quest.status === 'EXPIRED') {
      return false;
    }

    // expiresAt 기준으로 만료 체크
    if (quest.expiresAt && quest.expiresAt < now) {
      return true;
    }

    // 날짜가 지났으면 만료
    const questDate = new Date(quest.date);
    questDate.setHours(23, 59, 59, 999);
    return questDate < now;
  }

  /**
   * 만료된 퀘스트 객체 생성
   */
  private createExpiredQuest(quest: DailyQuest, now: Date): ExpiredQuest {
    const questDate = new Date(quest.date);
    const daysOverdue = Math.floor(
      (now.getTime() - questDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      quest,
      expiredAt: quest.expiresAt || questDate,
      daysOverdue: Math.max(0, daysOverdue),
      carryOverSuggestion: this.suggestCarryOverAction(quest, daysOverdue),
    };
  }

  /**
   * 이월 방법 제안
   */
  private suggestCarryOverAction(
    quest: DailyQuest,
    daysOverdue: number
  ): ExpiredQuest['carryOverSuggestion'] {
    // 3일 이상 밀렸으면 스킵 권장
    if (daysOverdue >= 3) {
      return 'SKIP';
    }

    // 복습 퀘스트는 결합 권장
    if (quest.type === 'REVIEW') {
      return 'COMBINE';
    }

    // 긴 퀘스트는 분량 축소 권장
    if (quest.estimatedMinutes > 45) {
      return 'REDUCE';
    }

    // 기본적으로 이월
    return 'CARRY_OVER';
  }

  /**
   * 연속 미학습일 계산
   */
  private calculateConsecutiveMissedDays(studentId: string): number {
    const completions = this.completionHistory.get(studentId) ?? [];
    if (completions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let missed = 0;
    const checkDate = new Date(today);

    for (let i = 0; i < 7; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasCompletion = completions.some(
        d => d.toISOString().split('T')[0] === dateStr
      );

      if (!hasCompletion) {
        missed++;
      } else {
        break;
      }

      checkDate.setDate(checkDate.getDate() - 1);
    }

    return missed;
  }

  /**
   * 마지막 완료일 조회
   */
  private getLastCompletedDate(studentId: string): Date | null {
    const completions = this.completionHistory.get(studentId) ?? [];
    if (completions.length === 0) return null;

    return completions.reduce((latest, date) =>
      date > latest ? date : latest
    );
  }

  /**
   * 위기 레벨 판정
   */
  private determineCrisisLevel(
    consecutiveMissedDays: number,
    expiredCount: number
  ): DelayAnalysis['crisisLevel'] {
    // 3일 이상 연속 미학습 = 위기
    if (consecutiveMissedDays >= 3) {
      return 'CRISIS';
    }

    // 2일 연속 또는 밀린 퀘스트 3개 이상 = 주의
    if (consecutiveMissedDays >= 2 || expiredCount >= 3) {
      return 'CONCERN';
    }

    // 1일 또는 밀린 퀘스트 1-2개 = 경고
    if (consecutiveMissedDays >= 1 || expiredCount >= 1) {
      return 'WARNING';
    }

    return 'NONE';
  }

  /**
   * 재조정 제안 생성
   */
  private generateRescheduleSuggestion(
    studentId: string,
    expiredQuests: ExpiredQuest[],
    crisisLevel: DelayAnalysis['crisisLevel']
  ): RescheduleSuggestion | null {
    if (expiredQuests.length === 0) return null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // 위기 상황: 최소한의 목표만 제시
    if (crisisLevel === 'CRISIS') {
      const easiest = expiredQuests
        .sort((a, b) => a.quest.estimatedMinutes - b.quest.estimatedMinutes)
        .slice(0, 1);

      return {
        type: 'REDUCE_LOAD',
        message: '요즘 바빴구나 😢 작은 것부터 다시 시작해볼까?',
        suggestedQuests: easiest.map(eq => ({
          originalQuestId: eq.quest.id,
          newDate: tomorrow,
          reducedTargetValue: Math.floor(eq.quest.targetValue * 0.5),
          reason: '절반만 해보자! 10분이면 돼',
        })),
        estimatedMinutes: 10,
      };
    }

    // 주의 상황: 부분 이월
    if (crisisLevel === 'CONCERN') {
      const carryOvers = expiredQuests
        .filter(eq => eq.carryOverSuggestion !== 'SKIP')
        .slice(0, 2);

      return {
        type: 'CARRY_OVER',
        message: '밀린 거 조금 있는데, 내일 같이 해볼까?',
        suggestedQuests: carryOvers.map(eq => ({
          originalQuestId: eq.quest.id,
          newDate: tomorrow,
          reducedTargetValue: eq.carryOverSuggestion === 'REDUCE'
            ? Math.floor(eq.quest.targetValue * 0.7)
            : eq.quest.targetValue,
          reason: eq.carryOverSuggestion === 'REDUCE'
            ? '분량 살짝 줄여서'
            : '그대로 이월',
        })),
        estimatedMinutes: carryOvers.reduce(
          (sum, eq) => sum + eq.quest.estimatedMinutes, 0
        ),
      };
    }

    // 경고 상황: 전체 이월
    return {
      type: 'CARRY_OVER',
      message: '어제 못 한 거, 오늘 할 수 있어?',
      suggestedQuests: expiredQuests.map(eq => ({
        originalQuestId: eq.quest.id,
        newDate: tomorrow,
        reason: '내일로 이월',
      })),
      estimatedMinutes: expiredQuests.reduce(
        (sum, eq) => sum + eq.quest.estimatedMinutes, 0
      ),
    };
  }

  /**
   * 만료 퀘스트 상태 업데이트
   */
  markAsExpired(quest: DailyQuest): DailyQuest {
    return {
      ...quest,
      status: 'EXPIRED' as QuestStatus,
    };
  }

  /**
   * 퀘스트 이월 생성
   */
  createCarriedOverQuest(
    original: DailyQuest,
    newDate: Date,
    reducedTarget?: number
  ): DailyQuest {
    const newExpires = new Date(newDate);
    newExpires.setHours(23, 59, 59, 999);

    return {
      ...original,
      id: `${original.id}-carryover-${newDate.toISOString().split('T')[0]}`,
      date: newDate,
      status: 'AVAILABLE' as QuestStatus,
      targetValue: reducedTarget ?? original.targetValue,
      currentValue: 0,
      startedAt: undefined,
      completedAt: undefined,
      expiresAt: newExpires,
      tags: [...original.tags, 'CARRIED_OVER'],
    };
  }

  /**
   * 완료 기록 추가
   * @param studentId 학생 ID
   * @param questId 퀘스트 ID (밀림 추적용, 실제로는 완료일만 기록)
   */
  recordCompletion(studentId: string, questId?: string): void {
    const date = new Date();
    const completions = this.completionHistory.get(studentId) ?? [];
    completions.push(date);

    // 최근 30일만 유지
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const filtered = completions.filter(d => d > cutoff);

    this.completionHistory.set(studentId, filtered);
  }

  /**
   * 밀림 알림 생성
   * @param studentId 학생 ID
   * @param analysis 분석 결과 (선택, studentId로 분석 대체 가능)
   */
  generateDelayNotification(
    studentId: string,
    analysis: DelayAnalysis
  ): DelayNotification | null {
    if (analysis.crisisLevel === 'NONE') return null;

    const notification: DelayNotification = {
      id: `notif-${Date.now()}`,
      studentId,
      type: this.getNotificationType(analysis.crisisLevel),
      title: this.getNotificationTitle(analysis),
      message: this.getNotificationMessage(analysis),
      priority: this.getNotificationPriority(analysis.crisisLevel),
      createdAt: new Date(),
      questIds: analysis.expiredQuests.map(eq => eq.quest.id),
      actionButtons: this.getActionButtons(analysis.crisisLevel),
    };

    // 알림 저장
    const notifications = this.pendingNotifications.get(studentId) ?? [];
    notifications.push(notification);
    this.pendingNotifications.set(studentId, notifications);

    return notification;
  }

  private getNotificationType(
    crisisLevel: DelayAnalysis['crisisLevel']
  ): DelayNotification['type'] {
    switch (crisisLevel) {
      case 'CRISIS': return 'CRISIS';
      case 'CONCERN': return 'OVERDUE';
      case 'WARNING': return 'REMINDER';
      default: return 'ENCOURAGEMENT';
    }
  }

  private getNotificationTitle(analysis: DelayAnalysis): string {
    switch (analysis.crisisLevel) {
      case 'CRISIS':
        return `${analysis.consecutiveMissedDays}일째 쉬고 있구나 💙`;
      case 'CONCERN':
        return '밀린 퀘스트가 있어요 📚';
      case 'WARNING':
        return '어제 못 한 거 있어!';
      default:
        return '오늘도 화이팅!';
    }
  }

  private getNotificationMessage(analysis: DelayAnalysis): string {
    const suggestion = analysis.rescheduleSuggestion;

    switch (analysis.crisisLevel) {
      case 'CRISIS':
        return `요즘 바빴구나... 괜찮아 😢\n${suggestion?.estimatedMinutes || 10}분만 해볼까? 아니어도 괜찮아.`;
      case 'CONCERN':
        return `${analysis.expiredQuests.length}개 밀렸는데, ${suggestion?.message || '같이 해볼까?'}`;
      case 'WARNING':
        return suggestion?.message || '오늘 30분만 해볼까?';
      default:
        return '작은 시작이 큰 변화를 만들어!';
    }
  }

  private getNotificationPriority(
    crisisLevel: DelayAnalysis['crisisLevel']
  ): DelayNotification['priority'] {
    switch (crisisLevel) {
      case 'CRISIS': return 'URGENT';
      case 'CONCERN': return 'HIGH';
      case 'WARNING': return 'MEDIUM';
      default: return 'LOW';
    }
  }

  private getActionButtons(
    crisisLevel: DelayAnalysis['crisisLevel']
  ): ActionButton[] {
    if (crisisLevel === 'CRISIS') {
      return [
        { label: '10분만 해볼게', action: 'START_NOW' },
        { label: '코치랑 얘기하기', action: 'TALK_TO_COACH' },
      ];
    }

    return [
      { label: '지금 시작!', action: 'START_NOW' },
      { label: '내일 할게', action: 'RESCHEDULE' },
      { label: '오늘은 쉴래', action: 'SKIP_TODAY' },
    ];
  }

  /**
   * 대기 중인 알림 조회
   */
  getPendingNotifications(studentId: string): DelayNotification[] {
    return this.pendingNotifications.get(studentId) ?? [];
  }

  /**
   * 알림 전체 삭제
   */
  clearNotifications(studentId: string): void {
    this.pendingNotifications.delete(studentId);
  }

  /**
   * 특정 알림 해제
   */
  dismissNotification(studentId: string, notificationId: string): boolean {
    const notifications = this.pendingNotifications.get(studentId) ?? [];
    const filtered = notifications.filter(n => n.id !== notificationId);

    if (filtered.length === notifications.length) {
      return false; // 알림을 찾지 못함
    }

    if (filtered.length === 0) {
      this.pendingNotifications.delete(studentId);
    } else {
      this.pendingNotifications.set(studentId, filtered);
    }

    return true;
  }
}
