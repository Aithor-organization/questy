/**
 * Supabase 리뷰 패턴 클라이언트
 * review_patterns 테이블과 연동
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Subject, ReviewPatternMemory } from '../../../../types/memory.js';

// Supabase 테이블 레코드 타입
interface PatternRecord {
  id: string;
  pattern_id: string;
  pattern_name: string;
  description: string | null;
  trigger_conditions: Record<string, unknown>;
  issue_description: string | null;
  suggested_fix: string | null;
  successful_fix_count: number;
  failed_fix_count: number;
  confidence: number;
  validation_score: number;
  usage_count: number;
  subject: string | null;
  created_at: string;
  last_used_at: string;
}

let supabase: SupabaseClient | null = null;
let useFallback = false;

// 기본 패턴 (폴백용)
const DEFAULT_PATTERNS: ReviewPatternMemory[] = [
  {
    id: 'RP-001',
    type: 'REVIEW_PATTERN',
    patternId: 'OVERLOAD_WARNING',
    patternName: '과부하 경고 패턴',
    description: '하루 학습량이 너무 많으면 이탈 위험',
    triggerConditions: { dailyMinutes: { min: 90 } },
    issueDescription: '하루 90분 이상 학습은 지속하기 어렵습니다',
    suggestedFix: '학습 기간을 늘리거나 하루 학습량을 60분 이하로 조정',
    successfulFixCount: 15,
    failedFixCount: 2,
    confidence: 0.88,
    validationScore: 0.85,
    createdAt: new Date('2024-01-01'),
    lastUsedAt: new Date(),
    usageCount: 17,
  },
  {
    id: 'RP-002',
    type: 'REVIEW_PATTERN',
    patternId: 'NO_REST_DAY',
    patternName: '휴식일 부재 패턴',
    description: '2주 이상 플랜에 휴식일이 없음',
    triggerConditions: { planDuration: { min: 14 } },
    issueDescription: '장기 플랜에 휴식일이 없으면 번아웃 위험',
    suggestedFix: '7일마다 가벼운 복습일 또는 휴식일 추가',
    successfulFixCount: 22,
    failedFixCount: 3,
    confidence: 0.88,
    validationScore: 0.9,
    createdAt: new Date('2024-01-15'),
    lastUsedAt: new Date(),
    usageCount: 25,
  },
  {
    id: 'RP-003',
    type: 'REVIEW_PATTERN',
    patternId: 'FRONT_LOADED',
    patternName: '초반 집중 패턴',
    description: '초반에 학습량이 몰려있음',
    triggerConditions: {},
    issueDescription: '초반 과다 학습은 조기 포기로 이어질 수 있습니다',
    suggestedFix: '학습량을 균등하게 분배하거나 점진적으로 증가',
    successfulFixCount: 8,
    failedFixCount: 4,
    confidence: 0.67,
    validationScore: 0.7,
    createdAt: new Date('2024-02-01'),
    lastUsedAt: new Date(),
    usageCount: 12,
  },
];

/**
 * Supabase 클라이언트 초기화
 */
async function initSupabase(): Promise<boolean> {
  if (supabase) return !useFallback;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[SupabasePatternClient] Supabase 설정 없음, 기본 패턴 사용');
    useFallback = true;
    return false;
  }

  try {
    supabase = createClient(url, key);
    const { error } = await supabase.from('review_patterns').select('id').limit(1);
    if (error) {
      console.warn('[SupabasePatternClient] Supabase 연결 실패:', error.message);
      useFallback = true;
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[SupabasePatternClient] Supabase 초기화 실패:', error);
    useFallback = true;
    return false;
  }
}

/**
 * 레코드를 ReviewPatternMemory로 변환
 */
function recordToPattern(row: PatternRecord): ReviewPatternMemory {
  return {
    id: row.id,
    type: 'REVIEW_PATTERN',
    patternId: row.pattern_id,
    patternName: row.pattern_name,
    description: row.description || '',
    triggerConditions: row.trigger_conditions as ReviewPatternMemory['triggerConditions'],
    issueDescription: row.issue_description || '',
    suggestedFix: row.suggested_fix || '',
    successfulFixCount: row.successful_fix_count,
    failedFixCount: row.failed_fix_count,
    confidence: row.confidence,
    validationScore: row.validation_score,
    usageCount: row.usage_count,
    createdAt: new Date(row.created_at),
    lastUsedAt: new Date(row.last_used_at),
  };
}

