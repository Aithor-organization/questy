/**
 * MyPage
 * 마이페이지 - 사용자 정보, 학습 프로필, 로그아웃
 */

import { User, MessageCircle, LogOut } from 'lucide-react';
import { NotebookLayout, NotebookPage } from '../../components/notebook';
import { useMyPage } from './hooks/useMyPage';
import {
  EditProfileModal,
  EditLearningModal,
  UserInfoCard,
  LearningProfileCard,
  MembershipCard,
  MyInquiriesCard,
} from './components';

export function MyPage() {
  const {
    user, profile, editProfile, isLoadingProfile, showEditProfile, showEditLearning,
    editName, editPassword, editPasswordConfirm, isUpdating, updateError, updateSuccess,
    isSavingProfile, profileError, profileSuccess,
    setEditName, setEditPassword, setEditPasswordConfirm, setEditProfile,
    setShowEditProfile, setShowEditLearning,
    handleLogout, openEditModal, handleUpdateProfile, openEditLearning, handleSaveProfile,
    handleGradeChange, togglePlatform,
  } = useMyPage();

  return (
    <NotebookLayout>
      <NotebookPage>
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <User className="w-16 h-16 text-[var(--ink-blue)]" />
          </div>
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
            마이페이지
          </h1>
        </div>

        {/* 사용자 정보 카드 */}
        <UserInfoCard
          userName={user?.name}
          userEmail={user?.email}
          studentId={user?.studentId}
          onEdit={openEditModal}
        />

        {/* 멤버십 정보 카드 */}
        <MembershipCard />

        {/* 학습 프로필 카드 */}
        <LearningProfileCard
          profile={profile}
          isLoading={isLoadingProfile}
          onEdit={openEditLearning}
        />

        {/* 내 문의 내역 카드 */}
        <MyInquiriesCard userEmail={user?.email} />

        {/* 고객 지원 카드 */}
        <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> 고객 지원
          </h2>
          <button
            onClick={() => window.open('https://open.kakao.com/o/sC3cKiih', '_blank')}
            className="w-full py-3 px-4 bg-[#FEE500] hover:opacity-80 text-[#3C1E1E] rounded-lg border border-[#FEE500] transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            카카오톡 문의하기
          </button>
          <p className="text-xs text-[var(--pencil-gray)] mt-2 text-center">
            궁금한 점이나 건의 사항이 있으면 오픈채팅으로 문의해주세요
          </p>
        </div>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 bg-[var(--highlight-pink)] hover:opacity-80 text-[var(--ink-red)] rounded-lg border border-[var(--ink-red)]/30 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>

        {/* 데코레이션 */}
        <div className="mt-6 text-center">
          <div className="inline-block washi-tape w-24 h-4 rounded-sm opacity-60" />
        </div>
      </NotebookPage>

      {/* 모달들 */}
      <EditProfileModal
        show={showEditProfile}
        editName={editName}
        editPassword={editPassword}
        editPasswordConfirm={editPasswordConfirm}
        isUpdating={isUpdating}
        updateError={updateError}
        updateSuccess={updateSuccess}
        onNameChange={setEditName}
        onPasswordChange={setEditPassword}
        onPasswordConfirmChange={setEditPasswordConfirm}
        onSave={handleUpdateProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <EditLearningModal
        show={showEditLearning}
        editProfile={editProfile}
        isSaving={isSavingProfile}
        error={profileError}
        success={profileSuccess}
        onProfileChange={setEditProfile}
        onGradeChange={handleGradeChange}
        onTogglePlatform={togglePlatform}
        onSave={handleSaveProfile}
        onClose={() => setShowEditLearning(false)}
      />
    </NotebookLayout>
  );
}
