/**
 * Questy App
 * AI 학습 코치 + 노트북 스타일 플래너 앱
 */

import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useQuestStore } from './stores/questStore';
import { useChatStore } from './stores/chatStore';
import { syncFromSupabase } from './lib/supabase-storage';
import { useScheduledNotifications } from './hooks/useScheduledNotifications';
import { useCoachScheduler } from './hooks/useCoachScheduler';
import { useMembership } from './hooks/useMembership';
import { createLogger } from './lib/logger';
import {
  LoginPage,
  SignUpPage,
  OnboardingPage,
  MyPage,
  InquiryPage,
  TodayPage,
  PlannerPage,
  GeneratePage,
  PlanDetailPage,
  AdmissionPage,
  ChatListPage,
  ChatRoomPage,
  ReportPage,
  TipsPage,
  TimerPage,
} from './pages';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { ToastNotification } from './components/ToastNotification';
import { ToastContainer } from './components/Toast';

// Lazy Loading: 관리자 페이지 (일반 사용자는 접근하지 않음)
const AdminPage = lazy(() => import('./pages/admin-page').then(m => ({ default: m.AdminPage })));

// 개발 모드에서만 동작하는 로거
const log = createLogger('[App]');

// 인증이 필요한 라우트를 보호하는 컴포넌트
function ProtectedRoute({ children, skipOnboarding = false, skipMembershipCheck = false }: {
  children: React.ReactNode;
  skipOnboarding?: boolean;
  skipMembershipCheck?: boolean;
}) {
  const { isAuthenticated, needsOnboarding } = useAuthStore();
  const { isPending, isLoading: isMembershipLoading } = useMembership();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 온보딩 체크 (회원가입 직후에만 - needsOnboarding 플래그 사용)
  if (!skipOnboarding && needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // 멤버십 체크 (skipMembershipCheck가 아닌 경우에만)
  // pending(대기자)만 대기 페이지로, 나머지(regular, beta_tester, lab_member)는 메인 접근 가능
  if (!skipMembershipCheck && !isMembershipLoading && isPending) {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}

// 이미 로그인된 사용자는 메인으로 리다이렉트
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// 페이지 이동 시 스크롤을 맨 위로 올리는 컴포넌트
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// 온보딩 전용 라우트 (회원가입 직후에만 접근 가능)
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsOnboarding } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 회원가입 직후가 아니면 메인으로 (기존 사용자는 온보딩 스킵)
  if (!needsOnboarding) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initializeAuth, isLoading, isAuthenticated, checkOnboardingStatus } = useAuthStore();
  const hasSyncedRef = useRef(false);

  // Supabase Auth 초기화 (세션 복원)
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 온보딩 상태 체크, 학습 프로필 및 멤버십 로드 (로그인 후)
  const loadUserProfile = useAuthStore((state) => state.loadUserProfile);
  const loadMembership = useAuthStore((state) => state.loadMembership);

  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingStatus();
      // 학습 프로필 및 멤버십 로드 (authStore에 캐시)
      loadUserProfile();
      loadMembership();
    }
  }, [isAuthenticated, checkOnboardingStatus, loadUserProfile, loadMembership]);

  // 로그인 후 스토어 동기화 (Supabase → Zustand)
  const initializeChat = useChatStore((state) => state.initializeChat);
  const resetChat = useChatStore((state) => state.resetChat);

  useEffect(() => {
    async function syncStoresFromSupabase() {
      if (!isAuthenticated) {
        // 로그아웃 시 플래그 리셋 및 채팅 상태 초기화
        hasSyncedRef.current = false;
        resetChat();
        return;
      }

      if (hasSyncedRef.current) return;
      hasSyncedRef.current = true;

      log.log('로그인 후 스토어 동기화 시작');

      try {
        // Quest 스토어: Supabase → localStorage → Zustand (기존 방식 유지)
        const questSynced = await syncFromSupabase('quest');
        log.log(`Supabase 동기화: quest=${questSynced}`);
        await useQuestStore.persist.rehydrate();

        // Chat 스토어: Supabase 테이블에서 직접 로드 (새로운 방식)
        await initializeChat();

        log.log('스토어 동기화 완료');
      } catch (error) {
        log.error('스토어 동기화 실패:', error);
      }
    }

    syncStoresFromSupabase();
  }, [isAuthenticated, initializeChat, resetChat]);

  // 예약된 알림 백그라운드 체크 (1분마다)
  useScheduledNotifications();

  // 자동 코치 메시지 스케줄러 (10시 리마인더, 자정 요약)
  useCoachScheduler();

  // 인증 초기화 중 로딩 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* 페이지 이동 시 스크롤 맨 위로 */}
      <ScrollToTop />

      {/* 전역 토스트 알림 */}
      <ToastNotification />
      <ToastContainer />

      <Routes>
        {/* 공개 라우트 (로그인/회원가입) */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />

        {/* 온보딩 라우트 */}
        <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

        {/* 승인 대기 페이지 */}
        <Route path="/pending" element={<ProtectedRoute skipOnboarding skipMembershipCheck><PendingApprovalPage /></ProtectedRoute>} />

        {/* 보호된 라우트 */}
        <Route path="/" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
        <Route path="/admission" element={<ProtectedRoute><AdmissionPage /></ProtectedRoute>} />

        {/* 채팅 시스템 (카카오톡 스타일) */}
        <Route path="/chat" element={<ProtectedRoute><ChatListPage /></ProtectedRoute>} />
        <Route path="/chat/:roomId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />

        <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute skipMembershipCheck><MyPage /></ProtectedRoute>} />
        <Route path="/my" element={<ProtectedRoute skipMembershipCheck><MyPage /></ProtectedRoute>} />
        <Route path="/inquiry" element={<ProtectedRoute><InquiryPage /></ProtectedRoute>} />
        <Route path="/planner" element={<ProtectedRoute><PlannerPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/curriculum" element={<Navigate to="/generate?tab=curriculum" replace />} />
        <Route path="/tips" element={<ProtectedRoute><TipsPage /></ProtectedRoute>} />
        <Route path="/admin" element={
          <Suspense fallback={<div className="min-h-screen bg-amber-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-gray-600">로딩 중...</p></div></div>}>
            <AdminPage />
          </Suspense>
        } />
        <Route path="/plan/:planId" element={<ProtectedRoute><PlanDetailPage /></ProtectedRoute>} />
        <Route path="/timer/:planId/:questId" element={<ProtectedRoute><TimerPage /></ProtectedRoute>} />

        {/* 기타 경로는 로그인으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
