/**
 * Admin Page - Types and Utilities
 * 타입 정의 및 헬퍼 함수
 */

import type { Teacher, Course } from '../../hooks/useAdminCourses';

// 모달 타입
export type ModalType = 'none' | 'add-teacher' | 'add-course' | 'batch-update' | 'edit-teacher' | 'edit-course';

// 뷰 탭 타입
export type ViewTab = 'by-teacher' | 'outdated' | 'inquiries' | 'users' | 'learning-profiles';

// 학습 프로필 타입
export interface UserLearningProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  profile: {
    age: number | null;
    examYear: number;
    targetUniversity: string | null;
    targetGrades: Record<string, number> | null;
    currentGrades: Record<string, number> | null;
    selectedTamgu1: string | null;
    selectedTamgu2: string | null;
    subscribedPlatforms: string[] | null;
    dailyStudyHours: number | null;
    onboardingCompleted: boolean;
    onboardingCompletedAt: string | null;
    referralSource: string | null; // 유입 경로
    referralSourceDetail: string | null; // 기타 커뮤니티 상세
  } | null;
  membership: {
    type: MembershipType;
    status: MembershipStatus;
  } | null;
}

// 멤버십 타입
// pending: 승인 대기자 (신규 가입)
// regular: 일반인 (체험판 만료 후 강등)
// beta_tester: 베타테스터 (7일 체험판)
// lab_member: 실험단 (무기한)
export type MembershipType = 'pending' | 'regular' | 'beta_tester' | 'lab_member';
export type MembershipStatus = 'pending' | 'active' | 'expired' | 'revoked';

// 사용자 멤버십 정보
export interface UserMembership {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  lastLoginAt?: string | null;  // 마지막 로그인 시간
  referralSource?: string | null;  // 유입 경로
  membership: {
    type: MembershipType;
    status: MembershipStatus;
    approvedAt: string | null;
    expiresAt: string | null;
    adminNote: string | null;
  } | null;
}

// 유입 경로 옵션
export const REFERRAL_SOURCE_OPTIONS = [
  { value: 'orbi', label: '오르비' },
  { value: 'everytime', label: '에브리타임' },
  { value: 'instagram', label: '인스타그램' },
  { value: 'youtube', label: '유튜브' },
  { value: 'friend', label: '지인 추천' },
  { value: 'search', label: '검색 (구글/네이버)' },
  { value: 'other', label: '기타' },
] as const;

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
