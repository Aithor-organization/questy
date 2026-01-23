/**
 * PlannerAgent 타입 정의
 * 플랜 생성 및 조정에 사용되는 인터페이스
 */

import type { AnalyzedUnit, DetectedStudyPlan, AIGeneratedQuest } from '../../../types/memory.js';

// 요청 유형 분류
export type PlanRequestType =
  | 'CREATE_PLAN'
  | 'ADJUST_PLAN'
  | 'CHECK_SCHEDULE'
  | 'RECOMMEND'
  | 'GENERATE_FROM_IMAGE'
  | 'GENERATE_CURRICULUM'
  | 'GENERAL';

// AI 퀘스트 생성 결과
export interface AIQuestResult {
  dailyQuests: AIGeneratedQuest[];
  recommendations: AIRecommendation[];
  totalEstimatedHours: number;
  message: string;
}

// AI 추천 정보
export interface AIRecommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

// 듀얼 플랜 결과 (기존 플랜 + 새 플랜)
export interface DualPlanResult {
  hasOriginalPlan: boolean;
  plans: import('../../../types/memory.js').GeneratedPlan[];
  recommendations: AIRecommendation[];
  message: string;
}

// 플랜 생성 요청
export interface PlanGenerationRequest {
  studentId: string;
  materialName: string;
  analyzedUnits: AnalyzedUnit[];
  detectedStudyPlan?: DetectedStudyPlan;
  targetDays: number;
  bookMetadata?: {
    subject?: string;
    targetGrade?: string;
    bookType?: string;
  };
  excludeWeekends?: boolean;
  startDate?: string; // ISO date string (YYYY-MM-DD)
}

// 개인화 정보 (과거 성과 기반)
export interface PersonalizationInfo {
  avgCompletionRate: number;
  commonDropOffDays: number[];
  optimalSessionMinutes: number;
  preferredStudyTime?: string;
}

// ===================== 커리큘럼 생성 타입 (인강 기반) =====================

// 강좌 목차 정보 (CourseContent와 호환)
export interface CurriculumCourse {
  id: string;
  courseName: string;
  lecturer?: string;
  subject: string;
  chapters: CurriculumChapter[];
  startFromChapter?: number;  // 이어듣기 시작 챕터
}

export interface CurriculumChapter {
  num?: number;
  title: string;
  duration?: string;  // "21:30" 또는 "1:13:54" 형식
  sections?: string[];
}

// 커리큘럼 생성 요청
export interface CurriculumGenerationRequest {
  studentId: string;
  courses: CurriculumCourse[];
  targetDate: string;  // ISO date string (YYYY-MM-DD)
  dailyStudyHours?: number; // @deprecated use min/max
  minDailyStudyHours?: number;
  maxDailyStudyHours?: number;
  subjectHours?: Record<string, number | { min: number; max: number } | null>;  // 과목별 일일 학습 시간 (min/max 범위 지원)
  subjectDays?: Record<string, number[]>;  // 과목별 학습 요일 (0=일, 1=월, ..., 6=토)

  // Load Awareness
  existingLoad?: Array<{
    date: string;
    totalMinutes: number;
    subjects: string[];
  }>;
  options?: {
    includeOt?: boolean;
    reviewSettings?: {
      enabled: boolean;
      sameDayReview: boolean;
      reviewDuration: number;
    };
    // 남는 날 활용 옵션 (A2 시나리오: 강의 < 가용일)
    extraDaysOption?: {
      enabled: boolean;           // 남는 날 활용 여부
      fillWithReview: boolean;    // 복습으로 채우기
      fillWithPractice: boolean;  // 문제풀이로 채우기
    };
  };
}

// 커리큘럼 퀘스트 (현재 curriculum-agent 출력 형식과 동일)
export interface CurriculumQuest {
  id: string;
  title: string;
  description: string;
  questType: 'lecture' | 'problem_set' | 'review' | 'practice' | 'mock_exam' | 'concept';
  subject: string;
  courseId: string;
  courseName: string;
  lecturer?: string;
  chapter: string;
  section?: string | null;
  scheduledDate: string;  // YYYY-MM-DD
  estimatedMinutes: number;
  originalDuration?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
  studyTips?: {
    importance: string;
    keyPoints: string[];
    studyMethod: string;
    commonMistakes?: string;
  };
  editable?: boolean;
  practiceNote?: string;
  relatedLectures?: string[];
  isChecklist?: boolean;  // 체크리스트 형식 (타이머 없음)
}

// 커리큘럼 생성 결과
export interface CurriculumGenerationResult {
  success: boolean;
  quests: CurriculumQuest[];
  summary: {
    totalQuests: number;
    totalDays: number;
    averageMinutesPerDay: number;
    subjectDistribution: Record<string, number>;
    skippedSubjects?: Array<{
      subject: string;
      hours: number;
      reason: string;
    }>;
  };
  validation?: {
    isValid: boolean;
    severity: 'valid' | 'warning' | 'invalid';
    issues: Array<{
      severity: 'valid' | 'warning' | 'invalid';
      code: string;
      message: string;
    }>;
    suggestions: string[];
  };
  review?: CurriculumReviewResult;
  message: string;
}

// 커리큘럼 검증 결과 (에이전트 리뷰)
export interface CurriculumReviewResult {
  isApproved: boolean;
  overallScore: number;  // 0-100
  summary: string;
  categories: {
    feasibility: ReviewCategory;
    balance: ReviewCategory;
    distribution: ReviewCategory;
    completeness: ReviewCategory;
  };
  highlights: string[];
  concerns: string[];
  suggestions: string[];
}

export interface ReviewCategory {
  score: number;  // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  message: string;
}
