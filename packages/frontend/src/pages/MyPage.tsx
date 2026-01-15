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
  const { user, logout, updateProfile } = useAuthStore();
  const clearRoomMessages = useChatStore((state) => state.clearRoomMessages);
  const clearNotifications = useChatStore((state) => state.clearNotifications);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditPassword('');
    setEditPasswordConfirm('');
    setUpdateError(null);
    setUpdateSuccess(false);
    setShowEditProfile(true);
  };

  const handleUpdateProfile = async () => {
    setUpdateError(null);
    setUpdateSuccess(false);

    // 유효성 검사
    if (!editName.trim()) {
      setUpdateError('이름을 입력해주세요');
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setUpdateError('비밀번호는 최소 6자 이상이어야 해요');
      return;
    }

    if (editPassword && editPassword !== editPasswordConfirm) {
      setUpdateError('비밀번호가 일치하지 않아요');
      return;
    }

    setIsUpdating(true);

    const updates: { name?: string; password?: string } = {};
    if (editName.trim() !== user?.name) {
      updates.name = editName.trim();
    }
    if (editPassword) {
      updates.password = editPassword;
    }

    // 변경 사항이 없으면 그냥 닫기
    if (Object.keys(updates).length === 0) {
      setShowEditProfile(false);
      setIsUpdating(false);
      return;
    }

    const result = await updateProfile(updates);
    setIsUpdating(false);

    if (result.success) {
      setUpdateSuccess(true);
      setEditPassword('');
      setEditPasswordConfirm('');
      setTimeout(() => {
        setShowEditProfile(false);
        setUpdateSuccess(false);
      }, 1500);
    } else {
      setUpdateError(result.error || '업데이트에 실패했어요');
    }
  };

  const handleResetAllData = () => {
    // 모든 스토어 초기화
    // 각 채팅방 메시지 삭제
    useChatStore.getState().rooms.forEach((room) => {
      clearRoomMessages(room.id);
    });
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

          {/* 내 정보 수정 버튼 */}
          <button
            onClick={openEditModal}
            className="w-full mt-4 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 transition-colors flex items-center justify-center gap-2 handwrite"
          >
            <span>✏️</span>
            내 정보 수정
          </button>
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

      {/* 프로필 수정 모달 */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <span className="text-4xl">✏️</span>
              <h3 className="handwrite handwrite-lg text-[var(--ink-black)] mt-2">
                내 정보 수정
              </h3>
            </div>

            <div className="space-y-4">
              {/* 이름 입력 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                  placeholder="이름을 입력하세요"
                />
              </div>

              {/* 비밀번호 입력 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">
                  새 비밀번호 (선택)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                  placeholder="변경할 비밀번호 (6자 이상)"
                />
              </div>

              {/* 비밀번호 확인 */}
              {editPassword && (
                <div>
                  <label className="block text-sm text-[var(--pencil-gray)] mb-1">
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                    placeholder="비밀번호를 다시 입력하세요"
                  />
                </div>
              )}

              {/* 에러 메시지 */}
              {updateError && (
                <p className="text-sm text-red-500 text-center">{updateError}</p>
              )}

              {/* 성공 메시지 */}
              {updateSuccess && (
                <p className="text-sm text-green-500 text-center">
                  ✅ 정보가 수정되었어요!
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                disabled={isUpdating}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors handwrite disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleUpdateProfile}
                disabled={isUpdating}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors handwrite disabled:opacity-50"
              >
                {isUpdating ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotebookLayout>
  );
}
