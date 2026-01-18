/**
 * Supabase 플랜 성과 클라이언트
 * plan_performance 테이블과 연동
 * - 플랜 성과 저장/조회
 * - 학습된 최적값 계산
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Subject, PlanPerformanceMemory, LearnedOptimalValues } from '../../../../types/memory.js';

// Supabase 테이블 레코드 타입
interface PerformanceRecord {
  id: string;
  student_id: string;
  plan_id: string;
  subject: string;
  material_name: string;
  total_days: number;
  daily_minutes: number;
  total_units: number;
  completion_rate: number;
  average_quest_success: number;
  average_study_time: number;
  drop_off_day: number | null;
  streak_days: number;
  student_rating: number | null;
  student_feedback: string | null;
  difficulty_perception: string;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

let supabase: SupabaseClient | null = null;
let useFallback = false;

// 인메모리 폴백 저장소
const fallbackStore: Map<string, PlanPerformanceMemory[]> = new Map();

/**
 * Supabase 클라이언트 초기화
 */
async function initSupabase(): Promise<boolean> {
  if (supabase) return !useFallback;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[SupabasePerformanceClient] Supabase 설정 없음, 인메모리 폴백 사용');
    useFallback = true;
    return false;
  }

  try {
    supabase = createClient(url, key);
    const { error } = await supabase.from('plan_performance').select('id').limit(1);
    if (error) {
      console.warn('[SupabasePerformanceClient] Supabase 연결 실패:', error.message);
      useFallback = true;
      return false;
    }
    console.log('[SupabasePerformanceClient] Supabase 연결 성공');
    return true;
  } catch (error) {
    console.warn('[SupabasePerformanceClient] Supabase 초기화 실패:', error);
    useFallback = true;
    return false;
  }
}

/**
 * 레코드를 PlanPerformanceMemory로 변환
 */
function recordToPerformance(row: PerformanceRecord): PlanPerformanceMemory {
  return {
    id: row.id,
    type: 'PLAN_PERFORMANCE',
    studentId: row.student_id,
    planId: row.plan_id,
    subject: row.subject as Subject,
    materialName: row.material_name,
    totalDays: row.total_days,
    dailyMinutes: row.daily_minutes,
    totalUnits: row.total_units,
    completionRate: row.completion_rate,
    averageQuestSuccess: row.average_quest_success,
    averageStudyTime: row.average_study_time,
    dropOffDay: row.drop_off_day ?? undefined,
    streakDays: row.streak_days,
    studentRating: row.student_rating ?? undefined,
    studentFeedback: row.student_feedback ?? undefined,
    difficultyPerception: row.difficulty_perception as PlanPerformanceMemory['difficultyPerception'],
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    metadata: row.metadata as PlanPerformanceMemory['metadata'],
  };
}

/**
 * PlanPerformanceMemory를 레코드로 변환
 */
function performanceToRecord(
  performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
): Record<string, unknown> {
  return {
    student_id: performance.studentId,
    plan_id: performance.planId,
    subject: performance.subject,
    material_name: performance.materialName,
    total_days: performance.totalDays,
    daily_minutes: performance.dailyMinutes,
    total_units: performance.totalUnits,
    completion_rate: performance.completionRate,
    average_quest_success: performance.averageQuestSuccess,
    average_study_time: performance.averageStudyTime,
    drop_off_day: performance.dropOffDay ?? null,
    streak_days: performance.streakDays,
    student_rating: performance.studentRating ?? null,
    student_feedback: performance.studentFeedback ?? null,
    difficulty_perception: performance.difficultyPerception,
    metadata: performance.metadata ?? {},
    completed_at: performance.completedAt?.toISOString() ?? null,
  };
}

/**
 * 플랜 성과 저장
 */
