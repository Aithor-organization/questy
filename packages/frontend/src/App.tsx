/**
 * Questy App
 * AI 학습 코치 + 노트북 스타일 플래너 앱
 */

import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useQuestStore } from './stores/questStore';
import { useChatStore } from './stores/chatStore';
import { syncFromSupabase } from './lib/supabase-storage';
import { useScheduledNotifications } from './hooks/useScheduledNotifications';
import { useCoachScheduler } from './hooks/useCoachScheduler';
import { useMembership } from './hooks/useMembership';
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
  AdminPage,
  TimerPage,
} from './pages';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { ToastNotification } from './components/ToastNotification';

// 인증이 필요한 라우트를 보호하는 컴포넌트
function ProtectedRoute({ children, skipOnboarding = false, skipMembershipCheck = false }: {
  children: React.ReactNode;
  skipOnboarding?: boolean;
  skipMembershipCheck?: boolean;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const { isPending, isExpired, isLoading: isMembershipLoading } = useMembership();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 온보딩 체크 (skipOnboarding이 아닌 경우에만)
  if (!skipOnboarding && user && user.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // 멤버십 체크 (skipMembershipCheck가 아닌 경우에만)
  if (!skipMembershipCheck && !isMembershipLoading) {
    // 승인 대기 중인 경우 대기 페이지로
    if (isPending) {
      return <Navigate to="/pending" replace />;
    }
    // 멤버십 만료된 경우도 대기 페이지로 (만료 메시지 표시)
    if (isExpired) {
      return <Navigate to="/pending" replace />;
    }
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

// 온보딩 전용 라우트 (로그인 필요, 온보딩 미완료 시만 접근)
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 이미 온보딩 완료한 경우 메인으로
  if (user?.onboardingCompleted === true) {
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

  // 로그인 후 스토어 동기화 (Supabase → localStorage → Zustand)
  useEffect(() => {
    async function syncStoresFromSupabase() {
      if (!isAuthenticated) {
        // 로그아웃 시 플래그 리셋
        hasSyncedRef.current = false;
        return;
      }

      if (hasSyncedRef.current) return;
      hasSyncedRef.current = true;

      console.log('[App] 로그인 후 스토어 동기화 시작');

      try {
        // Supabase에서 localStorage로 데이터 동기화
        const [questSynced, chatSynced] = await Promise.all([
          syncFromSupabase('quest'),
          syncFromSupabase('chat'),
        ]);

        console.log(`[App] Supabase 동기화: quest=${questSynced}, chat=${chatSynced}`);

        // 항상 rehydrate 호출 (Supabase 데이터 또는 기존 localStorage 데이터 로드)
        // 인증 전에 zustand persist가 초기화되어 빈 상태일 수 있으므로 항상 새로 로드
        await Promise.all([
          useQuestStore.persist.rehydrate(),
          useChatStore.persist.rehydrate(),
        ]);

        console.log('[App] 스토어 rehydrate 완료');
      } catch (error) {
        console.error('[App] 스토어 동기화 실패:', error);
      }
    }

    syncStoresFromSupabase();
  }, [isAuthenticated]);

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
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/plan/:planId" element={<ProtectedRoute><PlanDetailPage /></ProtectedRoute>} />
        <Route path="/timer/:planId/:questId" element={<ProtectedRoute><TimerPage /></ProtectedRoute>} />

        {/* 기타 경로는 로그인으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
