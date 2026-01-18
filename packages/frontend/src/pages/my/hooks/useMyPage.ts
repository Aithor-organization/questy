/**
 * useMyPage Hook
 * MyPage의 상태 관리 로직
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import type { ProfileData } from '../types';

export function useMyPage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile, userProfile, loadUserProfile, setUserProfile } = useAuthStore();

  // 기본 정보 수정 상태
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // 학습 프로필 상태 (authStore에서 가져옴)
  const [profile, setProfile] = useState<ProfileData | null>(userProfile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(!userProfile);
  const [showEditLearning, setShowEditLearning] = useState(false);
  const [editProfile, setEditProfile] = useState<ProfileData | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // authStore의 userProfile이 변경되면 로컬 상태도 업데이트
  useEffect(() => {
    if (userProfile) {
      setProfile(userProfile);
      setIsLoadingProfile(false);
    }
  }, [userProfile]);

  // 프로필 데이터 로드 (authStore에 없을 때만 Supabase에서 가져옴)
  useEffect(() => {
    async function loadProfile() {
      // 이미 authStore에 프로필이 있으면 스킵
      if (userProfile) {
        setProfile(userProfile);
        setIsLoadingProfile(false);
        return;
      }

      if (!user || !supabase) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        // authStore의 loadUserProfile 사용 (persist됨)
        const loadedProfile = await loadUserProfile();
        if (loadedProfile) {
          setProfile(loadedProfile);
        } else {
          // Supabase에서 직접 가져오기 (폴백)
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            setProfile(null);
          } else if (data) {
            const profileData: ProfileData = {
              age: data.age,
              examYear: data.exam_year || 0,
              targetUniversity: data.target_university || '',
              targetGrades: data.target_grades || {},
              currentGrades: data.current_grades || {},
              selectedTamgu1: data.selected_tamgu1 || '',
              selectedTamgu2: data.selected_tamgu2 || '',
              subscribedPlatforms: data.subscribed_platforms || [],
              dailyStudyHours: data.daily_study_hours || 8,
            };
            setProfile(profileData);
            // authStore에도 저장 (persist)
            setUserProfile(profileData);
          }
        }
      } catch (err) {
        console.error('[MyPage] Profile load error:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadProfile();
  }, [user, userProfile, loadUserProfile, setUserProfile]);

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
    if (editName.trim() !== user?.name) updates.name = editName.trim();
    if (editPassword) updates.password = editPassword;

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

  const handleSaveProfile = async () => {
    if (!user || !supabase || !editProfile) return;

    setProfileError(null);
    setIsSavingProfile(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setProfileError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('요청 시간 초과 (10초)')), 10000);
      });

      const upsertPromise = supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
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

      const { error } = await Promise.race([upsertPromise, timeoutPromise]);

      if (error) {
        setProfileError(`저장에 실패했습니다: ${error.message}`);
        return;
      }

      setProfile({ ...editProfile });
      // authStore에도 저장 (persist)
      setUserProfile({ ...editProfile });
      setProfileSuccess(true);
      setTimeout(() => {
        setShowEditLearning(false);
        setProfileSuccess(false);
      }, 1500);
    } catch (err) {
      setProfileError(`오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleGradeChange = (type: 'target' | 'current', subject: string, grade: number) => {
    if (!editProfile) return;
    if (type === 'target') {
      setEditProfile({ ...editProfile, targetGrades: { ...editProfile.targetGrades, [subject]: grade } });
    } else {
      setEditProfile({ ...editProfile, currentGrades: { ...editProfile.currentGrades, [subject]: grade } });
    }
  };

  const togglePlatform = (platformId: string) => {
    if (!editProfile) return;
    const platforms = editProfile.subscribedPlatforms.includes(platformId)
      ? editProfile.subscribedPlatforms.filter(p => p !== platformId)
      : [...editProfile.subscribedPlatforms, platformId];
    setEditProfile({ ...editProfile, subscribedPlatforms: platforms });
  };

  return {
    // 상태
    user, profile, editProfile, isLoadingProfile, showEditProfile, showEditLearning,
    editName, editPassword, editPasswordConfirm, isUpdating, updateError, updateSuccess,
    isSavingProfile, profileError, profileSuccess,
    // 액션
    setEditName, setEditPassword, setEditPasswordConfirm, setEditProfile,
    setShowEditProfile, setShowEditLearning,
    handleLogout, openEditModal, handleUpdateProfile, openEditLearning, handleSaveProfile,
    handleGradeChange, togglePlatform, navigate,
  };
}
