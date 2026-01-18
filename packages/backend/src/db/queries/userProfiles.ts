/**
 * User Profile Queries
 * Supabase에서 사용자 정보와 학습 프로필을 가져오는 함수들
 */

import { supabase } from '../supabase.js';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  age: number | null;
  examYear: number | null;
  targetUniversity: string | null;
  targetGrades: Record<string, number> | null;
  currentGrades: Record<string, number> | null;
  selectedTamgu1: string | null;
  selectedTamgu2: string | null;
  subscribedPlatforms: string[] | null;
  dailyStudyHours: number | null;
}

/**
 * 사용자 정보 및 학습 프로필 조회 (코치용)
 * auth.users와 user_profiles 테이블에서 정보를 가져옴
 */
export async function getUserProfileForCoach(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    console.warn('[DB/UserProfiles] Supabase not available');
    return null;
  }

  try {
    // 1. auth.users에서 기본 정보 가져오기
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError) {
      console.warn('[DB/UserProfiles] Failed to get auth user:', authError.message);
    }

    // 2. user_profiles에서 학습 프로필 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('[DB/UserProfiles] Failed to get user profile:', profileError.message);
    }

    // 3. 두 데이터 병합하여 반환
    const userName = authUser?.user?.user_metadata?.name || profile?.name || null;
    const userEmail = authUser?.user?.email || null;

    return {
      id: userId,
      name: userName,
      email: userEmail,
      age: profile?.age || null,
      examYear: profile?.exam_year || null,
      targetUniversity: profile?.target_university || null,
      targetGrades: profile?.target_grades || null,
      currentGrades: profile?.current_grades || null,
      selectedTamgu1: profile?.selected_tamgu1 || null,
      selectedTamgu2: profile?.selected_tamgu2 || null,
      subscribedPlatforms: profile?.subscribed_platforms || null,
      dailyStudyHours: profile?.daily_study_hours || null,
    };
  } catch (error) {
    console.error('[DB/UserProfiles] Error getting user profile:', error);
    return null;
  }
}

/**
 * 간단한 사용자 정보 조회 (이름, 이메일만)
 */
export async function getUserBasicInfo(userId: string): Promise<{ name: string | null; email: string | null } | null> {
  if (!supabase) {
    console.warn('[DB/UserProfiles] Supabase not available');
    return null;
  }

  try {
    const { data: authUser, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      console.warn('[DB/UserProfiles] Failed to get auth user:', error.message);
      return null;
    }

    return {
      name: authUser?.user?.user_metadata?.name || null,
      email: authUser?.user?.email || null,
    };
  } catch (error) {
    console.error('[DB/UserProfiles] Error getting basic user info:', error);
    return null;
  }
}
