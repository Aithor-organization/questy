/**
 * Plan Generation Storage
 * 플랜 생성 횟수 제한 및 미적용 플랜 저장 관리
 */

import type { GenerateResult } from '../hooks/useQuestGeneration';

// localStorage 키
const GENERATION_COUNT_KEY = 'questy_plan_generation_count';
const GENERATION_RESET_KEY = 'questy_plan_generation_reset';
const PENDING_PLAN_KEY = 'questy_pending_plan';

// 제한 설정
const MAX_GENERATIONS_PER_DAY = 3;
const PENDING_PLAN_EXPIRY_HOURS = 12;

interface PendingPlanData {
  result: GenerateResult;
  totalDays: number;
  excludeWeekends: boolean;
  createdAt: number; // timestamp
}

/**
 * 오늘 자정 시간 반환 (다음 날 00:00)
 */
function getTomorrowMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * 플랜 생성 횟수 조회
 */
export function getGenerationCount(): number {
  try {
    const data = localStorage.getItem(GENERATION_COUNT_KEY);
    const resetAt = localStorage.getItem(GENERATION_RESET_KEY);

    if (!data || !resetAt) return 0;

    const resetTime = parseInt(resetAt, 10);

    // 리셋 시간이 지났으면 카운트 초기화
    if (Date.now() >= resetTime) {
      localStorage.removeItem(GENERATION_COUNT_KEY);
      localStorage.removeItem(GENERATION_RESET_KEY);
      return 0;
    }

    return parseInt(data, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * 플랜 생성 가능 여부 확인
 */
export function canGeneratePlan(): boolean {
  return getGenerationCount() < MAX_GENERATIONS_PER_DAY;
}

/**
 * 남은 생성 횟수 조회
 */
export function getRemainingGenerations(): number {
  return Math.max(0, MAX_GENERATIONS_PER_DAY - getGenerationCount());
}

/**
 * 플랜 생성 횟수 증가
 */
export function incrementGenerationCount(): void {
  try {
    const currentCount = getGenerationCount();
    const resetAt = localStorage.getItem(GENERATION_RESET_KEY);

    // 리셋 시간이 없거나 지났으면 새로 설정
    if (!resetAt || Date.now() >= parseInt(resetAt, 10)) {
      localStorage.setItem(GENERATION_RESET_KEY, getTomorrowMidnight().toString());
    }

    localStorage.setItem(GENERATION_COUNT_KEY, (currentCount + 1).toString());
  } catch (e) {
    console.error('[PlanStorage] Failed to increment generation count:', e);
  }
}

/**
 * 리셋까지 남은 시간 (밀리초)
 */
export function getTimeUntilReset(): number {
  try {
    const resetAt = localStorage.getItem(GENERATION_RESET_KEY);
    if (!resetAt) return 0;

    const resetTime = parseInt(resetAt, 10);
    return Math.max(0, resetTime - Date.now());
  } catch {
    return 0;
  }
}

/**
 * 미적용 플랜 저장
 */
export function savePendingPlan(
  result: GenerateResult,
  totalDays: number,
  excludeWeekends: boolean
): void {
  try {
    const data: PendingPlanData = {
      result,
      totalDays,
      excludeWeekends,
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
