// 타입 및 스키마 내보내기
export * from './types';

// 유틸리티 함수
/**
 * 날짜를 YYYY-MM-DD 형식으로 변환 (한국 시간 기준)
 * toISOString()은 UTC 기준이므로, 한국 시간대에서는 자정~오전 9시 사이에 전날로 표시됨
 * 따라서 명시적으로 Asia/Seoul 타임존 사용
 */
export function formatDate(date: Date): string {
  // 한국 시간대 기준으로 날짜 포맷
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
