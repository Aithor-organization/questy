/**
 * MyPage
 * 마이페이지 - 사용자 정보, 학습 프로필, 로그아웃
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ClipboardList, Mail, Hash, Pencil, MessageCircle, FileText, LogOut, BookOpen, Target, GraduationCap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { NotebookLayout, NotebookPage } from '../components/notebook';

// 탐구 과목 옵션
const SOCIAL_SUBJECTS = [
  '생활과윤리', '윤리와사상', '한국지리', '세계지리',
  '동아시아사', '세계사', '경제', '정치와법', '사회문화'
];

const SCIENCE_SUBJECTS = [
  '물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ',
  '생명과학Ⅰ', '생명과학Ⅱ', '지구과학Ⅰ', '지구과학Ⅱ'
];

// N수생 라벨
const EXAM_YEAR_LABELS: Record<number, string> = {
  0: '현역 (고3)',
  1: '재수생',
  2: '삼수생',
  3: '그 이상',
};

// 인강 사이트 라벨
const PLATFORM_LABELS: Record<string, string> = {
  megastudy: '메가스터디',
  etoos: '이투스',
  daesung: '대성마이맥',
  ebsi: 'EBSi',
  skyedu: '스카이에듀',
  jinhak: '진학사',
  other: '기타',
};

// 고정 과목
const FIXED_SUBJECTS = ['국어', '수학', '영어', '한국사'];

// 등급 옵션
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// 프로필 데이터 타입
interface ProfileData {
  age: number | null;
  examYear: number;
  targetUniversity: string;
  targetGrades: Record<string, number>;
  currentGrades: Record<string, number>;
  selectedTamgu1: string;
  selectedTamgu2: string;
  subscribedPlatforms: string[];
  dailyStudyHours: number;
}

export function MyPage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();

  // 기본 정보 수정 상태
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // 학습 프로필 상태
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [showEditLearning, setShowEditLearning] = useState(false);
  const [editProfile, setEditProfile] = useState<ProfileData | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // 프로필 데이터 로드
  useEffect(() => {
    async function loadProfile() {
      if (!user || !supabase) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.log('[MyPage] No profile found');
          setProfile(null);
        } else if (data) {
          setProfile({
            age: data.age,
            examYear: data.exam_year || 0,
            targetUniversity: data.target_university || '',
            targetGrades: data.target_grades || {},
            currentGrades: data.current_grades || {},
            selectedTamgu1: data.selected_tamgu1 || '',
            selectedTamgu2: data.selected_tamgu2 || '',
            subscribedPlatforms: data.subscribed_platforms || [],
            dailyStudyHours: data.daily_study_hours || 8,
          });
        }
      } catch (err) {
        console.error('[MyPage] Profile load error:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    loadProfile();
  }, [user]);

  // 선택된 과목 목록
  const getSelectedSubjects = (p: ProfileData): string[] => {
    const subjects: string[] = [...FIXED_SUBJECTS];
    if (p.selectedTamgu1) subjects.push(p.selectedTamgu1);
    if (p.selectedTamgu2) subjects.push(p.selectedTamgu2);
    return subjects;
  };

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

  // 학습 프로필 수정 모달 열기
  const openEditLearning = () => {
    if (profile) {
      setEditProfile({ ...profile });
    } else {
      setEditProfile({
        age: null,
        examYear: 0,
        targetUniversity: '',
        targetGrades: {},
        currentGrades: {},
        selectedTamgu1: '',
        selectedTamgu2: '',
        subscribedPlatforms: [],
        dailyStudyHours: 8,
      });
    }
    setProfileError(null);
    setProfileSuccess(false);
    setShowEditLearning(true);
  };

  // 학습 프로필 저장
  const handleSaveProfile = async () => {
    if (!user || !supabase || !editProfile) {
      console.log('[MyPage] handleSaveProfile: Missing user, supabase, or editProfile');
      return;
    }

    setProfileError(null);
    setIsSavingProfile(true);

    console.log('[MyPage] Saving profile for user:', user.id);
    console.log('[MyPage] Profile data:', editProfile);

    try {
      // 현재 세션 확인
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[MyPage] Current session:', sessionData?.session?.user?.id, 'error:', sessionError);

      if (!sessionData?.session) {
        setProfileError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      // 타임아웃 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('요청 시간 초과 (10초)')), 10000);
      });

      const upsertPromise = supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          age: editProfile.age,
          exam_year: editProfile.examYear,
          target_university: editProfile.targetUniversity || '',
          target_grades: editProfile.targetGrades || {},
          current_grades: editProfile.currentGrades || {},
          selected_tamgu1: editProfile.selectedTamgu1 || '',
          selected_tamgu2: editProfile.selectedTamgu2 || '',
          subscribed_platforms: editProfile.subscribedPlatforms || [],
          daily_study_hours: editProfile.dailyStudyHours || 8,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .select();

      const { data, error } = await Promise.race([upsertPromise, timeoutPromise]);

      console.log('[MyPage] Upsert response - data:', data, 'error:', error);

      if (error) {
        console.error('[MyPage] Upsert error:', error);
        setProfileError(`저장에 실패했습니다: ${error.message}`);
        return;
      }

      setProfile({ ...editProfile });
      setProfileSuccess(true);
      setTimeout(() => {
        setShowEditLearning(false);
        setProfileSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('[MyPage] handleSaveProfile catch:', err);
      setProfileError(`오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 등급 변경 핸들러
  const handleGradeChange = (type: 'target' | 'current', subject: string, grade: number) => {
    if (!editProfile) return;
    if (type === 'target') {
      setEditProfile({ ...editProfile, targetGrades: { ...editProfile.targetGrades, [subject]: grade } });
    } else {
      setEditProfile({ ...editProfile, currentGrades: { ...editProfile.currentGrades, [subject]: grade } });
    }
  };

  // 플랫폼 토글
  const togglePlatform = (platformId: string) => {
    if (!editProfile) return;
    const platforms = editProfile.subscribedPlatforms.includes(platformId)
      ? editProfile.subscribedPlatforms.filter(p => p !== platformId)
      : [...editProfile.subscribedPlatforms, platformId];
    setEditProfile({ ...editProfile, subscribedPlatforms: platforms });
  };

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
        <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> 내 정보
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
              <User className="w-6 h-6 text-[var(--pencil-gray)]" />
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">이름</div>
                <div className="handwrite text-[var(--ink-black)]">
                  {user?.name || '이름 없음'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
              <Mail className="w-6 h-6 text-[var(--pencil-gray)]" />
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">이메일</div>
                <div className="handwrite text-[var(--ink-black)]">
                  {user?.email || '이메일 없음'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Hash className="w-6 h-6 text-[var(--pencil-gray)]" />
              <div>
                <div className="text-xs text-[var(--pencil-gray)]">학생 ID</div>
                <div className="handwrite text-[var(--ink-black)] text-sm">
                  {user?.studentId || '미등록'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={openEditModal}
            className="w-full mt-4 py-2 px-4 bg-[var(--highlight-blue)] hover:opacity-80 text-[var(--ink-blue)] rounded-lg border border-[var(--ink-blue)]/30 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            내 정보 수정
          </button>
        </div>

        {/* 학습 프로필 카드 */}
        <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> 학습 프로필
          </h2>

          {isLoadingProfile ? (
            <div className="text-center py-4 text-[var(--pencil-gray)]">
              로딩 중...
            </div>
          ) : profile ? (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
                <GraduationCap className="w-6 h-6 text-[var(--pencil-gray)]" />
                <div>
                  <div className="text-xs text-[var(--pencil-gray)]">나이 / 수험 년차</div>
                  <div className="handwrite text-[var(--ink-black)]">
                    {profile.age}세 / {EXAM_YEAR_LABELS[profile.examYear] || '현역'}
                  </div>
                </div>
              </div>

              {/* 목표 대학 */}
              <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
                <Target className="w-6 h-6 text-[var(--pencil-gray)]" />
                <div>
                  <div className="text-xs text-[var(--pencil-gray)]">목표 대학</div>
                  <div className="handwrite text-[var(--ink-black)]">
                    {profile.targetUniversity || '미설정'}
                  </div>
                </div>
              </div>

              {/* 탐구 과목 */}
              <div className="pb-3 border-b border-dashed border-[var(--paper-lines)]">
                <div className="text-xs text-[var(--pencil-gray)] mb-1">선택 탐구 과목</div>
                <div className="flex gap-2 flex-wrap">
                  {profile.selectedTamgu1 && (
                    <span className="px-2 py-1 bg-[var(--highlight-blue)] text-[var(--ink-blue)] rounded text-sm">
                      {profile.selectedTamgu1}
                    </span>
                  )}
                  {profile.selectedTamgu2 && (
                    <span className="px-2 py-1 bg-[var(--highlight-green)] text-[var(--sticker-mint)] rounded text-sm">
                      {profile.selectedTamgu2}
                    </span>
                  )}
                </div>
              </div>

              {/* 현재/목표 등급 요약 */}
              <div className="pb-3 border-b border-dashed border-[var(--paper-lines)]">
                <div className="text-xs text-[var(--pencil-gray)] mb-2">등급 현황</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {getSelectedSubjects(profile).slice(0, 4).map(subject => (
                    <div key={subject} className="flex justify-between">
                      <span className="text-[var(--pencil-gray)]">{subject}</span>
                      <span className="handwrite">
                        <span className="text-[var(--sticker-coral)]">{profile.currentGrades[subject] || '-'}</span>
                        <span className="text-[var(--pencil-gray)] mx-1">→</span>
                        <span className="text-[var(--sticker-mint)]">{profile.targetGrades[subject] || '-'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 학습 환경 */}
              <div>
                <div className="text-xs text-[var(--pencil-gray)] mb-1">학습 환경</div>
                <div className="text-sm text-[var(--ink-black)]">
                  <span className="handwrite">하루 {profile.dailyStudyHours}시간</span>
                  {profile.subscribedPlatforms.length > 0 && (
                    <span className="text-[var(--pencil-gray)]">
                      {' '}· {profile.subscribedPlatforms.map(p => PLATFORM_LABELS[p] || p).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-[var(--pencil-gray)]">
              학습 프로필이 없습니다
            </div>
          )}

          <button
            onClick={openEditLearning}
            className="w-full mt-4 py-2 px-4 bg-[var(--highlight-green)] hover:opacity-80 text-[var(--sticker-mint)] rounded-lg border border-[var(--sticker-mint)]/30 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            {profile ? '학습 프로필 수정' : '학습 프로필 설정'}
          </button>
        </div>

        {/* 고객 지원 카드 */}
        <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
          <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> 고객 지원
          </h2>

          <button
            onClick={() => navigate('/inquiry')}
            className="w-full py-3 px-4 bg-[var(--paper-cream)] hover:opacity-80 text-[var(--ink-black)] rounded-lg border border-[var(--paper-lines)] transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            1:1 문의하기
          </button>
          <p className="text-xs text-[var(--pencil-gray)] mt-2 text-center">
            궁금한 점이나 건의 사항이 있으면 편하게 문의해주세요
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

      {/* 기본 정보 수정 모달 */}
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
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">이름</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">새 비밀번호 (선택)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                  placeholder="변경할 비밀번호 (6자 이상)"
                />
              </div>

              {editPassword && (
                <div>
                  <label className="block text-sm text-[var(--pencil-gray)] mb-1">비밀번호 확인</label>
                  <input
                    type="password"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                    placeholder="비밀번호를 다시 입력하세요"
                  />
                </div>
              )}

              {updateError && <p className="text-sm text-red-500 text-center">{updateError}</p>}
              {updateSuccess && <p className="text-sm text-green-500 text-center">✅ 정보가 수정되었어요!</p>}
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

      {/* 학습 프로필 수정 모달 */}
      {showEditLearning && editProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <span className="text-4xl">📚</span>
              <h3 className="handwrite handwrite-lg text-[var(--ink-black)] mt-2">
                학습 프로필 수정
              </h3>
            </div>

            <div className="space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--pencil-gray)] mb-1">나이</label>
                  <input
                    type="number"
                    min={15}
                    max={30}
                    value={editProfile.age || ''}
                    onChange={(e) => setEditProfile({ ...editProfile, age: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--pencil-gray)] mb-1">수험 년차</label>
                  <select
                    value={editProfile.examYear}
                    onChange={(e) => setEditProfile({ ...editProfile, examYear: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
                  >
                    <option value={0}>현역 (고3)</option>
                    <option value={1}>재수생</option>
                    <option value={2}>삼수생</option>
                    <option value={3}>그 이상</option>
                  </select>
                </div>
              </div>

              {/* 목표 대학 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-1">목표 대학</label>
                <input
                  type="text"
                  value={editProfile.targetUniversity}
                  onChange={(e) => setEditProfile({ ...editProfile, targetUniversity: e.target.value })}
                  placeholder="예: 서울대학교 경영학과"
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* 탐구 과목 선택 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-2">탐구 과목 선택</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 1</label>
                    <select
                      value={editProfile.selectedTamgu1}
                      onChange={(e) => setEditProfile({ ...editProfile, selectedTamgu1: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                    >
                      <option value="">선택하세요</option>
                      <optgroup label="사회탐구">
                        {SOCIAL_SUBJECTS.map(subj => (
                          <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu2}>{subj}</option>
                        ))}
                      </optgroup>
                      <optgroup label="과학탐구">
                        {SCIENCE_SUBJECTS.map(subj => (
                          <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu2}>{subj}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 2</label>
                    <select
                      value={editProfile.selectedTamgu2}
                      onChange={(e) => setEditProfile({ ...editProfile, selectedTamgu2: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                    >
                      <option value="">선택하세요</option>
                      <optgroup label="사회탐구">
                        {SOCIAL_SUBJECTS.map(subj => (
                          <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu1}>{subj}</option>
                        ))}
                      </optgroup>
                      <optgroup label="과학탐구">
                        {SCIENCE_SUBJECTS.map(subj => (
                          <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu1}>{subj}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              {/* 현재 등급 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-2">현재 등급</label>
                <div className="space-y-2">
                  {[...FIXED_SUBJECTS, ...(editProfile.selectedTamgu1 ? [editProfile.selectedTamgu1] : []), ...(editProfile.selectedTamgu2 ? [editProfile.selectedTamgu2] : [])].map(subject => (
                    <div key={subject} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-[var(--pencil-gray)] truncate">{subject}</span>
                      <div className="flex gap-1 flex-wrap">
                        {GRADES.map(grade => (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleGradeChange('current', subject, grade)}
                            className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                              editProfile.currentGrades[subject] === grade
                                ? 'bg-[var(--sticker-coral)] text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 목표 등급 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-2">목표 등급</label>
                <div className="space-y-2">
                  {[...FIXED_SUBJECTS, ...(editProfile.selectedTamgu1 ? [editProfile.selectedTamgu1] : []), ...(editProfile.selectedTamgu2 ? [editProfile.selectedTamgu2] : [])].map(subject => (
                    <div key={subject} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-[var(--pencil-gray)] truncate">{subject}</span>
                      <div className="flex gap-1 flex-wrap">
                        {GRADES.map(grade => (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleGradeChange('target', subject, grade)}
                            className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                              editProfile.targetGrades[subject] === grade
                                ? 'bg-[var(--sticker-mint)] text-white'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 인강 사이트 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-2">구독 중인 인강 사이트</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PLATFORM_LABELS).map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePlatform(id)}
                      className={`px-2 py-2 border rounded-lg text-xs font-medium transition-all ${
                        editProfile.subscribedPlatforms.includes(id)
                          ? 'bg-[var(--highlight-blue)] border-[var(--ink-blue)] text-[var(--ink-blue)]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 하루 순공 시간 */}
              <div>
                <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                  하루 순공 시간: <span className="font-bold text-[var(--ink-blue)]">{editProfile.dailyStudyHours}시간</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={editProfile.dailyStudyHours}
                  onChange={(e) => setEditProfile({ ...editProfile, dailyStudyHours: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {profileError && <p className="text-sm text-red-500 text-center">{profileError}</p>}
              {profileSuccess && <p className="text-sm text-green-500 text-center">✅ 저장되었어요!</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditLearning(false)}
                disabled={isSavingProfile}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="flex-1 py-2 px-4 bg-[var(--sticker-mint)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSavingProfile ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotebookLayout>
  );
}
