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

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api`;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        // 🧪 하드코딩 테스트 계정 (백엔드 통신 없이 로그인)
        if (email === 'test@example.com' && password === 'password') {
          const mockUser: User = {
            id: 'test-user-id',
            email: 'test@example.com',
            name: '테스트 학생',
            studentId: 'test-student-id'
          };

          setTimeout(() => {
            set({
              user: mockUser,
              isAuthenticated: true,
              isLoading: false,
            });
            localStorage.setItem('questybook_student_id', mockUser.studentId!);
            localStorage.setItem('questybook_student_name', mockUser.name);
          }, 500); // 0.5초 딜레이로 실제 통신하는 척

          return true;
        }

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