export async function storePlanPerformance(
  performance: Omit<PlanPerformanceMemory, 'id' | 'type' | 'createdAt'>
): Promise<string> {
  const connected = await initSupabase();

  if (!connected || useFallback) {
    const id = `perf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const record: PlanPerformanceMemory = {
      ...performance,
      id,
      type: 'PLAN_PERFORMANCE',
      createdAt: new Date(),
    };

    const items = fallbackStore.get(performance.studentId) || [];
    items.push(record);
    fallbackStore.set(performance.studentId, items);

    console.log(`[SupabasePerformanceClient] Fallback - 성과 저장: ${id}`);
    return id;
  }

  const { data, error } = await supabase!
    .from('plan_performance')
    .insert(performanceToRecord(performance))
    .select('id')
    .single();

  if (error) {
    console.error('[SupabasePerformanceClient] storePlanPerformance 실패:', error.message);
    // 폴백으로 저장
    const id = `perf-${Date.now()}`;
    const record: PlanPerformanceMemory = {
      ...performance,
      id,
      type: 'PLAN_PERFORMANCE',
      createdAt: new Date(),
    };
    const items = fallbackStore.get(performance.studentId) || [];
    items.push(record);
    fallbackStore.set(performance.studentId, items);
    return id;
  }

  console.log(`[SupabasePerformanceClient] 성과 저장 완료: ${data.id}`);
  return data.id;
}

/**
 * 학생의 과거 플랜 성과 조회
 */
export async function fetchPastPerformance(
  studentId: string,
  subject?: Subject
): Promise<PlanPerformanceMemory[]> {
  const connected = await initSupabase();

  if (!connected || useFallback) {
    const items = fallbackStore.get(studentId) || [];
    return subject
      ? items.filter(p => p.subject === subject)
      : items;
  }

  let query = supabase!
    .from('plan_performance')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[SupabasePerformanceClient] fetchPastPerformance 실패:', error.message);
    return fallbackStore.get(studentId) || [];
  }

  return (data || []).map((row: PerformanceRecord) => recordToPerformance(row));
}

/**
 * 성공적인 플랜만 조회 (완료율 threshold 이상)
 */
export async function fetchSuccessfulPerformance(
  studentId: string,
  subject?: Subject,
  threshold: number = 0.7
): Promise<PlanPerformanceMemory[]> {
  const connected = await initSupabase();

  if (!connected || useFallback) {
    const items = fallbackStore.get(studentId) || [];
    return items.filter(
      p => p.completionRate >= threshold && (!subject || p.subject === subject)
    );
  }

  let query = supabase!
    .from('plan_performance')
    .select('*')
    .eq('student_id', studentId)
    .gte('completion_rate', threshold)
    .order('created_at', { ascending: false });

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[SupabasePerformanceClient] fetchSuccessfulPerformance 실패:', error.message);
    return [];
  }

  return (data || []).map((row: PerformanceRecord) => recordToPerformance(row));
}

/**
 * 플랜 성과 업데이트
 */
export async function updatePlanPerformance(
  performanceId: string,
  updates: Partial<Omit<PlanPerformanceMemory, 'id' | 'type' | 'studentId' | 'planId' | 'createdAt'>>
): Promise<void> {
  const connected = await initSupabase();

  if (!connected || useFallback) {
    // 폴백 저장소에서 업데이트
    for (const [studentId, items] of Array.from(fallbackStore.entries())) {
      const idx = items.findIndex(p => p.id === performanceId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...updates };
        fallbackStore.set(studentId, items);
        break;
      }
    }
    return;
  }

  const updateRecord: Record<string, unknown> = {};
  if (updates.completionRate !== undefined) updateRecord.completion_rate = updates.completionRate;
  if (updates.averageQuestSuccess !== undefined) updateRecord.average_quest_success = updates.averageQuestSuccess;
  if (updates.averageStudyTime !== undefined) updateRecord.average_study_time = updates.averageStudyTime;
  if (updates.dropOffDay !== undefined) updateRecord.drop_off_day = updates.dropOffDay;
  if (updates.streakDays !== undefined) updateRecord.streak_days = updates.streakDays;
  if (updates.studentRating !== undefined) updateRecord.student_rating = updates.studentRating;
  if (updates.studentFeedback !== undefined) updateRecord.student_feedback = updates.studentFeedback;
  if (updates.difficultyPerception !== undefined) updateRecord.difficulty_perception = updates.difficultyPerception;
  if (updates.completedAt !== undefined) updateRecord.completed_at = updates.completedAt?.toISOString();
  if (updates.metadata !== undefined) updateRecord.metadata = updates.metadata;

  const { error } = await supabase!
    .from('plan_performance')
    .update(updateRecord)
    .eq('id', performanceId);

  if (error) {
    console.error('[SupabasePerformanceClient] updatePlanPerformance 실패:', error.message);
  }
}

/**
 * 이탈 일차 통계 조회 (학습된 패턴)
 */
export async function fetchDropOffStatistics(
  studentId: string,
  subject?: Subject
): Promise<number[]> {
  const performances = await fetchPastPerformance(studentId, subject);

  // 이탈한 플랜만 필터링
  const dropOffDays = performances
    .filter(p => p.dropOffDay !== undefined && p.dropOffDay > 0)
    .map(p => p.dropOffDay!);

  return dropOffDays;
}

/**
 * 학생의 학습 통계 요약
 */
export async function fetchPerformanceSummary(
  studentId: string,
  subject?: Subject
): Promise<{
  totalPlans: number;
  avgCompletionRate: number;
  avgDailyMinutes: number;
  avgStudyTime: number;
  commonDropOffDays: number[];
}> {
  const performances = await fetchPastPerformance(studentId, subject);

  if (performances.length === 0) {
    return {
      totalPlans: 0,
      avgCompletionRate: 0,
      avgDailyMinutes: 0,
      avgStudyTime: 0,
      commonDropOffDays: [],
    };
  }

  const sum = performances.reduce(
    (acc, p) => ({
      completionRate: acc.completionRate + p.completionRate,
      dailyMinutes: acc.dailyMinutes + p.dailyMinutes,
      studyTime: acc.studyTime + p.averageStudyTime,
    }),
    { completionRate: 0, dailyMinutes: 0, studyTime: 0 }
  );

  // 이탈 일차 분석
  const dropOffDays = await fetchDropOffStatistics(studentId, subject);
  const commonDropOffDays = findCommonDropOffDays(dropOffDays);

  return {
    totalPlans: performances.length,
    avgCompletionRate: sum.completionRate / performances.length,
    avgDailyMinutes: sum.dailyMinutes / performances.length,
    avgStudyTime: sum.studyTime / performances.length,
    commonDropOffDays,
  };
}

/**
 * 공통 이탈 일차 분석 (5일 단위 버킷팅)
 */
function findCommonDropOffDays(dropOffDays: number[]): number[] {
  if (dropOffDays.length === 0) return [];

  const frequency: Record<number, number> = {};
  dropOffDays.forEach(day => {
    const bucket = Math.round(day / 5) * 5; // 5일 단위
    frequency[bucket] = (frequency[bucket] || 0) + 1;
  });

  // 2회 이상 발생한 일차만 반환
  return Object.entries(frequency)
    .filter(([_, count]) => count >= 2)
    .map(([day]) => parseInt(day))
    .sort((a, b) => a - b);
}

/**
 * 학습된 최적값 계산 (성공 플랜 기반)
 */
export async function calculateOptimalValues(
  studentId: string,
  subject?: Subject
): Promise<LearnedOptimalValues | null> {
  const successfulPlans = await fetchSuccessfulPerformance(studentId, subject, 0.7);

  if (successfulPlans.length < 2) {
    return null; // 데이터 부족
  }

  // 성공 플랜에서 평균값 계산
  const sum = successfulPlans.reduce(
    (acc, p) => ({
      dailyMinutes: acc.dailyMinutes + p.dailyMinutes,
      studyTime: acc.studyTime + p.averageStudyTime,
    }),
    { dailyMinutes: 0, studyTime: 0 }
  );

  const avgDailyMinutes = sum.dailyMinutes / successfulPlans.length;
  const avgStudyTime = sum.studyTime / successfulPlans.length;

  // 이탈 위험 일차 분석
  const allPerformances = await fetchPastPerformance(studentId, subject);
  const dropOffDays = allPerformances
    .filter(p => p.dropOffDay !== undefined)
    .map(p => p.dropOffDay!);
  const commonDropOffDays = findCommonDropOffDays(dropOffDays);

  // 선호 학습 시간대 추출 (metadata에서)
  let preferredStudyHour = 20; // 기본값
  const hoursFromMeta = successfulPlans
    .map(p => p.metadata?.peakStudyHour)
    .filter((h): h is number => typeof h === 'number');
  if (hoursFromMeta.length > 0) {
    preferredStudyHour = Math.round(
      hoursFromMeta.reduce((a, b) => a + b, 0) / hoursFromMeta.length
    );
  }

  return {
    studentId,
    subject: subject || 'GENERAL',
    optimalDailyMinutes: Math.round(avgDailyMinutes),
    optimalSessionLength: Math.round(avgStudyTime),
    preferredStudyHour,
    dropOffRiskDays: commonDropOffDays,
    fatigueThreshold: 90, // TODO: 데이터에서 학습
    dataPoints: successfulPlans.length,
    lastUpdated: new Date(),
  };
}

/**
 * 플랜 성과 삭제
 */
export async function deletePlanPerformance(performanceId: string): Promise<void> {
  const connected = await initSupabase();

  if (!connected || useFallback) {
    for (const [studentId, items] of Array.from(fallbackStore.entries())) {
      const filtered = items.filter(p => p.id !== performanceId);
      if (filtered.length !== items.length) {
        fallbackStore.set(studentId, filtered);
        break;
      }
    }
    return;
  }

  const { error } = await supabase!
    .from('plan_performance')
    .delete()
    .eq('id', performanceId);

  if (error) {
    console.error('[SupabasePerformanceClient] deletePlanPerformance 실패:', error.message);
  }
}

/**
 * 폴백 저장소 초기화 (테스트용)
 */
export function clearFallbackStore(): void {
  fallbackStore.clear();
}
