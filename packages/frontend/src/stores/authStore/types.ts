/**
 * Auth Store Types
 * 인증 관련 타입 정의
 */

import type { Session } from '@supabase/supabase-js';

// 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name: string;
  studentId: string | null;
  isAdmin?: boolean;
  onboardingCompleted?: boolean;
}

// 학습 프로필 인터페이스 (온보딩에서 수집한 정보)
export interface UserProfile {
  age: number | null;
  examYear: number;  // 0=현역, 1=재수, 2=삼수, 3=그 이상
  targetUniversity: string;
  targetGrades: Record<string, number>;  // {"국어": 1, "수학": 2, ...}
  currentGrades: Record<string, number>;
  selectedTamgu1: string;
  selectedTamgu2: string;
  subscribedPlatforms: string[];
  dailyStudyHours: number;
}

// 멤버십 데이터 인터페이스
// pending: 승인 대기자 (신규 가입)
// regular: 일반인 (체험판 만료 후 강등)
// beta_tester: 베타테스터 (7일 체험판)
// lab_member: 실험단 (무기한)
export type MembershipType = 'pending' | 'regular' | 'beta_tester' | 'lab_member';
export type MembershipStatus = 'pending' | 'active' | 'expired' | 'revoked';

export interface MembershipData {
  type: MembershipType;
  status: MembershipStatus;
  approvedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  isExpired: boolean;
}

// Auth Store 상태 인터페이스
export interface AuthState {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  membershipData: MembershipData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  needsOnboarding: boolean;
}

// Auth Store 액션 인터페이스
export interface AuthActions {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setSession: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
  updateProfile: (updates: { name?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  syncName: (name: string) => void;
  checkOnboardingStatus: () => Promise<boolean>;
  setOnboardingCompleted: (completed: boolean) => void;
  clearNeedsOnboarding: () => void;
  loadUserProfile: () => Promise<UserProfile | null>;
  setUserProfile: (profile: UserProfile | null) => void;
  loadMembership: () => Promise<MembershipData | null>;
  setMembershipData: (data: MembershipData | null) => void;
  revalidateSession: () => Promise<void>;
}

// 전체 Auth Store 인터페이스
export interface AuthStore extends AuthState, AuthActions {}

// 내부 유틸리티 타입
export type SetState = (partial: Partial<AuthStore> | ((state: AuthStore) => Partial<AuthStore>)) => void;
export type GetState = () => AuthStore;
