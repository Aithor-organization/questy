/**
 * 일정 관련 유틸리티
 */

import type { StudyPlan } from '../../../../types/agent.js';
import type { TodayQuests } from '../../../../types/quest.js';
import type { RescheduleOption, ScheduleModifier } from '../../../../quest/index.js';

/**
 * 메시지에서 건너뛸 일수 파싱
 */
export function parseSkipDaysFromMessage(message: string): number {
  // "3일", "며칠", "일주일" 등 파싱
  const dayMatch = message.match(/(\d+)\s*일/);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10);
  }

  // 특정 키워드
  if (/일주일|1주/.test(message)) return 7;
  if (/이틀|2일|내일.*모레/.test(message)) return 2;
  if (/사흘|3일/.test(message)) return 3;
  if (/나흘|4일/.test(message)) return 4;
  if (/닷새|5일/.test(message)) return 5;
  if (/내일/.test(message)) return 1;

  return 0;
}

/**
 * 날짜 범위 생성
 */
export function generateDateRange(days: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i + 1); // 내일부터
    dates.push(date);
  }

  return dates;
}

/**
 * 메시지에서 일정 변경 요청 파싱 및 옵션 생성
 */
export function generateRescheduleOptionsFromMessage(
  message: string,
  studentId: string,
  activePlans: StudyPlan[],
  todayQuests: TodayQuests | null,
  scheduleModifier: ScheduleModifier
): RescheduleOption[] {
  const skipDays = parseSkipDaysFromMessage(message);

  if (skipDays === 0) {
    // 기본값: 3일
    return scheduleModifier.generateRescheduleOptions(
      { studentId, skipDays: generateDateRange(3) },
      activePlans,
      todayQuests
    );
  }

  const skipDates = generateDateRange(skipDays);

  return scheduleModifier.generateRescheduleOptions(
    { studentId, skipDays: skipDates },
    activePlans,
    todayQuests
  );
}
