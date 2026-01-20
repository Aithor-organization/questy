/**
 * Plan Generation Storage
 * 플랜 생성 횟수 제한 및 미적용 플랜 저장 관리
 * - Supabase에 저장 (로그인 시)
 * - localStorage 캐시/폴백 지원
 */

import type { GenerateResult } from '../hooks/useQuestGeneration';
import { supabase } from './supabase';
import type { DayOfWeek } from '@questybook/shared';

// localStorage 키
const GENERATION_DATA_KEY = 'questy_plan_generation_data';
const PENDING_PLAN_KEY = 'questy_pending_plan';

// Supabase 저장 키
const STORE_NAME = 'plan_limits';
const STORAGE_KEY = 'generation_data';

// 제한 설정
const MAX_GENERATIONS_PER_WEEK = 3;
const PENDING_PLAN_EXPIRY_HOURS = 12;

interface GenerationData {
  count: number;
  resetAt: number; // timestamp
}

interface PendingPlanData {
  result: GenerateResult;
  totalDays: number;
  selectedDays?: DayOfWeek[];  // 선택된 요일 (선택적, 이전 버전 호환)
  createdAt: number; // timestamp
}

/**
 * 다음 월요일 새벽 2시 시간 반환
 * 매주 월요일 02:00에 리셋
 */
function getNextMondayAt2AM(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = 일요일, 1 = 월요일, ...

  // 오늘이 월요일이고 아직 02:00 전이면 오늘 02:00
  if (dayOfWeek === 1 && now.getHours() < 2) {
    const today = new Date(now);
    today.setHours(2, 0, 0, 0);
    return today.getTime();
  }

  // 다음 월요일까지 남은 일수 계산
  // 일요일(0) -> 1일, 월요일(1) -> 7일, 화요일(2) -> 6일, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(2, 0, 0, 0);

  return nextMonday.getTime();
}

/**
 * 사용자 ID 가져오기
 */
async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * localStorage에서 생성 데이터 조회
 */
