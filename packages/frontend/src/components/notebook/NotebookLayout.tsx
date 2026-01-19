/**
 * NotebookLayout
 * 노트북/플래너 스타일의 레이아웃 컴포넌트
 * AI 학습 코치 시스템 통합
 * - 코칭 탭에 읽지 않은 알림 배지 표시
 * - 알림 버튼으로 미완료 퀘스트 및 코치 메시지 확인
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useQuestStore, getTodayDateString } from '../../stores/questStore';
import { NotificationModal } from '../NotificationModal';

interface NotebookLayoutProps {
  children: ReactNode;
}

export function NotebookLayout({ children }: NotebookLayoutProps) {
  const location = useLocation();
  const unreadCount = useChatStore((state) => state.getTotalUnreadCount());
  const unreadNotifications = useChatStore((state) => state.notifications.filter(n => !n.isRead).length);
  const getIncompleteQuests = useQuestStore((state) => state.getIncompleteQuests);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 총 알림 개수 (미완료 퀘스트 + 읽지 않은 메시지 + 알림)
  const incompleteQuestsCount = getIncompleteQuests(getTodayDateString()).length;
  const totalNotificationCount = incompleteQuestsCount + unreadCount + unreadNotifications;

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // 페이지 이동 시 메뉴 닫기 (pathname 또는 search 변경 시)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen notebook-bg overflow-x-hidden">
      {/* 상단 탭 네비게이션 */}
      <nav className="sticky top-0 z-50 bg-[var(--paper-cream)] border-b border-[var(--paper-lines)] px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📓</span>
            <span className="handwrite handwrite-lg text-[var(--ink-black)]">
              Questy
            </span>
          </Link>

          {/* 오른쪽 버튼들 */}
          <div className="flex items-center gap-1">
            {/* 알림 버튼 */}
            <button
              onClick={() => setIsNotificationOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--highlight-yellow)] transition-colors relative"
              aria-label="알림"
            >
              <Bell size={20} className="text-[var(--ink-black)]" />
              {/* 알림 배지 */}
              {totalNotificationCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {totalNotificationCount > 99 ? '99+' : totalNotificationCount}
                </span>
              )}
            </button>

            {/* 햄버거 메뉴 버튼 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--highlight-yellow)] transition-colors relative"
              aria-label="메뉴 열기"
            >
              <div className="flex flex-col gap-1.5">
                <span className={`w-5 h-0.5 bg-[var(--ink-black)] transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`w-5 h-0.5 bg-[var(--ink-black)] transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`w-5 h-0.5 bg-[var(--ink-black)] transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
              {/* 읽지 않은 메시지 표시 */}
              {unreadCount > 0 && !isMenuOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {/* 드롭다운 메뉴 */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-[var(--paper-lines)] py-2 overflow-hidden">
                <MenuNavTab to="/" active={location.pathname === '/'}>
                  📅 오늘
                </MenuNavTab>
                <MenuNavTab to="/planner" active={location.pathname === '/planner'}>
                  📋 플래너
                </MenuNavTab>
                <MenuNavTab to="/generate" active={location.pathname === '/generate' && !location.search.includes('tab=curriculum')}>
                  ✨ 새플랜
                </MenuNavTab>
                <MenuNavTab to="/generate?tab=curriculum" active={location.pathname === '/generate' && location.search.includes('tab=curriculum')}>
                  📚 커리큘럼
                </MenuNavTab>
                <MenuNavTab to="/tips" active={location.pathname === '/tips'}>
                  💡 꿀팁
                </MenuNavTab>
                <MenuNavTab to="/chat" active={location.pathname === '/chat'} badge={unreadCount}>
                  💬 코치
                </MenuNavTab>
                <MenuNavTab to="/mypage" active={location.pathname === '/mypage'}>
                  👤 MY
                </MenuNavTab>
              </div>
            )}
          </div>
          </div>
        </div>
      </nav>

      {/* 알림 모달 */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />

      {/* 메인 콘텐츠 - 하단 네비게이션 높이만큼 패딩 추가 */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 overflow-x-hidden">
        {children}
      </main>

      {/* 하단 네비게이션 바 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--paper-lines)] px-4 py-2 safe-area-bottom z-50">
        <div className="max-w-2xl mx-auto flex justify-around">
          <BottomNavItem to="/" icon="📅" label="오늘" active={location.pathname === '/'} />
          <BottomNavItem to="/planner" icon="📋" label="플래너" active={location.pathname === '/planner'} />
          <BottomNavItem to="/generate" icon="✨" label="새플랜" active={location.pathname === '/generate'} />
          <BottomNavItem to="/chat" icon="💬" label="코치" active={location.pathname === '/chat'} badge={unreadCount} />
          <BottomNavItem to="/mypage" icon="👤" label="MY" active={location.pathname === '/mypage'} />
        </div>
      </nav>
    </div>
  );
}

function MenuNavTab({
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
      className={`flex items-center justify-between px-4 py-3 text-sm transition-colors ${
        active
          ? 'bg-[var(--highlight-yellow)] text-[var(--ink-black)] font-semibold'
          : 'text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)]'
      }`}
    >
      <span>{children}</span>
      {badge > 0 && (
        <span className="min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
