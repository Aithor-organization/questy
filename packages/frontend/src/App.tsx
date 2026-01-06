/**
 * QuestyBook App
 * AI 학습 코치 + 노트북 스타일 플래너 앱
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import {
  LoginPage,
  SignUpPage,
  MyPage,
  TodayPage,
  PlannerPage,
  GeneratePage,
  PlanDetailPage,
  AdmissionPage,
  ChatPage,
  ReportPage,
} from './pages';

// 인증이 필요한 라우트를 보호하는 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 (로그인/회원가입) */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />

        {/* 보호된 라우트 */}
        <Route path="/" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
        <Route path="/admission" element={<ProtectedRoute><AdmissionPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/planner" element={<ProtectedRoute><PlannerPage /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
        <Route path="/plan/:planId" element={<ProtectedRoute><PlanDetailPage /></ProtectedRoute>} />

        {/* 기타 경로는 로그인으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
