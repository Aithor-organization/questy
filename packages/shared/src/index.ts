// 타입 및 스키마 내보내기
export * from './types';

// 유틸리티 함수
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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