function getLocalGenerationData(): GenerationData | null {
  try {
    const data = localStorage.getItem(GENERATION_DATA_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * localStorage에 생성 데이터 저장
 */
function setLocalGenerationData(data: GenerationData): void {
  try {
    localStorage.setItem(GENERATION_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[PlanStorage] localStorage 저장 실패:', e);
  }
}

/**
 * Supabase에서 생성 데이터 조회
 */
async function getSupabaseGenerationData(userId: string): Promise<GenerationData | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_storage')
      .select('value')
      .eq('user_id', userId)
      .eq('store_name', STORE_NAME)
      .eq('key', STORAGE_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[PlanStorage] Supabase 조회 실패:', error.message);
      return null;
    }

    if (data?.value) {
      return JSON.parse(data.value);
    }

    return null;
  } catch (e) {
    console.error('[PlanStorage] Supabase 조회 에러:', e);
    return null;
  }
}

/**
 * Supabase에 생성 데이터 저장
 */
async function setSupabaseGenerationData(userId: string, data: GenerationData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('user_storage')
      .upsert(
        {
          user_id: userId,
          store_name: STORE_NAME,
          key: STORAGE_KEY,
          value: JSON.stringify(data),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,store_name,key',
        }
      );

    if (error) {
      console.error('[PlanStorage] Supabase 저장 실패:', error.message);
      return false;
    }

    console.log('[PlanStorage] Supabase 저장 성공:', data);
    return true;
  } catch (e) {
    console.error('[PlanStorage] Supabase 저장 에러:', e);
    return false;
  }
}

/**
 * 생성 데이터 가져오기 (Supabase 우선, localStorage 폴백)
 */
async function getGenerationData(): Promise<GenerationData> {
  const defaultData: GenerationData = { count: 0, resetAt: getNextMondayAt2AM() };

  // 1. 로그인 상태 확인
  const userId = await getUserId();

  // 2. Supabase에서 조회 (로그인 시)
  if (userId) {
    const supabaseData = await getSupabaseGenerationData(userId);
    if (supabaseData) {
      // 리셋 시간 체크
      if (Date.now() >= supabaseData.resetAt) {
        // 리셋 시간 지남 - 초기화
        const newData = { count: 0, resetAt: getNextMondayAt2AM() };
        setLocalGenerationData(newData);
        // 비동기로 Supabase 업데이트 (await 안 함)
        setSupabaseGenerationData(userId, newData);
        return newData;
      }
      // localStorage 캐시 업데이트
      setLocalGenerationData(supabaseData);
      return supabaseData;
    }
  }

  // 3. localStorage 폴백
  const localData = getLocalGenerationData();
  if (localData) {
    // 리셋 시간 체크
    if (Date.now() >= localData.resetAt) {
      // 리셋 시간 지남 - 초기화
      const newData = { count: 0, resetAt: getNextMondayAt2AM() };
      setLocalGenerationData(newData);
      return newData;
    }
    return localData;
  }

  return defaultData;
}

/**
 * 플랜 생성 횟수 조회 (비동기)
 */
export async function getGenerationCountAsync(): Promise<number> {
  const data = await getGenerationData();
  return data.count;
}

/**
 * 플랜 생성 가능 여부 확인 (비동기)
 */
export async function canGeneratePlanAsync(): Promise<boolean> {
  const count = await getGenerationCountAsync();
  return count < MAX_GENERATIONS_PER_WEEK;
}

/**
 * 남은 생성 횟수 조회 (비동기)
 */
export async function getRemainingGenerationsAsync(): Promise<number> {
  const count = await getGenerationCountAsync();
  return Math.max(0, MAX_GENERATIONS_PER_WEEK - count);
}

/**
 * 플랜 생성 횟수 증가 (비동기)
 */
export async function incrementGenerationCountAsync(): Promise<void> {
  try {
    const currentData = await getGenerationData();
    const newData: GenerationData = {
      count: currentData.count + 1,
      resetAt: currentData.resetAt || getNextMondayAt2AM(),
    };

    // 1. localStorage에 즉시 저장
    setLocalGenerationData(newData);

    // 2. Supabase에 저장 (로그인 시)
    const userId = await getUserId();
    if (userId) {
      await setSupabaseGenerationData(userId, newData);
    }

    console.log(`[PlanStorage] 생성 횟수 증가: ${currentData.count} → ${newData.count}`);
  } catch (e) {
    console.error('[PlanStorage] 횟수 증가 실패:', e);
  }
}

/**
 * 리셋까지 남은 시간 (밀리초) - 비동기
 */
export async function getTimeUntilResetAsync(): Promise<number> {
  const data = await getGenerationData();
  return Math.max(0, data.resetAt - Date.now());
}

// ===== 동기 버전 (localStorage 캐시 기반, 즉시 응답 필요한 경우) =====

/**
 * 플랜 생성 횟수 조회 (동기 - 캐시 기반)
 * 주의: Supabase 데이터와 다를 수 있음, UI 초기 렌더링용
 */
export function getGenerationCount(): number {
  const data = getLocalGenerationData();
  if (!data) return 0;

  // 리셋 시간 체크
  if (Date.now() >= data.resetAt) {
    return 0;
  }

  return data.count;
}

/**
 * 플랜 생성 가능 여부 확인 (동기 - 캐시 기반)
 */
export function canGeneratePlan(): boolean {
  return getGenerationCount() < MAX_GENERATIONS_PER_WEEK;
}

/**
 * 남은 생성 횟수 조회 (동기 - 캐시 기반)
 */
export function getRemainingGenerations(): number {
  return Math.max(0, MAX_GENERATIONS_PER_WEEK - getGenerationCount());
}

/**
 * 플랜 생성 횟수 증가 (동기 + 비동기 Supabase 저장)
 * @deprecated incrementGenerationCountAsync 사용 권장
 */
export function incrementGenerationCount(): void {
  // 비동기로 실행 (fire-and-forget)
  incrementGenerationCountAsync().catch(console.error);
}

/**
 * 리셋까지 남은 시간 (밀리초) - 동기
 */
export function getTimeUntilReset(): number {
  const data = getLocalGenerationData();
  if (!data) return 0;
  return Math.max(0, data.resetAt - Date.now());
}

// ===== 미적용 플랜 관련 (localStorage만 사용) =====

/**
 * 미적용 플랜 저장
 */
export function savePendingPlan(
  result: GenerateResult,
  totalDays: number,
  selectedDays: DayOfWeek[]
): void {
  try {
    const data: PendingPlanData = {
      result,
      totalDays,
      selectedDays,
      createdAt: Date.now(),
    };
    localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[PlanStorage] Failed to save pending plan:', e);
  }
}

/**
 * 미적용 플랜 조회 (만료 체크 포함)
 */
export function getPendingPlan(): PendingPlanData | null {
  try {
    const data = localStorage.getItem(PENDING_PLAN_KEY);
    if (!data) return null;

    const parsed: PendingPlanData = JSON.parse(data);

    // 12시간 만료 체크
    const expiryTime = parsed.createdAt + (PENDING_PLAN_EXPIRY_HOURS * 60 * 60 * 1000);
    if (Date.now() >= expiryTime) {
      localStorage.removeItem(PENDING_PLAN_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 미적용 플랜 삭제
 */
export function clearPendingPlan(): void {
  try {
    localStorage.removeItem(PENDING_PLAN_KEY);
  } catch (e) {
    console.error('[PlanStorage] Failed to clear pending plan:', e);
  }
}

/**
 * 미적용 플랜 만료까지 남은 시간 (밀리초)
 */
export function getPendingPlanTimeRemaining(): number {
  try {
    const data = localStorage.getItem(PENDING_PLAN_KEY);
    if (!data) return 0;

    const parsed: PendingPlanData = JSON.parse(data);
    const expiryTime = parsed.createdAt + (PENDING_PLAN_EXPIRY_HOURS * 60 * 60 * 1000);
    return Math.max(0, expiryTime - Date.now());
  } catch {
    return 0;
  }
}

/**
 * 남은 시간을 읽기 쉬운 형식으로 변환
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '만료됨';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남음`;
  }
  return `${minutes}분 남음`;
}