/**
 * Supabase에서 리뷰 패턴 조회
 */
export async function fetchPatterns(subject?: Subject): Promise<ReviewPatternMemory[]> {
  const connected = await initSupabase();
  if (!connected || useFallback) {
    return subject
      ? DEFAULT_PATTERNS.filter(p => !p.triggerConditions.subject ||
          (p.triggerConditions.subject as Subject[])?.includes(subject))
      : DEFAULT_PATTERNS;
  }

  let query = supabase!.from('review_patterns').select('*');
  if (subject) {
    query = query.or(`subject.is.null,subject.eq.${subject}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[SupabasePatternClient] fetchPatterns 실패:', error.message);
    return DEFAULT_PATTERNS;
  }

  if (!data || data.length === 0) {
    // 기본 패턴 시드
    await seedDefaultPatterns();
    return DEFAULT_PATTERNS;
  }

  return (data as PatternRecord[]).map(recordToPattern);
}

/**
 * 패턴 성공/실패 기록
 */
export async function updatePatternOutcome(
  patternId: string,
  success: boolean
): Promise<void> {
  const connected = await initSupabase();
  if (!connected || useFallback) {
    console.log(`[SupabasePatternClient] Fallback - 패턴 결과 기록: ${patternId} - ${success}`);
    return;
  }

  const column = success ? 'successful_fix_count' : 'failed_fix_count';
  const { error } = await supabase!.rpc('increment_pattern_count', {
    p_pattern_id: patternId,
    p_column: column,
  });

  // RPC가 없으면 직접 업데이트
  if (error?.message.includes('function')) {
    const { data: current } = await supabase!
      .from('review_patterns')
      .select(column)
      .eq('pattern_id', patternId)
      .single();

    if (current) {
      await supabase!
        .from('review_patterns')
        .update({
          [column]: (current[column] as number) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('pattern_id', patternId);
    }
  }
}

/**
 * 새 패턴 생성
 */
export async function createPattern(
  pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>
): Promise<string> {
  const connected = await initSupabase();
  const now = new Date().toISOString();

  if (!connected || useFallback) {
    const id = `RP-${Date.now()}`;
    console.log(`[SupabasePatternClient] Fallback - 패턴 생성: ${id}`);
    return id;
  }

  const { data, error } = await supabase!
    .from('review_patterns')
    .insert({
      pattern_id: pattern.patternId,
      pattern_name: pattern.patternName,
      description: pattern.description,
      trigger_conditions: pattern.triggerConditions,
      issue_description: pattern.issueDescription,
      suggested_fix: pattern.suggestedFix,
      successful_fix_count: pattern.successfulFixCount,
      failed_fix_count: pattern.failedFixCount,
      confidence: pattern.confidence,
      validation_score: pattern.validationScore,
      created_at: now,
      last_used_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[SupabasePatternClient] createPattern 실패:', error.message);
    return `RP-${Date.now()}`;
  }

  return data?.id || `RP-${Date.now()}`;
}

/**
 * 기본 패턴 시드
 */
async function seedDefaultPatterns(): Promise<void> {
  const connected = await initSupabase();
  if (!connected || useFallback) return;

  const now = new Date().toISOString();
  const records = DEFAULT_PATTERNS.map(p => ({
    pattern_id: p.patternId,
    pattern_name: p.patternName,
    description: p.description,
    trigger_conditions: p.triggerConditions,
    issue_description: p.issueDescription,
    suggested_fix: p.suggestedFix,
    successful_fix_count: p.successfulFixCount,
    failed_fix_count: p.failedFixCount,
    confidence: p.confidence,
    validation_score: p.validationScore,
    usage_count: p.usageCount,
    created_at: now,
    last_used_at: now,
  }));

  const { error } = await supabase!
    .from('review_patterns')
    .upsert(records, { onConflict: 'pattern_id' });

  if (error) {
    console.error('[SupabasePatternClient] seedDefaultPatterns 실패:', error.message);
  }
}
