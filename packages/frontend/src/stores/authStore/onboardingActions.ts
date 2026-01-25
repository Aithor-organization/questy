/**
 * Onboarding Actions
 * 온보딩 관련 액션
 */

import { supabase, retryQuery } from '../../lib/supabase';
import type { UserProfile, SetState, GetState } from './types';
import { log } from './utils';

/**
 * 온보딩 완료 여부 확인
 */
export async function checkOnboardingStatus(
  get: GetState,
  set: SetState
): Promise<boolean> {
  const currentUser = get().user;
  if (!currentUser || !supabase) {
    return false;
  }

  // true인 경우만 캐시 신뢰
  if (currentUser.onboardingCompleted === true) {
    log.log(' onboardingCompleted already true, skipping check');
    return true;
  }

  log.log(' Checking onboarding status from DB...');

  try {
    const { data, error } = await retryQuery<{
      onboarding_completed: boolean | null;
      target_university: string | null;
    }>(() =>
      supabase!
        .from('user_profiles')
        .select('onboarding_completed, target_university')
        .eq('id', currentUser.id)
        .single()
    );

    if (error) {
      if (error.code === 'PGRST116') {
        log.log(' No profile found, onboarding needed');
        set({ user: { ...currentUser, onboardingCompleted: false } });
        return false;
      }
      console.warn('[Auth] Onboarding check error:', error.code, error.message);
      return currentUser.onboardingCompleted ?? false;
    }

    const hasLearningGoal = !!data?.target_university;
    const completed = data?.onboarding_completed || hasLearningGoal;

    log.log(' Onboarding check result:', {
      onboarding_completed: data?.onboarding_completed,
      target_university: data?.target_university,
      result: completed,
    });

    set({
      user: { ...currentUser, onboardingCompleted: completed },
      ...(completed ? {} : { needsOnboarding: true }),
    });
    return completed;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      log.log(' Onboarding check cancelled');
      return currentUser.onboardingCompleted ?? false;
    }
    console.error('[Auth] Check onboarding error:', err);
    return currentUser.onboardingCompleted ?? false;
  }
}

/**
 * 학습 프로필 로드 (온보딩 데이터)
 */
export async function loadUserProfile(
  get: GetState,
  set: SetState
): Promise<UserProfile | null> {
  const currentUser = get().user;
  if (!currentUser || !supabase) {
    return null;
  }

  try {
    const { data, error } = await retryQuery<{
      age: number | null;
      exam_year: number | null;
      target_university: string | null;
      target_grades: Record<string, number> | null;
      current_grades: Record<string, number> | null;
      selected_tamgu1: string | null;
      selected_tamgu2: string | null;
      subscribed_platforms: string[] | null;
      daily_study_hours: number | null;
    }>(() =>
      supabase!.from('user_profiles').select('*').eq('id', currentUser.id).single()
    );

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        log.log(' No user profile found (not created yet)');
      } else if (error) {
        console.warn('[Auth] User profile load error:', error.code, error.message);
      }
      return null;
    }

    const profile: UserProfile = {
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

    set({ userProfile: profile });
    log.log(' User profile loaded:', profile.targetUniversity);
    return profile;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      log.log(' User profile load cancelled');
      return null;
    }
    console.error('[Auth] Load user profile exception:', err);
    return null;
  }
}
