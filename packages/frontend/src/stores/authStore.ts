/**
 * Auth Store
 * Supabase Auth 기반 인증 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name: string;
  studentId: string | null;
  isAdmin?: boolean;
  onboardingCompleted?: boolean;
}

interface AuthStore {
  // 상태
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 액션
  login: (email: string, password: string) => Promise<boolean>;
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
}

// Supabase User를 앱 User로 변환
function mapSupabaseUser(supabaseUser: SupabaseUser, studentId?: string): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || '학생',
    studentId: studentId || null,
    isAdmin: supabaseUser.email === 'admin@questybook.com',
  };
}

// 세션 검증 타임아웃 (ms)
const AUTH_TIMEOUT = 3000;

// 백그라운드 세션 검증 상태
let isVerifyingSession = false;

// 타입 정의
type SetState = (partial: Partial<AuthStore> | ((state: AuthStore) => Partial<AuthStore>)) => void;
type GetState = () => AuthStore;

// 백그라운드 세션 검증 (낙관적 로딩 후 실행)
async function verifySessionInBackground(set: SetState, get: GetState): Promise<void> {
  if (isVerifyingSession || !supabase) return;
  isVerifyingSession = true;

  try {
    console.log('[Auth] 🔄 Background: Verifying session...');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      // 세션 만료 - 로그아웃 처리
      console.warn('[Auth] ⚠️ Background: Session invalid, logging out');
      set({ user: null, session: null, isAuthenticated: false });
      localStorage.removeItem('questybook_student_id');
      localStorage.removeItem('questybook_student_name');
      return;
    }

    // 세션 유효 - 최신 정보로 업데이트
    const currentUser = get().user;
    const user = mapSupabaseUser(session.user, currentUser?.studentId || undefined);
    set({ user, session });

    // studentId가 없으면 조회
    if (!currentUser?.studentId) {
      fetchStudentIdInBackground(session.user.id, set, get);
    }

    // 리스너 등록
    setupAuthStateListener(set);

    console.log('[Auth] ✅ Background: Session verified');
  } catch (err) {
    console.error('[Auth] Background verification error:', err);
  } finally {
    isVerifyingSession = false;
  }
}

// 백그라운드 studentId 조회
async function fetchStudentIdInBackground(userId: string, set: SetState, get: GetState): Promise<void> {
  if (!supabase) return;

  try {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (student?.id) {
      const currentUser = get().user;
      if (currentUser) {
        set({ user: { ...currentUser, studentId: student.id } });
        localStorage.setItem('questybook_student_id', student.id);
        console.log('[Auth] 📝 Background: studentId updated');
      }
    }
  } catch (e) {
    console.warn('[Auth] Background: Student lookup failed:', e);
  }
}

// 인증 상태 변경 리스너 설정
function setupAuthStateListener(set: SetState): void {
  if (!supabase) return;

  const client = supabase; // TypeScript null 체크용

  client.auth.onAuthStateChange(async (event, newSession) => {
    console.log('[Auth] State changed:', event);

    if (event === 'SIGNED_IN' && newSession?.user) {
      let studentId: string | null = null;
      try {
        const { data: student } = await client
          .from('students')
          .select('id')
          .eq('user_id', newSession.user.id)
          .single();

        if (!student) {
          // 새 사용자: students 레코드 생성
          const userName = newSession.user.user_metadata?.name ||
                           newSession.user.email?.split('@')[0] || '학생';
          const { data: newStudent } = await client
            .from('students')
            .insert({ user_id: newSession.user.id, name: userName })
            .select('id')
            .single();
          studentId = newStudent?.id || null;
        } else {
          studentId = student.id;
        }
      } catch (e) {
        console.warn('[Auth] Student handling error:', e);
      }

      const user = mapSupabaseUser(newSession.user, studentId || undefined);
      set({
        user,
        session: newSession,
        isAuthenticated: true,
        isLoading: false,
      });

      if (studentId) {
        localStorage.setItem('questybook_student_id', studentId);
      }
      localStorage.setItem('questybook_student_name', user.name);
    } else if (event === 'SIGNED_OUT') {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
      localStorage.removeItem('questybook_student_id');
      localStorage.removeItem('questybook_student_name');
    } else if (event === 'TOKEN_REFRESHED' && newSession) {
      set({ session: newSession });
    }
  });
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Supabase Auth 초기화 (앱 시작 시 호출) - 최적화 버전
      initializeAuth: async () => {
        const startTime = performance.now();
        console.log('[Auth] initializeAuth started');

        // Supabase 미설정 시 즉시 반환
        if (!supabase) {
          console.warn('[Auth] Supabase not configured, using mock auth');
          set({ isLoading: false });
          return;
        }

        // 🚀 낙관적 로딩: persist된 user가 있으면 즉시 표시
        const persistedUser = get().user;
        if (persistedUser) {
          console.log('[Auth] 🚀 Optimistic: Using persisted user:', persistedUser.email);
          set({ isAuthenticated: true, isLoading: false });

          // 백그라운드에서 세션 검증 (UI 블로킹 없음)
          verifySessionInBackground(set, get);
          return;
        }

        // persist된 user가 없으면 세션 체크 (타임아웃 적용)
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), AUTH_TIMEOUT)
          );

          console.log('[Auth] Checking session with timeout...');
          const result = await Promise.race([sessionPromise, timeoutPromise]);

          // 타임아웃 발생
          if (result === null) {
            console.warn('[Auth] ⏱️ Session check timeout, showing login');
            set({ isLoading: false, user: null, session: null, isAuthenticated: false });
            return;
          }

          const { data: { session }, error: sessionError } = result;

          if (sessionError) {
            console.error('[Auth] Session error:', sessionError);
            set({ isLoading: false, user: null, session: null, isAuthenticated: false });
            return;
          }

          if (session?.user) {
            console.log('[Auth] Session found for:', session.user.email);

            // 즉시 기본 user 정보로 로그인 처리 (studentId는 백그라운드에서)
            const user = mapSupabaseUser(session.user);
            set({
              user,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
            localStorage.setItem('questybook_student_name', user.name);

            // studentId는 백그라운드에서 조회
            fetchStudentIdInBackground(session.user.id, set, get);
          } else {
            console.log('[Auth] No session found');
            set({ isLoading: false, user: null, session: null, isAuthenticated: false });
          }

          // 인증 상태 변경 리스너 등록
          setupAuthStateListener(set);

          const elapsed = performance.now() - startTime;
          console.log(`[Auth] ✅ Init completed in ${elapsed.toFixed(0)}ms`);

        } catch (err) {
          console.error('[Auth] Init error:', err);
          set({ isLoading: false, user: null, session: null, isAuthenticated: false });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        // Supabase 미설정 시 테스트 계정
        if (!supabase) {
          if (email === 'test@example.com' && password === 'password') {
            const mockUser: User = {
              id: 'test-user-id',
              email: 'test@example.com',
              name: '테스트 학생',
              studentId: 'test-student-id',
            };

            setTimeout(() => {
              set({
                user: mockUser,
                isAuthenticated: true,
                isLoading: false,
              });
              localStorage.setItem('questybook_student_id', mockUser.studentId!);
              localStorage.setItem('questybook_student_name', mockUser.name);
            }, 500);

            return true;
          }
          set({ error: '서버 연결에 실패했습니다', isLoading: false });
          return false;
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            let errorMessage = '로그인에 실패했습니다';
            if (error.message.includes('Invalid login credentials')) {
              errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다';
            } else if (error.message.includes('Email not confirmed')) {
              errorMessage = '이메일 인증이 필요합니다. 메일함을 확인해주세요';
            }
            set({ error: errorMessage, isLoading: false });
            return false;
          }

          if (data.user) {
            // students 테이블에서 student_id 조회
            const { data: student } = await supabase
              .from('students')
              .select('id')
              .eq('user_id', data.user.id)
              .single();

            const user = mapSupabaseUser(data.user, student?.id);

            set({
              user,
              session: data.session,
              isAuthenticated: true,
              isLoading: false,
            });

            if (student?.id) {
              localStorage.setItem('questybook_student_id', student.id);
            }
            localStorage.setItem('questybook_student_name', user.name);

            return true;
          }

          set({ isLoading: false });
          return false;
        } catch (err) {
          console.error('[Auth] Login error:', err);
          set({ error: '서버 연결에 실패했습니다', isLoading: false });
          return false;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });

        if (!supabase) {
          set({ error: 'Supabase가 설정되지 않았습니다', isLoading: false });
          return false;
        }

        try {
          // 1. Supabase Auth에 사용자 생성 (이메일 인증 비활성화)
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo: undefined, // 이메일 인증 리다이렉트 비활성화
            },
          });

          if (error) {
            let errorMessage = '회원가입에 실패했습니다';
            if (error.message.includes('already registered')) {
              errorMessage = '이미 등록된 이메일입니다';
            } else if (error.message.includes('Password')) {
              errorMessage = '비밀번호는 최소 6자 이상이어야 합니다';
            }
            set({ error: errorMessage, isLoading: false });
            return false;
          }

          if (data.user && data.session) {
            // 2. students 테이블에 프로필 생성
            const { data: student, error: studentError } = await supabase
              .from('students')
              .insert({
                user_id: data.user.id,
                name,
              })
              .select('id')
              .single();

            if (studentError) {
              console.error('[Auth] Student creation error:', studentError);
            }

            // 3. student_progress 초기화
            if (student?.id) {
              await supabase.from('student_progress').insert({
                student_id: student.id,
              });
            }

            // 회원가입 성공 - 자동 로그인 상태 유지 (온보딩으로 이동)
            const user = mapSupabaseUser(data.user, student?.id);
            user.onboardingCompleted = false; // 새 사용자는 온보딩 미완료

            set({
              user,
              session: data.session,
              isAuthenticated: true,
              isLoading: false,
            });

            if (student?.id) {
              localStorage.setItem('questybook_student_id', student.id);
            }
            localStorage.setItem('questybook_student_name', user.name);

            return true;
          }

          // 이메일 인증이 필요한 경우 (Supabase 설정에 따라)
          if (data.user && !data.session) {
            set({
              error: '이메일 인증이 필요합니다. Supabase 대시보드에서 이메일 인증을 비활성화해주세요.',
              isLoading: false
            });
            return false;
          }

          set({ isLoading: false });
          return false;
        } catch (err) {
          console.error('[Auth] Register error:', err);
          set({ error: '서버 연결에 실패했습니다', isLoading: false });
          return false;
        }
      },

      loginWithGoogle: async () => {
        if (!supabase) {
          set({ error: 'Supabase가 설정되지 않았습니다' });
          return false;
        }

        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/`,
            },
          });

          if (error) {
            set({ error: 'Google 로그인에 실패했습니다' });
            return false;
          }

          return true;
        } catch (err) {
          console.error('[Auth] Google login error:', err);
          set({ error: 'Google 로그인에 실패했습니다' });
          return false;
        }
      },

      logout: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }

        set({ user: null, session: null, isAuthenticated: false, error: null });
        localStorage.removeItem('questybook_student_id');
        localStorage.removeItem('questybook_student_name');
      },

      clearError: () => {
        set({ error: null });
      },

      setSession: (session: Session | null) => {
        set({ session });
      },

      updateProfile: async (updates: { name?: string; password?: string }) => {
        if (!supabase) {
          return { success: false, error: 'Supabase가 설정되지 않았습니다' };
        }

        try {
          const currentUser = useAuthStore.getState().user;
          if (!currentUser) {
            return { success: false, error: '로그인이 필요합니다' };
          }

          // 1. 비밀번호 변경
          if (updates.password) {
            const { error: passwordError } = await supabase.auth.updateUser({
              password: updates.password,
            });

            if (passwordError) {
              console.error('[Auth] Password update error:', passwordError);
              return { success: false, error: '비밀번호 변경에 실패했습니다' };
            }
          }

          // 2. 이름 변경
          if (updates.name && updates.name !== currentUser.name) {
            // Supabase Auth user_metadata 업데이트
            const { error: metaError } = await supabase.auth.updateUser({
              data: { name: updates.name },
            });

            if (metaError) {
              console.error('[Auth] Metadata update error:', metaError);
              return { success: false, error: '이름 변경에 실패했습니다' };
            }

            // students 테이블 업데이트
            if (currentUser.studentId) {
              const { error: studentError } = await supabase
                .from('students')
                .update({ name: updates.name })
                .eq('id', currentUser.studentId);

              if (studentError) {
                console.error('[Auth] Student name update error:', studentError);
              }
            }

            // 로컬 상태 업데이트
            const updatedUser = { ...currentUser, name: updates.name };
            set({ user: updatedUser });
            localStorage.setItem('questybook_student_name', updates.name);
          }

          return { success: true };
        } catch (err) {
          console.error('[Auth] Update profile error:', err);
          return { success: false, error: '프로필 업데이트에 실패했습니다' };
        }
      },

      // 백엔드에서 받은 이름으로 로컬 상태 동기화 (API 호출 없이)
      syncName: (name: string) => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.name !== name) {
          console.log('[Auth] 이름 동기화:', currentUser.name, '→', name);
          set({ user: { ...currentUser, name } });
        }
      },

      // 온보딩 완료 여부 확인
      checkOnboardingStatus: async () => {
        const currentUser = get().user;
        if (!currentUser || !supabase) {
          return false;
        }

        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('id', currentUser.id)
            .single();

          if (error) {
            // 프로필이 없으면 온보딩 미완료
            console.log('[Auth] No profile found, onboarding needed');
            return false;
          }

          const completed = data?.onboarding_completed || false;
          set({ user: { ...currentUser, onboardingCompleted: completed } });
          return completed;
        } catch (err) {
          console.error('[Auth] Check onboarding error:', err);
          return false;
        }
      },

      // 온보딩 완료 상태 설정
      setOnboardingCompleted: (completed: boolean) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, onboardingCompleted: completed } });
        }
      },
    }),
    {
      name: 'questybook-auth',
      // isAuthenticated는 저장하지 않음 - 항상 Supabase 세션 기준으로 판단
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);
