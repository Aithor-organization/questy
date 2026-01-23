/**
 * Generate Page Types
 * 퀘스트 생성 페이지 타입 정의
 */

export interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

export type InputMode = 'upload' | 'search' | 'manual';

export type GenerateStep = 'upload' | 'result';

// Beta 커리큘럼 관련 타입
export type BetaStep = 'status' | 'schedule' | 'courses' | 'preview';

// 과목별 시간 범위 (min~max)
export interface SubjectHoursRange {
  [subject: string]: {
    min: number;
    max: number;
  };
}

// 충돌 분석 결과
export interface ConflictAnalysis {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  existingHours: number;
  availableHours: number;
  newPlanMin: number;
  newPlanMax: number;
  conflictLevel: 'none' | 'partial' | 'severe';
  suggestion: string;
}

// 기존 플랜 요약 (충돌 감지용)
export interface ExistingPlanSummary {
  id: string;
  name: string;
  days: string[];
  dailyHours: number;
  totalHours: number;
}

// 강좌 관계 분석 (순차/병행)
export interface CourseRelation {
  courseA: string;
  courseB: string;
  relation: 'sequential' | 'parallel' | 'unknown';
  confidence: number;
  reason: string;
}
