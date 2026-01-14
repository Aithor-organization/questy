/**
 * AdmissionAgent 타입 정의
 */

import type { Subject } from '../../../types/memory.js';

// 온보딩 단계
export type OnboardingStage =
  | 'WELCOME'
  | 'COLLECT_BASIC'
  | 'COLLECT_GOALS'
  | 'COLLECT_STYLE'
  | 'COMPLETE'
  | 'GENERAL'
  | 'CLASS_ASSIGN'
  | 'ORIENTATION';

// 반 옵션
export interface ClassOption {
  id: string;
  name: string;
  description: string;
  pace: 'SLOW' | 'MEDIUM' | 'FAST';
  difficulty: 'BASIC' | 'STANDARD' | 'ADVANCED';
  features: string[];
  recommendedFor: string;
}

// 반 배정
export interface ClassAssignment {
  studentId: string;
  classId: string;
  className: string;
  assignedAt: Date;
  reason: string;
}

// 오리엔테이션 단계
export interface OrientationStep {
  id: string;
  title: string;
  description: string;
  action: string;
  completed: boolean;
}

// 오리엔테이션 진행
export interface OrientationProgress {
  studentId: string;
  steps: OrientationStep[];
  currentStep: number;
  completedSteps: number;
  totalSteps: number;
  startedAt: Date;
  completedAt?: Date;
}

// 프론트엔드 데이터
export interface FrontendData {
  extractedName?: string;
  currentInfo?: {
    name?: string;
    grade?: string;
    subjects?: string[];
    goals?: string[];
  };
}

// 단계 인스트럭션
export type StageInstructions = Record<OnboardingStage, string>;
