/**
 * NotebookLayout
 * 노트북/플래너 스타일의 레이아웃 컴포넌트
 * AI 학습 코치 시스템 통합
 * - 코칭 탭에 읽지 않은 알림 배지 표시
 */

import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';

interface NotebookLayoutProps {
  children: ReactNode;
}

export function NotebookLayout({ children }: NotebookLayoutProps) {
  const location = useLocation();
  const unreadCount = useChatStore((state) => state.getTotalUnreadCount());

  return (
    <div className="min-h-screen notebook-bg">
      {/* 상단 탭 네비게이션 */}
      <nav className="sticky top-0 z-50 bg-[var(--paper-cream)] border-b border-[var(--paper-lines)] px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📓</span>
            <span className="handwrite handwrite-lg text-[var(--ink-black)]">
              QuestyBook
            </span>
          </Link>

          {/* 탭 */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            <NavTab to="/" active={location.pathname === '/'}>
              📅 오늘
            </NavTab>
            <NavTab to="/planner" active={location.pathname === '/planner'}>
              📋 플래너
            </NavTab>
            <NavTab to="/generate" active={location.pathname === '/generate'}>
              ✨ 새플랜
            </NavTab>
            <NavTab to="/curriculum" active={location.pathname === '/curriculum'}>
              📚 커리큘럼
            </NavTab>
            <NavTab to="/tips" active={location.pathname === '/tips'}>
              💡 꿀팁
            </NavTab>
            <NavTab to="/chat" active={location.pathname === '/chat'} badge={unreadCount}>
              💬 코치
            </NavTab>
            <NavTab to="/mypage" active={location.pathname === '/mypage'}>
              👤 MY
            </NavTab>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* 하단 네비게이션 바 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--paper-lines)] px-4 py-2 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex justify-around">
          <BottomNavItem to="/" icon="📅" label="오늘" active={location.pathname === '/'} />
          <BottomNavItem to="/planner" icon="📋" label="플래너" active={location.pathname === '/planner'} />
          <BottomNavItem to="/chat" icon="💬" label="코치" active={location.pathname === '/chat'} badge={unreadCount} />
          <BottomNavItem to="/report" icon="📊" label="리포트" active={location.pathname === '/report'} />
          <BottomNavItem to="/mypage" icon="👤" label="MY" active={location.pathname === '/mypage'} />
        </div>
      </nav>

      {/* 하단 여백 (네비게이션 바 높이만큼) */}
      <div className="h-16" />
    </div>
  );
}

function NavTab({
  to,
  active,
  children,
  badge = 0,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`date-tab text-sm hidden sm:block ${active ? 'active' : ''} relative`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function BottomNavItem({
  to,
  icon,
  label,
  active,
  badge = 0,
}: {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${
        active
          ? 'text-[var(--ink-blue)] bg-[var(--highlight-blue)]'
          : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
      }`}
    >
      <span className="text-lg relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}
