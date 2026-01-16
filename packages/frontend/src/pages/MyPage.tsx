/**
 * MyPage
 * 마이페이지 - 사용자 정보 및 로그아웃
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { NotebookLayout, NotebookPage } from '../components/notebook';

export function MyPage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();
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

        {/* 고객 지원 */}
        <div className="bg-white/50 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <span>💬</span> 고객 지원
          </h2>

          <button
            onClick={() => navigate('/inquiry')}
            className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg border border-green-200 transition-colors flex items-center justify-center gap-2 handwrite"
          >
            <span>📝</span>
            1:1 문의하기
          </button>
          <p className="text-xs text-[var(--pencil-gray)] mt-2 text-center">
            궁금한 점이나 건의 사항이 있으면 편하게 문의해주세요
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

        {/* 꿀팁 메모장 */}
        <div className="postit mt-6">
          <p className="handwrite text-lg mb-3">💡 QuestyBook 활용 꿀팁</p>
          <ul className="text-sm space-y-2 text-[var(--pencil-gray)]">
            <li className="flex items-start gap-2">
              <span>📊</span>
              <span>학습 리포트에서 주간 통계와 연속 학습일을 확인하세요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>💬</span>
              <span>힘들 땐 코치에게 상담을 요청해보세요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📚</span>
              <span>꿀팁 탭에서 인강 강사 추천과 학습 전략을 확인할 수 있어요</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📝</span>
              <span>문의사항이 있으면 1:1 문의를 이용해주세요</span>
            </li>
          </ul>
        </div>

        {/* 데코레이션 */}
        <div className="mt-6 text-center">
          <div className="inline-block washi-tape w-24 h-4 rounded-sm opacity-60" />
        </div>
      </NotebookPage>

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
