/**
 * 날짜 파싱 및 포맷팅 유틸리티
 * 한국어 날짜 표현 파싱 지원
 */

// 요일 이름 상수
const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DAY_SHORT_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 한국어 날짜 표현을 파싱하여 Date 객체 반환
 * 예: "일요일", "내일", "모레", "다음주 월요일", "3일 뒤"
 */
export function parseKoreanDate(message: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 요일 파싱 (일요일, 월요일, ...)
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (message.includes(DAY_NAMES[i]) || new RegExp(`${DAY_SHORT_NAMES[i]}요일`).test(message)) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // 다음 주로
      }
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      return result;
    }
  }

  // "내일"
  if (/내일/.test(message)) {
    const result = new Date(today);
    result.setDate(today.getDate() + 1);
    return result;
  }

  // "모레"
  if (/모레/.test(message)) {
    const result = new Date(today);
    result.setDate(today.getDate() + 2);
    return result;
  }

  // "N일 뒤/후" 또는 "N일 미뤄"
  const daysMatch = message.match(/(\d+)\s*일\s*(뒤|후|미뤄|미루|연기)/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const result = new Date(today);
    result.setDate(today.getDate() + days);
    return result;
  }

  // "다음주"
  if (/다음\s*주/.test(message)) {
    const result = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    result.setDate(today.getDate() + daysUntilMonday);
    return result;
  }

  // "이번주 토요일/일요일" 등
  if (/이번\s*주/.test(message)) {
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (message.includes(DAY_NAMES[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        const daysToAdd = targetDay - currentDay;
        if (daysToAdd < 0) {
          return null; // 이번주에 이미 지난 요일
        }
        const result = new Date(today);
        result.setDate(today.getDate() + daysToAdd);
        return result;
      }
    }
  }

  // "오늘"
  if (/오늘/.test(message)) {
    return new Date(today);
  }

  return null;
}

/**
 * Date를 YYYY-MM-DD 형식 문자열로 변환
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 주말을 건너뛰고 N번째 평일 날짜를 계산
 */
export function getNextWeekday(startDate: Date, daysToAdd: number, excludeWeekends: boolean): Date {
  const result = new Date(startDate);

  if (!excludeWeekends) {
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  let addedDays = 0;
  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = 일요일, 6 = 토요일
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

/**
 * 날짜를 한국어 형식으로 포맷 (예: "1/15(월)")
 */
export function formatDateKorean(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = DAY_SHORT_NAMES[date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}
