/**
 * 커리큘럼 리뷰어 (검증 에이전트)
 * 생성된 커리큘럼을 별도 LLM으로 검증
 *
 * 검증 항목:
 * - 일정 실현 가능성
 * - 학습량 균형
 * - 과목 분배
 * - 잠재적 문제점
 */

import type { CurriculumQuest, CurriculumGenerationResult } from '../types.js';

// 검증 결과 타입
export interface CurriculumReviewResult {
  isApproved: boolean;
  overallScore: number; // 0-100
  summary: string;
  categories: {
    feasibility: ReviewCategory;
    balance: ReviewCategory;
    distribution: ReviewCategory;
    completeness: ReviewCategory;
  };
  highlights: string[];
  concerns: string[];
  suggestions: string[];
}

interface ReviewCategory {
  score: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  message: string;
}

// 검증 프롬프트
const CURRICULUM_REVIEW_PROMPT = `당신은 수능 학습 커리큘럼 전문 검증관입니다.
생성된 커리큘럼을 분석하고 학생의 학습 효과를 극대화할 수 있는지 평가합니다.

## 평가 기준

### 1. 실현 가능성 (Feasibility)
- 일일 학습량이 현실적인가?
- 하루 8시간 이상 학습은 경고
- 연속 고강도 학습일이 3일 이상이면 경고

### 2. 균형 (Balance)
- 일별 학습 시간 편차가 적절한가?
- 특정 날에 과부하가 없는가?
- 주말/평일 분배가 합리적인가?

### 3. 과목 분배 (Distribution)
- 과목별 학습이 균등하게 분배되었는가?
- 같은 과목이 연속으로 너무 많이 배치되지 않았는가?
- 과목 간 전환이 적절한가?

### 4. 완성도 (Completeness)
- 모든 강의가 배치되었는가?
- 목표일 내에 완료 가능한가?
- 복습 시간이 확보되었는가?

## 응답 형식
반드시 JSON으로만 응답하세요:

{
  "isApproved": true/false,
  "overallScore": 0-100,
  "summary": "전체 평가 요약 (1-2문장)",
  "categories": {
    "feasibility": { "score": 0-100, "status": "excellent|good|warning|critical", "message": "평가 메시지" },
    "balance": { "score": 0-100, "status": "...", "message": "..." },
    "distribution": { "score": 0-100, "status": "...", "message": "..." },
    "completeness": { "score": 0-100, "status": "...", "message": "..." }
  },
  "highlights": ["좋은 점 1", "좋은 점 2"],
  "concerns": ["우려 사항 1", "우려 사항 2"],
  "suggestions": ["개선 제안 1", "개선 제안 2"]
}`;

/**
 * 커리큘럼 검증 실행
 */
