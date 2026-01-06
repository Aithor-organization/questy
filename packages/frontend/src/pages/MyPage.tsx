/**
 * MyPage
 * 마이페이지 - 사용자 정보 및 로그아웃
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useQuestStore } from '../stores/questStore';
import { NotebookLayout, NotebookPage } from '../components/notebook';

export function MyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const clearMessages = useChatStore((state) => state.clearMessages);
  const clearNotifications = useChatStore((state) => state.clearNotifications);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleResetAllData = () => {
    // 모든 스토어 초기화
    clearMessages();
    clearNotifications();
    useQuestStore.getState().plans.forEach((plan) => {
      useQuestStore.getState().removePlan(plan.id);
    });

    // localStorage 직접 삭제
    localStorage.removeItem('questybook-chat-storage');
    localStorage.removeItem('questybook-storage');
    localStorage.removeItem('questybook_student_id');
    localStorage.removeItem('questybook_student_name');

    setShowResetConfirm(false);
    alert('모든 데이터가 초기화되었습니다.');
  };

  return (
    <NotebookLayout>
      <NotebookPage>
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">👤</div>
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
            마이페이지
          </h1>
        </div>

        {/* 사용자 정보 카드 */}
        <div className="bg-white/50 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <span>📋</span> 내 정보
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
              <span className="text-2xl">📛</span>
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">이름</div>
                <div className="handwrite text-[var(--ink-black)]">
                  {user?.name || '이름 없음'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
              <span className="text-2xl">✉️</span>
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">이메일</div>
                <div className="handwrite text-[var(--ink-black)]">
                  {user?.email || '이메일 없음'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xl">🆔</span>
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">학생 ID</div>
                <div className="handwrite text-[var(--ink-black)] text-sm">
                  {user?.studentId || '미등록'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 데이터 관리 */}
        <div className="bg-white/50 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <span>⚙️</span> 데이터 관리
          </h2>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg border border-orange-200 transition-colors flex items-center justify-center gap-2 handwrite"
          >
            <span>🗑️</span>
            학습 데이터 초기화
          </button>
          <p className="text-xs text-[var(--pencil-gray)] mt-2 text-center">
            채팅 기록, 학습 계획 등 모든 데이터가 삭제됩니다
          </p>
        </div>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-2 handwrite"
        >
          <span>🚪</span>
          로그아웃
        </button>

        {/* 데코레이션 */}
        <div className="mt-8 text-center">
          <div className="inline-block washi-tape w-24 h-4 rounded-sm opacity-60" />
        </div>
      </NotebookPage>

      {/* 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
              <h3 className="handwrite handwrite-lg text-[var(--ink-black)] mt-2">
                정말 초기화할까요?
              </h3>
              <p className="text-sm text-[var(--pencil-gray)] mt-2">
                채팅 기록, 학습 계획 등 모든 데이터가 영구 삭제됩니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors handwrite"
              >
                취소
              </button>
              <button
                onClick={handleResetAllData}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors handwrite"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </NotebookLayout>
  );
}
