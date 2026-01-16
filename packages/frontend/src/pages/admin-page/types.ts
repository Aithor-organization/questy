/**
 * Admin Page - Types and Utilities
 * 타입 정의 및 헬퍼 함수
 */

import type { Teacher, Course } from '../../hooks/useAdminCourses';

// 모달 타입
export type ModalType = 'none' | 'add-teacher' | 'add-course' | 'batch-update' | 'edit-teacher' | 'edit-course';

// 뷰 탭 타입
export type ViewTab = 'by-teacher' | 'outdated' | 'inquiries';

// 문의 타입
export interface Inquiry {
  id: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 배치 업데이트 진행 상태 타입
export interface BatchUpdateProgress {
  status: 'idle' | 'running' | 'complete';
  total: number;
  completed: number;
  updated: number;
  failed: number;
  skipped: number;
  currentCourse: {
    id?: string;
    name?: string;
    teacher?: string;
    success?: boolean;
    diff?: number;
    error?: string;
  } | null;
  logs: Array<{
    name: string;
    success: boolean;
    diff?: number;
    error?: string;
  }>;
}

// 관리자 정보 타입
export interface AdminInfo {
  id: string;
  name: string;
  role: 'admin' | 'super_admin';
}

// 7일 전 타임스탬프 계산 헬퍼
export function isOutdated(lastCrawledAt: string | null | undefined): boolean {
  if (!lastCrawledAt) return true;
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return new Date(lastCrawledAt).getTime() < sevenDaysAgo;
}

// 초기 배치 진행 상태
export const initialBatchProgress: BatchUpdateProgress = {
  status: 'idle',
  total: 0,
  completed: 0,
  updated: 0,
  failed: 0,
  skipped: 0,
  currentCourse: null,
  logs: [],
};

// Re-export types
export type { Teacher, Course };
