/**
 * QuestActions - 공유 퀘스트 액션 모듈
 * 모든 에이전트가 사용할 수 있는 퀘스트/플랜 관련 액션
 * - 일정 조정 (RESCHEDULE_QUEST)
 * - 플랜 생성 안내
 * - 일정 조회
 */

import type { MessageAction, DirectorContext, StudyPlan } from '../../types/agent.js';
import type { TodayQuests, DailyQuest } from '../../types/quest.js';
import type { MemoryContext } from '../../types/memory.js';

// 한국어 날짜 파싱 유틸리티
export function parseKoreanDate(message: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 요일 매핑
  const dayMap: Record<string, number> = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6,
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
  };

  // "내일", "모레" 등
  if (/내일/.test(message)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (/모레/.test(message)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 2);
    return date;
  }
  if (/글피/.test(message)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 3);
    return date;
  }

  // 요일 찾기
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (message.includes(dayName)) {
      const date = new Date(today);
      const currentDay = date.getDay();
      let daysToAdd = dayNum - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      date.setDate(date.getDate() + daysToAdd);
      return date;
    }
  }

  // N일 후
  const daysMatch = message.match(/(\d+)\s*일\s*(후|뒤)/);
  if (daysMatch) {
    const date = new Date(today);
    date.setDate(date.getDate() + parseInt(daysMatch[1], 10));
    return date;
  }

  // MM/DD 또는 M월 D일
  const dateMatch = message.match(/(\d{1,2})[\/월](\d{1,2})/);
  if (dateMatch) {
    const date = new Date(today);
    date.setMonth(parseInt(dateMatch[1], 10) - 1, parseInt(dateMatch[2], 10));
    if (date < today) date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  return null;
}

