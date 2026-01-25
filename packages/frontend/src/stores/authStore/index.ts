/**
 * Auth Store
 * Supabase Auth 기반 인증 상태 관리
 *
 * 모듈 구조:
 * - types.ts: 타입 정의
 * - utils.ts: 유틸리티 함수
 * - initializeAuth.ts: 초기화
 * - authActions.ts: 로그인/OAuth
 * - registerAction.ts: 회원가입
 * - logoutAction.ts: 로그아웃
 * - profileActions.ts: 프로필 업데이트
 * - onboardingActions.ts: 온보딩/학습 프로필
 * - membershipActions.ts: 멤버십
 * - sessionHelpers.ts: 세션 관리
 * - authStateListener.ts: 인증 상태 리스너
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';

import type { AuthStore, UserProfile, MembershipData } from './types';
import { initializeAuth } from './initializeAuth';
import { login, loginWithGoogle } from './authActions';
import { register } from './registerAction';
import { logout } from './logoutAction';
import { updateProfile } from './profileActions';
import { checkOnboardingStatus, loadUserProfile } from './onboardingActions';
import { loadMembership } from './membershipActions';
import { revalidateSessionInternal } from './sessionHelpers';

// Re-export types for backward compatibility
export type {
  User,
  UserProfile,
  MembershipType,
  MembershipStatus,
  MembershipData,
} from './types';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // 상태 초기값
      user: null,
      session: null,
      userProfile: null,
      membershipData: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      needsOnboarding: false,

      // 초기화
      initializeAuth: () => initializeAuth(set, get),

      // 인증 액션
      login: (email, password, rememberMe = false) => login(email, password, rememberMe, set, get),
      register: (email, password, name) => register(email, password, name, set, get),
      loginWithGoogle: () => loginWithGoogle(set),
      logout: () => logout(set),

      // 에러/세션
      clearError: () => set({ error: null }),
      setSession: (session: Session | null) => set({ session }),

      // 프로필
      updateProfile: (updates) => updateProfile(updates, get, set),
      syncName: (name: string) => {
        const currentUser = get().user;
        if (currentUser && currentUser.name !== name) {
          set({ user: { ...currentUser, name } });
        }
      },

      // 온보딩
      checkOnboardingStatus: () => checkOnboardingStatus(get, set),
      setOnboardingCompleted: (completed: boolean) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, onboardingCompleted: completed },
            ...(completed ? { needsOnboarding: false } : {}),
          });
        }
      },
      clearNeedsOnboarding: () => set({ needsOnboarding: false }),

      // 프로필/멤버십
      loadUserProfile: () => loadUserProfile(get, set),
      setUserProfile: (profile: UserProfile | null) => set({ userProfile: profile }),
      loadMembership: () => loadMembership(get, set),
      setMembershipData: (data: MembershipData | null) => set({ membershipData: data }),

      // 세션
      revalidateSession: () => revalidateSessionInternal(get, set),
    }),
    {
      name: 'questybook-auth',
      partialize: (state) => ({
        user: state.user,
        userProfile: state.userProfile,
        membershipData: state.membershipData,
      }),
    }
  )
);