export async function reviewCurriculum(
  result: CurriculumGenerationResult,
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<CurriculumReviewResult> {
  if (!result.success || result.quests.length === 0) {
    return createFailedReview('생성된 커리큘럼이 없습니다.');
  }

  // 커리큘럼 통계 계산
  const stats = calculateCurriculumStats(result.quests);

  // 검증 프롬프트 구성
  const userPrompt = buildReviewPrompt(result, stats);

  try {
    // 검증용 LLM 호출 (다른 모델 사용)
    const response = await generateResponse(
      CURRICULUM_REVIEW_PROMPT,
      userPrompt,
      { model: 'claude-4.5-haiku', temperature: 0.2, maxTokens: 2048 }
    );

    // JSON 파싱
    const review = parseReviewResponse(response);

    if (!review) {
      console.warn('[CurriculumReviewer] LLM 응답 파싱 실패, 기본 검증으로 전환');
      return performBasicReview(result, stats);
    }

    return review;
  } catch (error) {
    console.error('[CurriculumReviewer] LLM 검증 실패:', error);
    return performBasicReview(result, stats);
  }
}

/**
 * 커리큘럼 통계 계산
 */
interface CurriculumStats {
  totalQuests: number;
  totalLectures: number;
  totalMinutes: number;
  uniqueDays: number;
  dailyStats: Map<string, { minutes: number; lectures: number; subjects: Set<string> }>;
  subjectCounts: Record<string, number>;
  avgMinutesPerDay: number;
  maxMinutesInDay: number;
  minMinutesInDay: number;
  consecutiveHighDays: number;
}

function calculateCurriculumStats(quests: CurriculumQuest[]): CurriculumStats {
  const dailyStats = new Map<string, { minutes: number; lectures: number; subjects: Set<string> }>();
  const subjectCounts: Record<string, number> = {};

  let totalMinutes = 0;
  let totalLectures = 0;

  for (const quest of quests) {
    const date = quest.scheduledDate;

    if (!dailyStats.has(date)) {
      dailyStats.set(date, { minutes: 0, lectures: 0, subjects: new Set() });
    }

    const dayData = dailyStats.get(date)!;
    dayData.minutes += quest.estimatedMinutes;
    dayData.subjects.add(quest.subject);

    if (quest.questType === 'lecture') {
      dayData.lectures++;
      totalLectures++;
    }

    totalMinutes += quest.estimatedMinutes;
    subjectCounts[quest.subject] = (subjectCounts[quest.subject] || 0) + 1;
  }

  const dailyMinutes = Array.from(dailyStats.values()).map(d => d.minutes);
  const avgMinutesPerDay = dailyMinutes.length > 0
    ? dailyMinutes.reduce((a, b) => a + b, 0) / dailyMinutes.length
    : 0;

  // 연속 고강도 학습일 계산 (6시간 이상)
  let consecutiveHighDays = 0;
  let currentStreak = 0;
  const sortedDates = Array.from(dailyStats.keys()).sort();

  for (const date of sortedDates) {
    const dayMinutes = dailyStats.get(date)!.minutes;
    if (dayMinutes >= 360) { // 6시간 이상
      currentStreak++;
      consecutiveHighDays = Math.max(consecutiveHighDays, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    totalQuests: quests.length,
    totalLectures,
    totalMinutes,
    uniqueDays: dailyStats.size,
    dailyStats,
    subjectCounts,
    avgMinutesPerDay,
    maxMinutesInDay: dailyMinutes.length > 0 ? Math.max(...dailyMinutes) : 0,
    minMinutesInDay: dailyMinutes.length > 0 ? Math.min(...dailyMinutes) : 0,
    consecutiveHighDays,
  };
}

/**
 * 검증 프롬프트 구성
 */
function buildReviewPrompt(result: CurriculumGenerationResult, stats: CurriculumStats): string {
  let prompt = `## 검증 대상 커리큘럼\n\n`;

  prompt += `### 기본 정보\n`;
  prompt += `- 총 퀘스트: ${stats.totalQuests}개\n`;
  prompt += `- 총 강의: ${stats.totalLectures}개\n`;
  prompt += `- 총 학습 시간: ${Math.round(stats.totalMinutes / 60 * 10) / 10}시간\n`;
  prompt += `- 학습 일수: ${stats.uniqueDays}일\n`;
  prompt += `- 일 평균: ${Math.round(stats.avgMinutesPerDay)}분\n`;
  prompt += `- 일 최대: ${stats.maxMinutesInDay}분 (${Math.round(stats.maxMinutesInDay / 60 * 10) / 10}시간)\n`;
  prompt += `- 일 최소: ${stats.minMinutesInDay}분\n`;
  prompt += `- 연속 고강도일: ${stats.consecutiveHighDays}일\n\n`;

  prompt += `### 과목별 분포\n`;
  for (const [subject, count] of Object.entries(stats.subjectCounts)) {
    prompt += `- ${subject}: ${count}개\n`;
  }

  prompt += `\n### 일별 상세\n`;
  const sortedDates = Array.from(stats.dailyStats.keys()).sort();

  for (const date of sortedDates.slice(0, 14)) { // 처음 2주만 표시
    const day = stats.dailyStats.get(date)!;
    const subjects = Array.from(day.subjects).join(', ');
    prompt += `- ${date}: ${day.minutes}분, 강의 ${day.lectures}개 (${subjects})\n`;
  }

  if (sortedDates.length > 14) {
    prompt += `... 외 ${sortedDates.length - 14}일\n`;
  }

  if (result.summary.skippedSubjects && result.summary.skippedSubjects.length > 0) {
    prompt += `\n### 건너뛴 과목\n`;
    for (const skipped of result.summary.skippedSubjects) {
      prompt += `- ${skipped.subject}: ${skipped.reason}\n`;
    }
  }

  prompt += `\n위 커리큘럼을 분석하고 JSON 형식으로 검증 결과를 제공하세요.`;

  return prompt;
}

/**
 * LLM 응답 파싱
 */
function parseReviewResponse(response: string): CurriculumReviewResult | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // 필수 필드 검증
    if (typeof parsed.isApproved !== 'boolean' ||
        typeof parsed.overallScore !== 'number' ||
        !parsed.categories) {
      return null;
    }

    return parsed as CurriculumReviewResult;
  } catch {
    return null;
  }
}

/**
 * 기본 검증 (LLM 실패 시)
 */
function performBasicReview(
  result: CurriculumGenerationResult,
  stats: CurriculumStats
): CurriculumReviewResult {
  const concerns: string[] = [];
  const highlights: string[] = [];
  const suggestions: string[] = [];

  // 실현 가능성 평가
  let feasibilityScore = 100;
  if (stats.maxMinutesInDay > 480) { // 8시간 초과
    feasibilityScore -= 30;
    concerns.push(`일일 최대 학습 시간이 ${Math.round(stats.maxMinutesInDay / 60)}시간으로 과도합니다.`);
    suggestions.push('목표일을 연장하여 일일 학습량을 줄이세요.');
  }
  if (stats.consecutiveHighDays >= 3) {
    feasibilityScore -= 20;
    concerns.push(`연속 ${stats.consecutiveHighDays}일간 고강도 학습이 예정되어 있습니다.`);
    suggestions.push('중간에 휴식일을 추가하세요.');
  }
  if (stats.avgMinutesPerDay >= 300 && stats.avgMinutesPerDay <= 420) {
    highlights.push('일 평균 학습 시간이 적절합니다.');
  }

  // 균형 평가
  let balanceScore = 100;
  const variance = stats.maxMinutesInDay - stats.minMinutesInDay;
  if (variance > 240) { // 4시간 이상 차이
    balanceScore -= 25;
    concerns.push('일별 학습량 편차가 큽니다.');
  } else if (variance < 120) {
    highlights.push('일별 학습량이 균등하게 분배되었습니다.');
  }

  // 분배 평가
  let distributionScore = 100;
  const subjectCount = Object.keys(stats.subjectCounts).length;
  if (subjectCount >= 2) {
    highlights.push(`${subjectCount}개 과목이 적절히 분배되었습니다.`);
  }

  // 완성도 평가
  let completenessScore = 100;
  if (stats.totalLectures > 0) {
    highlights.push(`총 ${stats.totalLectures}개 강의가 배치되었습니다.`);
  }
  if (result.summary.skippedSubjects && result.summary.skippedSubjects.length > 0) {
    completenessScore -= 15;
    concerns.push('일부 과목이 배치되지 않았습니다.');
  }

  const overallScore = Math.round(
    (feasibilityScore + balanceScore + distributionScore + completenessScore) / 4
  );

  const getStatus = (score: number): 'excellent' | 'good' | 'warning' | 'critical' => {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  };

  return {
    isApproved: overallScore >= 60,
    overallScore,
    summary: overallScore >= 80
      ? '전반적으로 잘 구성된 학습 계획입니다.'
      : overallScore >= 60
        ? '학습 계획이 적절하나 일부 개선이 필요합니다.'
        : '학습 계획 조정이 필요합니다.',
    categories: {
      feasibility: {
        score: feasibilityScore,
        status: getStatus(feasibilityScore),
        message: feasibilityScore >= 80
          ? '일일 학습량이 현실적입니다.'
          : '일일 학습량 조정이 필요합니다.',
      },
      balance: {
        score: balanceScore,
        status: getStatus(balanceScore),
        message: balanceScore >= 80
          ? '일별 학습량이 균등합니다.'
          : '일별 학습량 편차가 있습니다.',
      },
      distribution: {
        score: distributionScore,
        status: getStatus(distributionScore),
        message: '과목 분배가 적절합니다.',
      },
      completeness: {
        score: completenessScore,
        status: getStatus(completenessScore),
        message: completenessScore >= 80
          ? '모든 강의가 배치되었습니다.'
          : '일부 강의 배치 확인이 필요합니다.',
      },
    },
    highlights,
    concerns,
    suggestions,
  };
}

/**
 * 실패 검증 결과 생성
 */
function createFailedReview(message: string): CurriculumReviewResult {
  return {
    isApproved: false,
    overallScore: 0,
    summary: message,
    categories: {
      feasibility: { score: 0, status: 'critical', message: '검증 불가' },
      balance: { score: 0, status: 'critical', message: '검증 불가' },
      distribution: { score: 0, status: 'critical', message: '검증 불가' },
      completeness: { score: 0, status: 'critical', message: '검증 불가' },
    },
    highlights: [],
    concerns: [message],
    suggestions: ['커리큘럼을 다시 생성해주세요.'],
  };
}