// 날짜를 YYYY-MM-DD 형식으로 포맷
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 날짜를 한국어로 포맷
export function formatDateKorean(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

/**
 * 퀘스트 재조정 액션 생성
 */
export interface RescheduleResult {
  message: string;
  messageActions: MessageAction[];
}

export class QuestActions {
  /**
   * 일정 조정 요청 처리 - 모든 에이전트에서 사용 가능
   */
  static generateRescheduleActions(
    message: string,
    todayQuests?: TodayQuests,
    plan?: StudyPlan,
  ): RescheduleResult {
    const messageActions: MessageAction[] = [];

    // 모든 퀘스트 결합
    const allQuests = [
      ...(todayQuests?.mainQuests ?? []),
      ...(todayQuests?.bonusQuests ?? []),
      ...(todayQuests?.reviewQuests ?? []),
    ];

    // 날짜 파싱
    const targetDate = parseKoreanDate(message);
    const targetDateStr = targetDate ? formatDateString(targetDate) : null;

    // 미루기 패턴 감지
    const isPostponeToday = /오늘|지금/.test(message) && /미뤄|미루|연기|못/.test(message);
    const postponeDaysMatch = message.match(/(\d+)\s*일/);
    const postponeDays = postponeDaysMatch ? parseInt(postponeDaysMatch[1], 10) : 1;

    // 퀘스트 정보 확인
    const hasQuests = allQuests.length > 0;
    const incompleteQuests = allQuests.filter(q => q.status !== 'COMPLETED');

    // 특정 날짜가 지정된 경우 (일요일, 내일 등) RESCHEDULE_QUEST 우선
    if (targetDate && hasQuests) {
      for (const quest of incompleteQuests) {
        if (quest.planId) {
          const questDate = new Date(quest.date);
          const dayNumber = Math.floor((questDate.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)) + 1;

          messageActions.push({
            id: `reschedule-${quest.planId}-${quest.id}-${Date.now()}`,
            type: 'RESCHEDULE_QUEST',
            label: `"${quest.title}" → ${formatDateKorean(targetDate)}로 이동`,
            icon: '📆',
            data: {
              planId: quest.planId,
              questId: quest.id,
              questDay: dayNumber,
              newDate: targetDateStr!,
            },
          });
        }
      }

      // 퀘스트 정보가 없어도 일반 미루기 버튼 제공
      if (messageActions.length === 0) {
        const daysToTarget = Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        messageActions.push({
          id: `postpone-to-date-${Date.now()}`,
          type: 'POSTPONE_TODAY',
          label: `${formatDateKorean(targetDate)}로 미루기`,
          icon: '📅',
          data: { daysToAdd: daysToTarget },
        });
      }
    } else if (isPostponeToday && hasQuests) {
      // 날짜 지정 없이 "오늘 퀘스트 미뤄줘" (기본 1일 또는 N일)
      messageActions.push({
        id: `postpone-today-${Date.now()}`,
        type: 'POSTPONE_TODAY',
        label: `오늘 퀘스트 ${postponeDays}일 미루기`,
        icon: '📅',
        data: { daysToAdd: postponeDays },
      });
    }

    // 응답 메시지 생성
    let responseMessage: string;

    if (!plan && !hasQuests) {
      responseMessage = '아직 활성 플랜이 없어요! 📚\n먼저 학습 계획을 만들어볼까요?';
      messageActions.push({
        id: `navigate-new-plan-${Date.now()}`,
        type: 'NAVIGATE',
        label: '새 플랜 만들기',
        icon: '➕',
        data: { navigateTo: '/new-plan' },
      });
    } else if (messageActions.length > 0) {
      const dateStr = targetDate ? formatDateKorean(targetDate) : `${postponeDays}일 뒤`;
      responseMessage = `네, ${dateStr}로 옮겨드릴게요! 📅\n아래 버튼을 눌러 확정해주세요 👇`;
    } else {
      responseMessage = '일정 조정을 도와드릴게요. 어떤 퀘스트를 언제로 옮기고 싶으신가요?';
    }

    return { message: responseMessage, messageActions };
  }

  /**
   * 일정 요약 생성 - 모든 에이전트에서 사용 가능
   */
  static generateScheduleSummary(
    plans: StudyPlan[],
    fullScheduleContext?: DirectorContext['fullScheduleContext']
  ): string {
    let summary = '📅 **학습 일정**\n\n';

    // 전체 일정 컨텍스트가 있으면 더 상세한 정보 제공
    if (fullScheduleContext?.activePlans?.length) {
      summary = '📅 **전체 학습 일정**\n\n';

      for (const plan of fullScheduleContext.activePlans) {
        const progress = Math.round((plan.completedDays / plan.totalDays) * 100);
        summary += `📚 **${plan.title}**\n`;
        summary += `   진행률: ${progress}% (${plan.completedDays}/${plan.totalDays}일)\n`;
        summary += `   기간: ${plan.startDate.slice(5)} ~ ${plan.targetEndDate.slice(5)}\n`;

        if (plan.dailyQuests?.length) {
          const upcomingQuests = plan.dailyQuests
            .filter(q => !q.completed)
            .slice(0, 3);

          if (upcomingQuests.length > 0) {
            summary += `   예정:\n`;
            for (const quest of upcomingQuests) {
              const dateStr = quest.date.slice(5, 10);
              summary += `   • ${dateStr}: ${quest.unitTitle} (${quest.range})\n`;
            }
          }
        }
        summary += '\n';
      }

      if (fullScheduleContext.weeklyStats) {
        const stats = fullScheduleContext.weeklyStats;
        summary += `📊 **이번 주 현황**\n`;
        summary += `   완료: ${stats.completedQuests}/${stats.totalQuests} (${stats.completionRate}%)\n`;
        summary += `   연속 학습: ${stats.streakDays}일\n\n`;
      }

      if (fullScheduleContext.upcomingQuests?.length) {
        summary += `🗓️ **앞으로의 일정**\n`;
        for (const day of fullScheduleContext.upcomingQuests.slice(0, 5)) {
          const dateStr = day.date.slice(5, 10);
          const questCount = day.quests.length;
          summary += `   ${dateStr}: ${questCount}개 퀘스트\n`;
        }
      }
    } else if (plans.length === 0) {
      summary += '활성 계획이 없어요. 새 계획을 세워볼까요?\n';
    } else {
      for (const plan of plans) {
        const nextSession = plan.sessions.find(s => s.status === 'PENDING');
        if (nextSession) {
          summary += `📚 **${plan.title}**\n`;
          summary += `   → ${nextSession.topic} (${nextSession.estimatedMinutes}분)\n\n`;
        }
      }
    }

    return summary;
  }

  /**
   * 일정 조정 관련 요청인지 감지
   */
  static isScheduleRequest(message: string): boolean {
    return /미뤄|미루|연기|옮겨|늦춰|당겨|일정.*변경|스케줄.*바꿔/.test(message);
  }

  /**
   * 일정 조회 요청인지 감지
   */
  static isScheduleQuery(message: string): boolean {
    return /일정|스케줄|언제|뭐.*해야|오늘.*할/.test(message);
  }

  /**
   * 플랜 생성 요청인지 감지
   */
  static isPlanCreationRequest(message: string): boolean {
    return /새|시작|만들어|계획.*세워|플랜.*생성/.test(message);
  }
}
