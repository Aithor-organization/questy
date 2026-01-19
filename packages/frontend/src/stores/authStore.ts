/**
 * Auth Store
 * Supabase Auth 기반 인증 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { clearStudentIdCache } from '../lib/chat-api';
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

interface AuthStore {
  // 상태
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;  // 학습 프로필 (온보딩 데이터)
  membershipData: MembershipData | null;  // 멤버십 정보
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  needsOnboarding: boolean;  // 회원가입 직후에만 true (세션 동안만 유지)

  // 액션
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
  clearNeedsOnboarding: () => void;  // 온보딩 완료 후 플래그 초기화
  loadUserProfile: () => Promise<UserProfile | null>;  // 학습 프로필 로드
  setUserProfile: (profile: UserProfile | null) => void;  // 프로필 업데이트
  loadMembership: () => Promise<MembershipData | null>;  // 멤버십 로드
  setMembershipData: (data: MembershipData | null) => void;  // 멤버십 업데이트
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

// 리스너 등록 상태 (중복 등록 방지)
let isListenerRegistered = false;

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
  } catch (err: any) {
    // AbortError는 React StrictMode 또는 빠른 언마운트로 인한 정상적인 취소
    if (err?.name === 'AbortError') {
      console.log('[Auth] Background verification cancelled');
      return;
    }
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

// 인증 상태 변경 리스너 설정 (중복 등록 방지)
function setupAuthStateListener(set: SetState): void {
  if (!supabase) return;

  // 이미 리스너가 등록되어 있으면 중복 등록 방지
  if (isListenerRegistered) {
    console.log('[Auth] Listener already registered, skipping');
    return;
  }
  isListenerRegistered = true;
  console.log('[Auth] Setting up auth state listener');

  const client = supabase; // TypeScript null 체크용

  client.auth.onAuthStateChange(async (event, newSession) => {
    console.log('[Auth] State changed:', event);

    if (event === 'SIGNED_IN' && newSession?.user) {
      let studentId: string | null = null;
      let isNewUser = false; // 신규 사용자 여부 추적
      try {
        const { data: student } = await client
          .from('students')
          .select('id')
          .eq('user_id', newSession.user.id)
          .single();

        if (!student) {
          // 새 사용자: students 레코드 생성
          isNewUser = true;
          const userName = newSession.user.user_metadata?.name ||
                           newSession.user.email?.split('@')[0] || '학생';
          const { data: newStudent } = await client
            .from('students')
            .insert({ user_id: newSession.user.id, name: userName })
            .select('id')
            .single();
          studentId = newStudent?.id || null;

          // 신규 사용자: student_progress와 user_memberships 병렬 생성 (성능 최적화)
          if (studentId) {
            await Promise.all([
              client.from('student_progress').insert({
                student_id: studentId,
              }),
              client.from('user_memberships').insert({
                user_id: newSession.user.id,
                membership_type: 'pending',
                status: 'pending',
              }),
            ]);
            console.log('[Auth] New OAuth user: student_progress & user_memberships created (parallel)');
          }
        } else {
          studentId = student.id;
        }
      } catch (e) {
        console.warn('[Auth] Student handling error:', e);
      }

      const user = mapSupabaseUser(newSession.user, studentId || undefined);
      // 신규 사용자는 온보딩 미완료 상태로 설정
      if (isNewUser) {
        user.onboardingCompleted = false;
      }
      set({
        user,
        session: newSession,
        isAuthenticated: true,
        isLoading: false,
        ...(isNewUser && { needsOnboarding: true }),  // 신규 가입 시에만 온보딩 표시
      });

      if (studentId) {
        localStorage.setItem('questybook_student_id', studentId);
      }
      localStorage.setItem('questybook_student_name', user.name);

      // OAuth 로그인 시 자동로그인 설정 처리
      const pendingRememberMe = localStorage.getItem('questybook_pending_remember_me');
      if (pendingRememberMe === 'true') {
        // 30일 자동로그인 설정
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        localStorage.setItem('questybook_remember_me', 'true');
        localStorage.setItem('questybook_remember_expires', expiresAt.toString());
        localStorage.removeItem('questybook_pending_remember_me');
        console.log('[Auth] OAuth 자동로그인 설정됨 (30일)');
      } else {
        // 자동로그인 미설정 - 세션 마커만
        localStorage.removeItem('questybook_remember_me');
        localStorage.removeItem('questybook_remember_expires');
        localStorage.removeItem('questybook_pending_remember_me');
        sessionStorage.setItem('questybook_session_active', 'true');
      }
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
      userProfile: null,
      membershipData: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      needsOnboarding: false,  // 회원가입 시에만 true로 설정됨

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

        // 자동로그인 체크
        const rememberMe = localStorage.getItem('questybook_remember_me');
        const rememberExpires = localStorage.getItem('questybook_remember_expires');
        const sessionActive = sessionStorage.getItem('questybook_session_active');

        // 자동로그인이 설정되어 있고 만료되었으면 로그아웃
        if (rememberMe === 'true' && rememberExpires) {
          const expiresAt = parseInt(rememberExpires, 10);
          if (Date.now() > expiresAt) {
            console.log('[Auth] 자동로그인 만료됨 - 로그아웃 처리');
            await supabase.auth.signOut();
            localStorage.removeItem('questybook_remember_me');
            localStorage.removeItem('questybook_remember_expires');
            set({ isLoading: false, user: null, session: null, isAuthenticated: false });
            return;
          }
        }

        // 자동로그인이 아닌데 브라우저가 닫혔다가 열렸으면 (sessionActive 없음)
        // 단, 모바일에서 새로고침 시 sessionStorage가 초기화될 수 있으므로
        // Supabase 세션이 유효하면 로그아웃하지 않음
        if (!rememberMe && !sessionActive) {
          const persistedUser = get().user;
          if (persistedUser) {
            // Supabase 세션 먼저 확인 (모바일 새로고침 대응)
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!currentSession) {
              // Supabase 세션도 없으면 진짜 로그아웃
              console.log('[Auth] 자동로그인 미설정 & 세션 없음 - 로그아웃 처리');
              await supabase.auth.signOut();
              set({ isLoading: false, user: null, session: null, isAuthenticated: false });
              localStorage.removeItem('questybook-auth');
              return;
            }
            // Supabase 세션이 유효하면 sessionStorage 복구하고 계속 진행
            console.log('[Auth] 모바일 새로고침 감지 - 세션 유지');
            sessionStorage.setItem('questybook_session_active', 'true');
          }
        }

        // 🚀 낙관적 로딩: persist된 user가 있으면 즉시 표시
        const persistedUser = get().user;
        if (persistedUser) {
          console.log('[Auth] 🚀 Optimistic: Using persisted user:', persistedUser.email);
          set({ isAuthenticated: true, isLoading: false });

          // 세션 마커 설정 (자동로그인 아닌 경우)
          if (!rememberMe) {
            sessionStorage.setItem('questybook_session_active', 'true');
          }

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

      login: async (email: string, password: string, rememberMe: boolean = false) => {
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

            // 자동로그인 설정 저장
            if (rememberMe) {
              // 30일 후 만료 시간 저장
              const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
              localStorage.setItem('questybook_remember_me', 'true');
              localStorage.setItem('questybook_remember_expires', expiresAt.toString());
            } else {
              // 자동로그인 해제 - 세션 마커만 설정 (브라우저 닫으면 사라짐)
              localStorage.removeItem('questybook_remember_me');
              localStorage.removeItem('questybook_remember_expires');
              sessionStorage.setItem('questybook_session_active', 'true');
            }

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

            // 3. student_progress와 user_memberships 병렬 생성 (성능 최적화)
            if (student?.id) {
              await Promise.all([
                supabase.from('student_progress').insert({
                  student_id: student.id,
                }),
                supabase.from('user_memberships').insert({
                  user_id: data.user.id,
                  membership_type: 'pending',
                  status: 'pending',
                }),
              ]);
              console.log('[Auth] New user: student_progress & user_memberships created (parallel)');
            }

            // 회원가입 성공 - 자동 로그인 상태 유지 (온보딩으로 이동)
            const user = mapSupabaseUser(data.user, student?.id);
            user.onboardingCompleted = false; // 새 사용자는 온보딩 미완료

            set({
              user,
              session: data.session,
              isAuthenticated: true,
              isLoading: false,
              needsOnboarding: true,  // 회원가입 시에만 온보딩 표시
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
        console.log('[Auth] 로그아웃 시작 - 모든 데이터 정리');

        // 0. chat-api 캐시 정리 (다른 사용자 데이터 누수 방지)
        clearStudentIdCache();

        // 1. Supabase 세션 종료
        if (supabase) {
          await supabase.auth.signOut();
        }

        // 2. Zustand 상태 초기화
        set({
          user: null,
          session: null,
          userProfile: null,
          membershipData: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        // 3. 모든 localStorage 데이터 삭제
        const keysToRemove = [
          // 사용자 정보
          'questybook_student_id',
          'questybook_student_name',
          'questybook_last_user_id',
          // 자동로그인 관련
          'questybook_remember_me',
          'questybook_remember_expires',
          // 캐시 데이터
          'questybook-chat-storage-v2',
          'questybook-storage',
          'questybook-auth',
          // 세션/대화 관련
          'questybook_session_id',
        ];

        keysToRemove.forEach(key => localStorage.removeItem(key));

        // conversationId 키들도 삭제 (채팅방별)
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('questybook_conv_')) {
            localStorage.removeItem(key);
          }
        });

        // 4. sessionStorage도 정리
        sessionStorage.removeItem('questybook_session_active');

        console.log('[Auth] 로그아웃 완료 - 모든 데이터 삭제됨');
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

        // true인 경우만 캐시 신뢰 (이미 DB에서 검증됨)
        // false나 undefined는 항상 DB에서 다시 확인
        // (로그아웃 후 재로그인 시 persist 데이터가 stale할 수 있음)
        if (currentUser.onboardingCompleted === true) {
          console.log('[Auth] onboardingCompleted already true, skipping check');
          return true;
        }

        console.log('[Auth] Checking onboarding status from DB...');

        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('onboarding_completed, target_university')
            .eq('id', currentUser.id)
            .single();

          if (error) {
            // PGRST116 (행 없음)만 온보딩 미완료로 처리
            if (error.code === 'PGRST116') {
              console.log('[Auth] No profile found, onboarding needed');
              set({ user: { ...currentUser, onboardingCompleted: false } });
              return false;
            }
            // 다른 에러(네트워크, 권한 등)는 상태 변경하지 않음 - 기존 상태 유지
            console.warn('[Auth] Onboarding check error:', error.code, error.message);
            return currentUser.onboardingCompleted ?? false;
          }

          // 학습 목표(target_university)가 설정되어 있으면 온보딩 완료로 간주
          // (기존 사용자가 onboarding_completed 플래그 없이 프로필만 있는 경우 대응)
          const hasLearningGoal = !!data?.target_university;
          const completed = data?.onboarding_completed || hasLearningGoal;

          console.log('[Auth] Onboarding check result:', {
            onboarding_completed: data?.onboarding_completed,
            target_university: data?.target_university,
            result: completed
          });

          set({ user: { ...currentUser, onboardingCompleted: completed } });
          return completed;
        } catch (err: any) {
          // AbortError는 React StrictMode 또는 빠른 언마운트로 인한 정상적인 취소
          if (err?.name === 'AbortError') {
            console.log('[Auth] Onboarding check cancelled');
            return currentUser.onboardingCompleted ?? false;
          }
          // 네트워크 에러 등 예외 시 기존 상태 유지
          console.error('[Auth] Check onboarding error:', err);
          return currentUser.onboardingCompleted ?? false;
        }
      },

      // 온보딩 완료 상태 설정
      setOnboardingCompleted: (completed: boolean) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, onboardingCompleted: completed } });
        }
      },

      // 온보딩 플래그 초기화 (온보딩 완료 후 호출)
      clearNeedsOnboarding: () => {
        set({ needsOnboarding: false });
      },

      // 학습 프로필 로드 (온보딩 데이터)
      loadUserProfile: async () => {
        const currentUser = get().user;
        if (!currentUser || !supabase) {
          return null;
        }

        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (error) {
            // 에러 코드별 분류 처리
            // PGRST116: 행 없음 (프로필 미생성) - 정상 케이스
            // 다른 에러: 네트워크/권한 문제 - 로깅 필요
            if (error.code === 'PGRST116') {
              console.log('[Auth] No user profile found (not created yet)');
            } else {
              console.warn('[Auth] User profile load error:', error.code, error.message);
            }
            return null;
          }

          const profile: UserProfile = {
            age: data.age,
            examYear: data.exam_year || 0,
            targetUniversity: data.target_university || '',
            targetGrades: data.target_grades || {},
            currentGrades: data.current_grades || {},
            selectedTamgu1: data.selected_tamgu1 || '',
            selectedTamgu2: data.selected_tamgu2 || '',
            subscribedPlatforms: data.subscribed_platforms || [],
            dailyStudyHours: data.daily_study_hours || 8,
          };

          set({ userProfile: profile });
          console.log('[Auth] User profile loaded:', profile.targetUniversity);
          return profile;
        } catch (err: any) {
          // AbortError는 React StrictMode 또는 빠른 언마운트로 인한 정상적인 취소
          if (err?.name === 'AbortError') {
            console.log('[Auth] User profile load cancelled');
            return null;
          }
          // 네트워크 에러 등 예외 처리
          console.error('[Auth] Load user profile exception:', err);
          return null;
        }
      },

      // 프로필 업데이트 (로컬 상태만)
      setUserProfile: (profile: UserProfile | null) => {
        set({ userProfile: profile });
      },

      // 멤버십 정보 로드
      loadMembership: async () => {
        const session = get().session;
        if (!session?.access_token || !supabase) {
          return null;
        }

        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const response = await fetch(`${API_URL}/api/admin/membership/status`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          const data = await response.json();

          if (data.success) {
            const membership: MembershipData = data.data;
            set({ membershipData: membership });
            console.log('[Auth] Membership loaded:', membership.type);
            return membership;
          }
          return null;
        } catch (err) {
          console.error('[Auth] Load membership error:', err);
          return null;
        }
      },

      // 멤버십 데이터 업데이트 (로컬 상태만)
      setMembershipData: (data: MembershipData | null) => {
        set({ membershipData: data });
      },
    }),
    {
      name: 'questybook-auth',
      // isAuthenticated는 저장하지 않음 - 항상 Supabase 세션 기준으로 판단
      partialize: (state) => ({
        user: state.user,
        userProfile: state.userProfile,  // 학습 프로필도 persist
        membershipData: state.membershipData,  // 멤버십 데이터도 persist
      }),
    }
  )
);
