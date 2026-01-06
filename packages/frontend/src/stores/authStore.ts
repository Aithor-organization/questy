/**
 * Auth Store
 * 인증 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name: string;
  studentId: string | null;
}

interface AuthStore {
  // 상태
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 액션
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => void;
}

const API_URL = 'http://localhost:3001/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (data.success) {
            const user = data.data.user;
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });

            // localStorage에 학생 정보 저장 (기존 앱 호환성)
            if (user.studentId) {
              localStorage.setItem('questybook_student_id', user.studentId);
              localStorage.setItem('questybook_student_name', user.name);
            }

            return true;
          } else {
            set({ error: data.error, isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: '서버 연결에 실패했습니다', isLoading: false });
          return false;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          });

          const data = await response.json();

          if (data.success) {
            const user = data.data.user;
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });

            // localStorage에 학생 정보 저장 (기존 앱 호환성)
            if (user.studentId) {
              localStorage.setItem('questybook_student_id', user.studentId);
              localStorage.setItem('questybook_student_name', user.name);
            }

            return true;
          } else {
            set({ error: data.error, isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: '서버 연결에 실패했습니다', isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
        localStorage.removeItem('questybook_student_id');
        localStorage.removeItem('questybook_student_name');
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: () => {
        const { user } = get();
        if (user) {
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: 'questybook-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
