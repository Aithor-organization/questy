/**
 * QuestyBook App
 * AI 학습 코치 + 노트북 스타일 플래너 앱
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useScheduledNotifications } from './hooks/useScheduledNotifications';
import { useCoachScheduler } from './hooks/useCoachScheduler';
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
  CurriculumPage,
  TipsPage,
  AdminPage,
  TimerPage,
} from './pages';
import { ToastNotification } from './components/ToastNotification';

// 인증이 필요한 라우트를 보호하는 컴포넌트
function ProtectedRoute({ children, skipOnboarding = false }: { children: React.ReactNode; skipOnboarding?: boolean }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 온보딩 체크 (skipOnboarding이 아닌 경우에만)
  if (!skipOnboarding && user && user.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
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

  // Supabase Auth 초기화 (세션 복원)
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 온보딩 상태 체크 (로그인 후)
  useEffect(() => {
    if (isAuthenticated) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated, checkOnboardingStatus]);

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
      {/* 전역 토스트 알림 */}
      <ToastNotification />

      <Routes>
        {/* 공개 라우트 (로그인/회원가입) */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />

        {/* 온보딩 라우트 */}
        <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

        {/* 보호된 라우트 */}
        <Route path="/" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
        <Route path="/admission" element={<ProtectedRoute><AdmissionPage /></ProtectedRoute>} />

        {/* 채팅 시스템 (카카오톡 스타일) */}
        <Route path="/chat" element={<ProtectedRoute><ChatListPage /></ProtectedRoute>} />
        <Route path="/chat/:roomId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />

        <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/my" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/inquiry" element={<ProtectedRoute><InquiryPage /></ProtectedRoute>} />
        <Route path="/planner" element={<ProtectedRoute><PlannerPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/curriculum" element={<ProtectedRoute><CurriculumPage /></ProtectedRoute>} />
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
