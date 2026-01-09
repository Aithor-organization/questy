/**
 * AnalystAgent (진화형)
 * 학습 분석 전문 에이전트
 *
 * 통합 기능:
 * - 진도 및 성취도 분석
 * - 취약점 진단
 * - 학습 패턴 인사이트
 * - AI 플랜 리뷰 (진화형)
 * - 리뷰 패턴 학습 및 적용
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  MessageAction,
} from '../../types/agent.js';
import type {
  TopicMastery,
  Subject,
  AIGeneratedQuest,
  GeneratedPlan,
  PlanReview,
  ReviewPatternMemory,
} from '../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';
import { QuestActions } from '../shared/quest-actions.js';

// ===================== 시스템 프롬프트 =====================

const ANALYST_SYSTEM_PROMPT = `당신은 학습 데이터 분석 전문가 AI입니다.

## 핵심 역할
1. **성취도 분석**: 과목별, 토픽별 숙달도 평가
2. **취약점 진단**: 반복 오류 패턴 및 지식 갭 식별
3. **진도 추적**: 계획 대비 실제 진행 상황 비교
4. **인사이트 제공**: 학습 효율 개선을 위한 제안

## 분석 원칙
- 데이터 기반의 객관적 평가
- 긍정적 성취 먼저, 개선점은 부드럽게
- 구체적인 수치와 함께 설명
- 실행 가능한 개선 방안 제시

## 출력 형식
- 시각적 요소 활용 (막대, 이모지)
- 요약 → 상세 → 제안 순서
- 비교 가능한 지표 제공`;

const PLAN_REVIEW_SYSTEM_PROMPT = `당신은 학습 계획 전문가이자 교육 컨설턴트입니다.
학습 플랜을 분석하고 건설적인 피드백을 제공합니다.

## 분석 관점
1. **시간 배분**: 하루 학습량이 적절한지, 번아웃 위험은 없는지
2. **난이도 진행**: 쉬운 것에서 어려운 것으로 자연스럽게 진행되는지
3. **단원 연결성**: 연관된 단원이 적절히 배치되었는지
4. **복습 주기**: 복습일이 적절히 배치되었는지
5. **실현 가능성**: 실제로 따라할 수 있는 계획인지

## 학습된 패턴 활용
아래 패턴이 제공되면 반드시 적용하세요:
- 이전에 성공한 개선 사항은 우선 추천
- 실패한 개선 사항은 회피

## 출력 형식 (JSON)
{
  "overallScore": 8,
  "overallComment": "전반적으로 균형 잡힌 학습 계획입니다...",
  "strengths": [
    "단원별 시간 배분이 적절합니다",
    "어려운 단원에 충분한 시간을 할당했습니다"
  ],
  "improvements": [
    "중간에 복습일을 추가하면 더 효과적입니다",
    "3주차에 학습량이 많아 조정이 필요합니다"
  ],
  "balanceAnalysis": {
    "timeBalance": "하루 평균 45분으로 적절합니다",
    "difficultyProgression": "초반에 기초를 다지고 후반에 심화로 진행됩니다",
    "restDaysAdvice": "7일마다 가벼운 복습일을 추가하세요"
  },
  "motivationalTips": [
    "작은 목표 달성을 축하하세요",
    "힘들 때는 하루 쉬어도 괜찮습니다"
  ],
  "expertAdvice": "이 계획을 따르면서 자신의 페이스에 맞게 조정하세요..."
}

## 평가 기준
- 10점: 완벽한 계획, 즉시 시작 가능
- 8-9점: 좋은 계획, 약간의 조정 권장
- 6-7점: 괜찮은 계획, 개선 여지 있음
- 5점 이하: 재검토 필요

친절하고 격려하는 톤으로 작성하세요. 비판보다는 개선 방향을 제시하세요.`;

// ===================== 타입 정의 =====================

type AnalysisType = 'PROGRESS' | 'WEAKNESS' | 'PATTERN' | 'COMPARISON' | 'OVERALL' | 'PLAN_REVIEW';

interface PlanReviewRequest {
  materialName: string;
  planName: string;
  dailyQuests: AIGeneratedQuest[];
  totalDays: number;
  totalEstimatedHours: number;
  subject?: Subject;
}

export interface ExtendedPlanReview extends PlanReview {
  riskAssessment: {
    burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    dropOffRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    overloadDays: number[];
  };
  appliedPatterns: string[];  // 적용된 학습 패턴 ID
}

// ===================== AnalystAgent 클래스 =====================

export class AnalystAgent extends BaseAgent {
  // 리뷰 패턴 캐시 (진화 학습용)
  private reviewPatternCache: Map<string, ReviewPatternMemory[]> = new Map();

  constructor() {
    super({
      role: 'ANALYST',
      modelConfig: {
        id: 'gemini-3-flash',
        provider: 'google',
        maxTokens: 4096,
        temperature: 0.3,
        purpose: '학습 데이터 분석, 진단 및 AI 플랜 리뷰',
      },
      systemPrompt: ANALYST_SYSTEM_PROMPT,
    });
  }

  // ===================== 기본 process 메서드 =====================

  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message } = request;
    const { studentProfile, activePlans, memoryContext } = context;
    const messageActions: MessageAction[] = [];

    // 일정 조정 요청 감지 - AnalystAgent도 스케줄 관련 작업 가능
    if (QuestActions.isScheduleRequest(message)) {
      console.log('[AnalystAgent] Schedule request detected - generating actions');
      const todayQuests = context.todayQuests;
      const result = QuestActions.generateRescheduleActions(
        message,
        todayQuests,
        activePlans?.[0],
      );

      messageActions.push(...result.messageActions);

      // 분석 관점의 일정 조정 응답
      const analysisResponse = this.generateScheduleAnalysisResponse(message, result.message, context);

      return this.createResponse(analysisResponse, {
        suggestedFollowUp: ['일정 조정 후 진도 분석할까요?', '학습 패턴 분석이 필요한가요?'],
        messageActions,
      });
    }

    // 일정 조회 요청 처리
    if (QuestActions.isScheduleQuery(message)) {
      console.log('[AnalystAgent] Schedule query detected');
      const summary = QuestActions.generateScheduleSummary(
        activePlans ?? [],
        context.fullScheduleContext
      );

      const analysisIntro = '📊 **학습 일정 분석 리포트**\n\n';
      return this.createResponse(analysisIntro + summary + this.generateScheduleInsights(context), {
        suggestedFollowUp: ['진도율을 더 분석해볼까요?', '취약점 분석도 함께할까요?'],
      });
    }

    // 분석 유형 파악
    const analysisType = this.classifyAnalysisRequest(message);

    let response: string;

    switch (analysisType) {
      case 'PROGRESS':
        response = this.analyzeProgress(activePlans, memoryContext.masteryInfo);
        break;

      case 'WEAKNESS':
        response = this.analyzeWeakness(memoryContext.masteryInfo, memoryContext.relevantMemories);
        break;

      case 'PATTERN':
        response = this.analyzePatterns(memoryContext.relevantMemories);
        break;

      case 'COMPARISON':
        response = this.generateComparison(memoryContext.masteryInfo);
        break;

      case 'PLAN_REVIEW':
        response = '플랜 리뷰는 reviewPlan 메서드를 통해 이용해주세요.';
        break;

      case 'OVERALL':
      default:
        response = this.generateOverallReport(
          studentProfile,
          activePlans,
          memoryContext.masteryInfo
        );
    }

    return this.createResponse(response, {
      suggestedFollowUp: this.generateFollowUps(analysisType),
    });
  }

  /**
   * 일정 관련 분석 응답 생성
   */
  private generateScheduleAnalysisResponse(
    originalMessage: string,
    actionMessage: string,
    context: DirectorContext
  ): string {
    let response = `📊 **일정 조정 분석**\n\n${actionMessage}\n\n`;

    // 분석 관점 추가
    const weeklyStats = context.fullScheduleContext?.weeklyStats;
    if (weeklyStats) {
      response += `📈 **이번 주 현황 분석**\n`;
      response += `- 완료율: ${weeklyStats.completionRate}%\n`;
      response += `- 연속 학습: ${weeklyStats.streakDays}일\n`;

      if (weeklyStats.completionRate < 50) {
        response += '\n💡 **분석 제안**: 완료율이 낮아요. 일정을 조정해서 부담을 줄여보는 건 어떨까요?';
      } else if (weeklyStats.completionRate >= 80) {
        response += '\n🌟 **분석 결과**: 완료율이 높아요! 현재 페이스가 잘 맞는 것 같아요.';
      }
    }

    return response;
  }

  /**
   * 일정 관련 인사이트 생성
   */
  private generateScheduleInsights(context: DirectorContext): string {
    let insights = '\n\n📈 **학습 인사이트**\n';

    const weeklyStats = context.fullScheduleContext?.weeklyStats;
    if (weeklyStats) {
      if (weeklyStats.streakDays >= 7) {
        insights += `🔥 ${weeklyStats.streakDays}일 연속 학습 중! 훌륭해요!\n`;
      } else if (weeklyStats.streakDays >= 3) {
        insights += `💪 ${weeklyStats.streakDays}일 연속 학습! 조금만 더 힘내요!\n`;
      }

      if (weeklyStats.completionRate >= 80) {
        insights += '✅ 이번 주 완료율이 매우 높아요. 꾸준함이 빛나요!\n';
      } else if (weeklyStats.completionRate < 50) {
        insights += '📅 이번 주 완료율이 낮아요. 일정 조정을 고려해보세요.\n';
      }
    }

    return insights;
  }

  // ===================== AI 플랜 리뷰 (진화형) =====================

  /**
   * AI 플랜 리뷰 (진화 학습 포함)
   * - 학습된 리뷰 패턴 적용
   * - 위험 요소 평가
   * - 개인화된 피드백
   */
  async reviewPlan(request: PlanReviewRequest): Promise<ExtendedPlanReview> {
    const { materialName, planName, dailyQuests, totalDays, totalEstimatedHours, subject } = request;

    console.log(`[AnalystAgent] Reviewing plan: ${planName} (${totalDays} days)`);

    // 1. 학습된 리뷰 패턴 로드
    const learnedPatterns = await this.loadReviewPatterns(subject);
    console.log(`[AnalystAgent] Loaded ${learnedPatterns.length} review patterns`);

    // 2. 기본 통계 계산
    const stats = this.calculatePlanStats(dailyQuests, totalDays);

    // 3. 위험 요소 평가
    const riskAssessment = this.assessRisks(dailyQuests, stats);

    // 4. 학습된 패턴 기반 개선점 추출
    const patternBasedImprovements = this.applyLearnedPatterns(
      learnedPatterns,
      stats,
      subject
    );

    // 5. AI 리뷰 생성
    try {
      const aiReview = await this.generateAIReview(
        request,
        stats,
        learnedPatterns,
        patternBasedImprovements
      );

      return {
        ...aiReview,
        riskAssessment,
        appliedPatterns: patternBasedImprovements.appliedPatternIds,
      };
    } catch (error) {
      console.error('[AnalystAgent] AI review failed, using fallback:', error);
      return this.generateFallbackReview(request, stats, riskAssessment);
    }
  }

  /**
   * 플랜 통계 계산
   */
  private calculatePlanStats(dailyQuests: AIGeneratedQuest[], totalDays: number): PlanStats {
    const totalMinutes = dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    const avgMinutes = Math.round(totalMinutes / totalDays);

    // 단원별 분포
    const unitCounts = dailyQuests.reduce((acc, q) => {
      acc[q.unitNumber] = (acc[q.unitNumber] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // 일별 학습량 분포
    const dailyMinutes = dailyQuests.map(q => q.estimatedMinutes);
    const maxDailyMinutes = Math.max(...dailyMinutes);
    const minDailyMinutes = Math.min(...dailyMinutes);

    // 오버로드 일차 (평균의 1.5배 이상)
    const overloadThreshold = avgMinutes * 1.5;
    const overloadDays = dailyQuests
      .filter(q => q.estimatedMinutes > overloadThreshold)
      .map(q => q.day);

    return {
      totalMinutes,
      avgMinutes,
      maxDailyMinutes,
      minDailyMinutes,
      unitCounts,
      overloadDays,
      daysWithRest: dailyQuests.filter(q => q.estimatedMinutes < 30).length,
    };
  }

  /**
   * 위험 요소 평가
   */
  private assessRisks(
    dailyQuests: AIGeneratedQuest[],
    stats: PlanStats
  ): ExtendedPlanReview['riskAssessment'] {
    // 번아웃 위험: 평균 학습 시간 기반
    let burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (stats.avgMinutes > 90) {
      burnoutRisk = 'HIGH';
    } else if (stats.avgMinutes > 60) {
      burnoutRisk = 'MEDIUM';
    }

    // 이탈 위험: 오버로드 일차 수 기반
    let dropOffRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const overloadRatio = stats.overloadDays.length / dailyQuests.length;
    if (overloadRatio > 0.3) {
      dropOffRisk = 'HIGH';
    } else if (overloadRatio > 0.15) {
      dropOffRisk = 'MEDIUM';
    }

    // 휴식일 부족 시 위험 증가
    if (dailyQuests.length > 14 && stats.daysWithRest === 0) {
      burnoutRisk = burnoutRisk === 'LOW' ? 'MEDIUM' : 'HIGH';
    }

    return {
      burnoutRisk,
      dropOffRisk,
      overloadDays: stats.overloadDays,
    };
  }

  // ===================== 진화 학습 메서드 =====================

  /**
   * 리뷰 패턴 로드 (Memory Lane)
   */
  private async loadReviewPatterns(subject?: Subject): Promise<ReviewPatternMemory[]> {
    const cacheKey = subject || 'all';
    if (this.reviewPatternCache.has(cacheKey)) {
      return this.reviewPatternCache.get(cacheKey)!;
    }

    // TODO: Memory Lane에서 실제 조회
    // const patterns = await memoryLane.query({
    //   type: 'REVIEW_PATTERN',
    //   subject,
    // });

    // 현재는 기본 패턴 반환
    const defaultPatterns: ReviewPatternMemory[] = [
      {
        id: 'RP-001',
        type: 'REVIEW_PATTERN',
        patternId: 'OVERLOAD_WARNING',
        patternName: '과부하 경고 패턴',
        description: '하루 학습량이 너무 많으면 이탈 위험',
        triggerConditions: {
          dailyMinutes: { min: 90 },
        },
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
        triggerConditions: {
          planDuration: { min: 14 },
        },
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

    this.reviewPatternCache.set(cacheKey, defaultPatterns);
    return defaultPatterns;
  }

  /**
   * 학습된 패턴 적용
   */
  private applyLearnedPatterns(
    patterns: ReviewPatternMemory[],
    stats: PlanStats,
    subject?: Subject
  ): { improvements: string[]; appliedPatternIds: string[] } {
    const improvements: string[] = [];
    const appliedPatternIds: string[] = [];

    for (const pattern of patterns) {
      // 신뢰도 낮은 패턴 스킵
      if (pattern.confidence < 0.6) continue;

      const conditions = pattern.triggerConditions;
      let triggered = false;

      // 조건 확인
      if (conditions.dailyMinutes?.min && stats.avgMinutes >= conditions.dailyMinutes.min) {
        triggered = true;
      }
      if (conditions.dailyMinutes?.max && stats.avgMinutes <= conditions.dailyMinutes.max) {
        triggered = true;
      }
      if (conditions.planDuration?.min && stats.totalMinutes / 60 >= conditions.planDuration.min) {
        // 간접적 플랜 기간 체크 (totalMinutes를 avgMinutes로 나눠 대략적 일수 추정)
        const estimatedDays = stats.totalMinutes / stats.avgMinutes;
        if (estimatedDays >= conditions.planDuration.min) {
          triggered = true;
        }
      }
      if (conditions.subject && subject && !conditions.subject.includes(subject)) {
        triggered = false; // 과목 불일치
      }

      if (triggered) {
        improvements.push(`💡 ${pattern.suggestedFix} (성공률: ${((pattern.successfulFixCount / (pattern.successfulFixCount + pattern.failedFixCount)) * 100).toFixed(0)}%)`);
        appliedPatternIds.push(pattern.id);
      }
    }

    return { improvements, appliedPatternIds };
  }

  /**
   * AI 리뷰 생성
   */
  private async generateAIReview(
    request: PlanReviewRequest,
    stats: PlanStats,
    learnedPatterns: ReviewPatternMemory[],
    patternImprovements: { improvements: string[]; appliedPatternIds: string[] }
  ): Promise<PlanReview> {
    const { materialName, planName, dailyQuests, totalDays, totalEstimatedHours } = request;

    // 플랜 요약 생성
    const planSummary = dailyQuests.slice(0, 10).map((q) =>
      `Day ${q.day}: ${q.unitNumber}단원 ${q.unitTitle} (${q.range || ''}) - ${q.estimatedMinutes}분`
    ).join('\n');

    const learnedPatternsInfo = learnedPatterns.length > 0
      ? `\n## 학습된 리뷰 패턴\n${learnedPatterns
          .filter(p => p.confidence >= 0.7)
          .slice(0, 5)
          .map(p => `- ${p.patternName}: ${p.suggestedFix}`)
          .join('\n')}`
      : '';

    const userPrompt = `## 학습 플랜 분석 요청

**교재**: ${materialName}
**플랜명**: ${planName}
**총 기간**: ${totalDays}일
**총 예상 시간**: ${totalEstimatedHours}시간
**하루 평균**: ${stats.avgMinutes}분

## 단원별 배분
${Object.entries(stats.unitCounts).map(([unit, days]) => `${unit}단원: ${days}일`).join('\n')}

## 상세 일정 (처음 10일)
${planSummary}
${dailyQuests.length > 10 ? `\n... 외 ${dailyQuests.length - 10}일` : ''}
${learnedPatternsInfo}

## 이미 감지된 문제
${patternImprovements.improvements.length > 0
  ? patternImprovements.improvements.join('\n')
  : '특별히 감지된 문제 없음'}

이 학습 플랜을 분석하고 피드백을 제공해주세요.`;

    // LLM 호출 (현재는 폴백)
    const result = await this.callLLMForReview(userPrompt);
    return result;
  }

  /**
   * LLM 호출 - 리뷰 생성
   */
  private async callLLMForReview(prompt: string): Promise<PlanReview> {
    console.log('[AnalystAgent] LLM call for review');

    try {
      // BaseAgent의 generateResponse 사용
      const response = await this.generateResponse(
        PLAN_REVIEW_SYSTEM_PROMPT,
        prompt,
        {
          model: 'gemini-3-flash',
          temperature: 0.3,
          maxTokens: 2048,
        }
      );

      // JSON 파싱 시도
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[AnalystAgent] No JSON found in response, using fallback');
        throw new Error('No JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallScore: parsed.overallScore ?? 7,
        strengths: parsed.strengths ?? [],
        improvements: parsed.improvements ?? [],
        suggestions: parsed.motivationalTips ?? [],
        riskAssessment: parsed.riskAssessment ?? {
          burnoutRisk: 'LOW',
          dropOffRisk: 'LOW',
          overloadDays: [],
        },
        coachMessage: parsed.expertAdvice ?? '좋은 계획이에요! 화이팅! 💪',
      };
    } catch (error) {
      console.error('[AnalystAgent] LLM review generation failed:', error);
      throw error;
    }
  }

  /**
   * 폴백 리뷰 생성
   */
  private generateFallbackReview(
    request: PlanReviewRequest,
    stats: PlanStats,
    riskAssessment: ExtendedPlanReview['riskAssessment']
  ): ExtendedPlanReview {
    const { totalDays, totalEstimatedHours } = request;

    // 기본 점수 계산
    let score = 7;
    const strengths: string[] = [];
    const improvements: string[] = [];

    // 시간 배분 평가
    if (stats.avgMinutes >= 30 && stats.avgMinutes <= 60) {
      strengths.push('하루 학습 시간이 적절합니다');
      score += 1;
    } else if (stats.avgMinutes > 60) {
      improvements.push(`하루 평균 ${stats.avgMinutes}분은 다소 많습니다. 60분 이하로 조정을 권장합니다.`);
      score -= 1;
    }

    // 오버로드 평가
    if (stats.overloadDays.length > 0) {
      improvements.push(`${stats.overloadDays.join(', ')}일차에 학습량이 많습니다. 분산을 권장합니다.`);
      score -= 0.5;
    }

    // 휴식일 평가
    if (totalDays > 14 && stats.daysWithRest === 0) {
      improvements.push('장기 플랜에 휴식일이 없습니다. 7일마다 가벼운 복습일을 추가하세요.');
      score -= 0.5;
    }

    // 위험 평가
    if (riskAssessment.burnoutRisk === 'HIGH') {
      improvements.push('번아웃 위험이 높습니다. 학습량을 줄이거나 기간을 늘려주세요.');
      score -= 1;
    }
    if (riskAssessment.dropOffRisk === 'HIGH') {
      improvements.push('이탈 위험이 높습니다. 초반 학습량을 줄이고 점진적으로 늘려보세요.');
      score -= 1;
    }

    // 긍정적 요소
    if (improvements.length === 0) {
      strengths.push('전반적으로 균형 잡힌 학습 계획입니다');
    }
    if (Object.keys(stats.unitCounts).length > 1) {
      strengths.push('다양한 단원을 체계적으로 다루고 있습니다');
    }

    // 점수 범위 조정
    score = Math.max(3, Math.min(10, Math.round(score * 10) / 10));

    return {
      overallScore: score,
      strengths,
      improvements,
      suggestions: [
        '꾸준한 실천이 가장 중요합니다',
        '어려우면 언제든 페이스를 조정하세요',
      ],
      riskAssessment,
      coachMessage: score >= 7
        ? '좋은 계획이에요! 이대로 시작해볼까요? 💪'
        : '약간의 조정 후 시작하면 더 좋을 것 같아요. 함께 수정해볼까요?',
      appliedPatterns: [],
    };
  }

  // ===================== 리뷰 패턴 기록 =====================

  /**
   * 리뷰 패턴 성공/실패 기록 (진화 학습용)
   */
  async recordPatternOutcome(
    patternId: string,
    success: boolean,
    feedback?: string
  ): Promise<void> {
    console.log(`[AnalystAgent] Recording pattern outcome: ${patternId} - ${success ? 'success' : 'failure'}`);

    // TODO: Memory Lane에 업데이트
    // const pattern = await memoryLane.get(patternId);
    // if (pattern) {
    //   if (success) {
    //     pattern.successfulFixCount++;
    //   } else {
    //     pattern.failedFixCount++;
    //   }
    //   pattern.lastUsedAt = new Date();
    //   pattern.usageCount++;
    //   pattern.confidence = pattern.successfulFixCount / (pattern.successfulFixCount + pattern.failedFixCount);
    //   await memoryLane.update(pattern);
    // }

    // 캐시 무효화
    this.reviewPatternCache.clear();
  }

  /**
   * 새로운 리뷰 패턴 생성 (학습)
   */
  async createReviewPattern(pattern: Omit<ReviewPatternMemory, 'id' | 'type' | 'createdAt' | 'lastUsedAt' | 'usageCount'>): Promise<string> {
    const newPattern: ReviewPatternMemory = {
      ...pattern,
      id: uuidv4(),
      type: 'REVIEW_PATTERN',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      usageCount: 0,
    };

    console.log(`[AnalystAgent] Creating new review pattern: ${newPattern.patternName}`);

    // TODO: Memory Lane에 저장
    // await memoryLane.store(newPattern);

    // 캐시 무효화
    this.reviewPatternCache.clear();

    return newPattern.id;
  }

  // ===================== 기존 분석 메서드 =====================

  /**
   * 분석 요청 유형 분류
   */
  private classifyAnalysisRequest(message: string): AnalysisType {
    if (/플랜.*리뷰|계획.*분석|계획.*평가/.test(message)) return 'PLAN_REVIEW';
    if (/진도|진행|얼마나/.test(message)) return 'PROGRESS';
    if (/취약|약한|부족|못하는/.test(message)) return 'WEAKNESS';
    if (/패턴|습관|경향/.test(message)) return 'PATTERN';
    if (/비교|다른|평균/.test(message)) return 'COMPARISON';
    return 'OVERALL';
  }

  /**
   * 진도 분석
   */
  private analyzeProgress(
    plans: DirectorContext['activePlans'],
    masteryInfo: TopicMastery[]
  ): string {
    if (plans.length === 0) {
      return '📊 **진도 분석**\n\n활성 학습 계획이 없어요. 계획을 세우면 진도를 추적할 수 있어요!';
    }

    let report = '📊 **진도 분석 리포트**\n\n';

    for (const plan of plans) {
      const progress = (plan.completedSessions / plan.totalSessions) * 100;
      const bar = this.createProgressBar(progress);

      report += `**${plan.title}**\n`;
      report += `${bar} ${progress.toFixed(0)}%\n`;
      report += `완료: ${plan.completedSessions}/${plan.totalSessions} 세션\n\n`;
    }

    // 숙달도 요약
    const avgMastery = masteryInfo.length > 0
      ? masteryInfo.reduce((sum, m) => sum + m.masteryScore, 0) / masteryInfo.length
      : 0;

    report += `\n📈 **평균 숙달도**: ${avgMastery.toFixed(1)}/10\n`;
    report += this.getMasteryEmoji(avgMastery);

    return report;
  }

  /**
   * 취약점 분석
   */
  private analyzeWeakness(
    masteryInfo: TopicMastery[],
    memories: DirectorContext['memoryContext']['relevantMemories']
  ): string {
    let report = '🔍 **취약점 분석**\n\n';

    // 숙달도 기반 취약 토픽
    const weakTopics = masteryInfo
      .filter((m) => m.masteryScore < 4)
      .sort((a, b) => a.masteryScore - b.masteryScore);

    if (weakTopics.length === 0) {
      report += '✅ 뚜렷한 취약점이 없어요! 고르게 잘하고 있어요.\n';
    } else {
      report += '**보강 필요 토픽**\n';
      for (const topic of weakTopics.slice(0, 5)) {
        const level = this.getWeaknessLevel(topic.masteryScore);
        report += `${level} ${topic.topicId} (${topic.masteryScore.toFixed(1)}/10)\n`;
      }
    }

    // 오답 패턴
    const wrongAnswers = memories.filter((m) => m.type === 'WRONG_ANSWER');
    if (wrongAnswers.length > 0) {
      report += '\n**반복 오류 패턴**\n';
      for (const wrong of wrongAnswers.slice(0, 3)) {
        report += `❌ ${wrong.title}\n`;
      }
    }

    report += '\n💡 **개선 제안**: 취약 토픽부터 차근차근 복습하면 전체 실력이 올라갈 거예요!';

    return report;
  }

  /**
   * 학습 패턴 분석
   */
  private analyzePatterns(
    memories: DirectorContext['memoryContext']['relevantMemories']
  ): string {
    let report = '🔁 **학습 패턴 분석**\n\n';

    // 메모리 유형별 분포
    const typeCounts = new Map<string, number>();
    for (const memory of memories) {
      const count = typeCounts.get(memory.type) ?? 0;
      typeCounts.set(memory.type, count + 1);
    }

    report += '**기억 유형 분포**\n';
    for (const [type, count] of typeCounts) {
      const emoji = this.getTypeEmoji(type);
      report += `${emoji} ${type}: ${count}개\n`;
    }

    // 선호 패턴
    const patterns = memories.filter((m) => m.type === 'PATTERN');
    if (patterns.length > 0) {
      report += '\n**발견된 학습 패턴**\n';
      for (const pattern of patterns.slice(0, 3)) {
        report += `🔄 ${pattern.content.slice(0, 50)}...\n`;
      }
    }

    // 전략 패턴
    const strategies = memories.filter((m) => m.type === 'STRATEGY');
    if (strategies.length > 0) {
      report += '\n**효과적인 학습 전략**\n';
      for (const strategy of strategies.slice(0, 3)) {
        report += `🎯 ${strategy.title}\n`;
      }
    }

    return report;
  }

  /**
   * 비교 분석
   */
  private generateComparison(masteryInfo: TopicMastery[]): string {
    let report = '📊 **과목별 비교 분석**\n\n';

    // 과목별 그룹화
    const bySubject = new Map<Subject, TopicMastery[]>();
    for (const m of masteryInfo) {
      const list = bySubject.get(m.subject) ?? [];
      list.push(m);
      bySubject.set(m.subject, list);
    }

    const subjectStats: Array<{ subject: Subject; avg: number }> = [];

    for (const [subject, topics] of bySubject) {
      const avg = topics.reduce((sum, t) => sum + t.masteryScore, 0) / topics.length;
      subjectStats.push({ subject, avg });
    }

    // 높은 순으로 정렬
    subjectStats.sort((a, b) => b.avg - a.avg);

    for (const { subject, avg } of subjectStats) {
      const bar = this.createProgressBar(avg * 10);  // 0-10 → 0-100
      const emoji = avg >= 7 ? '🌟' : avg >= 5 ? '📚' : '⚠️';
      report += `${emoji} **${subject}**: ${bar} ${avg.toFixed(1)}/10\n`;
    }

    if (subjectStats.length >= 2) {
      const best = subjectStats[0];
      const worst = subjectStats[subjectStats.length - 1];
      report += `\n💡 **${best.subject}**이(가) 가장 강하고, **${worst.subject}**에 더 집중하면 좋겠어요!`;
    }

    return report;
  }

  /**
   * 종합 리포트 생성
   */
  private generateOverallReport(
    profile: DirectorContext['studentProfile'],
    plans: DirectorContext['activePlans'],
    masteryInfo: TopicMastery[]
  ): string {
    let report = `📋 **${profile.name}님의 학습 종합 리포트**\n\n`;

    // 기본 정보
    report += `👤 **학습자 정보**\n`;
    report += `- 학년: ${profile.grade}\n`;
    report += `- 등록 과목: ${profile.enrolledSubjects.join(', ')}\n\n`;

    // 활성 계획
    report += `📅 **활성 학습 계획**: ${plans.length}개\n`;
    for (const plan of plans.slice(0, 3)) {
      const progress = (plan.completedSessions / plan.totalSessions) * 100;
      report += `- ${plan.title}: ${progress.toFixed(0)}% 완료\n`;
    }
    report += '\n';

    // 숙달도 요약
    const avgMastery = masteryInfo.length > 0
      ? masteryInfo.reduce((sum, m) => sum + m.masteryScore, 0) / masteryInfo.length
      : 0;

    const masteredCount = masteryInfo.filter((m) => m.masteryScore >= 8).length;
    const weakCount = masteryInfo.filter((m) => m.masteryScore < 4).length;

    report += `📈 **숙달도 현황**\n`;
    report += `- 평균 숙달도: ${avgMastery.toFixed(1)}/10\n`;
    report += `- 숙달 토픽: ${masteredCount}개 ✅\n`;
    report += `- 보강 필요: ${weakCount}개 ⚠️\n\n`;

    // 종합 평가
    const overallEmoji = avgMastery >= 7 ? '🌟' : avgMastery >= 5 ? '👍' : '💪';
    report += `${overallEmoji} **종합 평가**: `;
    if (avgMastery >= 7) {
      report += '훌륭해요! 꾸준히 잘하고 있어요!';
    } else if (avgMastery >= 5) {
      report += '잘하고 있어요! 조금만 더 힘내봐요!';
    } else {
      report += '함께 노력하면 분명 좋아질 거예요!';
    }

    return report;
  }

  // ===================== 유틸리티 메서드 =====================

  /**
   * 진행 막대 생성
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
  }

  /**
   * 숙달도 이모지
   */
  private getMasteryEmoji(score: number): string {
    if (score >= 8) return '🌟 훌륭해요!';
    if (score >= 6) return '👍 잘하고 있어요!';
    if (score >= 4) return '💪 조금만 더!';
    return '📚 함께 노력해봐요!';
  }

  /**
   * 취약 레벨 표시
   */
  private getWeaknessLevel(score: number): string {
    if (score < 2) return '🔴';
    if (score < 4) return '🟠';
    return '🟡';
  }

  /**
   * 메모리 유형 이모지
   */
  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      CORRECTION: '🔄',
      DECISION: '📌',
      INSIGHT: '💡',
      PATTERN: '🔁',
      GAP: '⚠️',
      LEARNING: '📚',
      MASTERY: '✅',
      STRUGGLE: '😓',
      WRONG_ANSWER: '❌',
      STRATEGY: '🎯',
      PREFERENCE: '❤️',
      EMOTION: '💭',
      PLAN_PERFORMANCE: '📊',
      REVIEW_PATTERN: '🔍',
    };
    return emojis[type] ?? '📝';
  }

  /**
   * 후속 질문 생성
   */
  private generateFollowUps(analysisType: AnalysisType): string[] {
    const followUps: Record<AnalysisType, string[]> = {
      PROGRESS: ['더 자세한 분석이 필요해?', '진도 조정이 필요할까?'],
      WEAKNESS: ['취약 토픽 집중 학습할까?', '추천 복습 자료 줄까?'],
      PATTERN: ['패턴 개선 방법 알려줄까?', '효과적인 학습법 추천해줄까?'],
      COMPARISON: ['특정 과목 집중 분석할까?', '학습 계획 조정할까?'],
      OVERALL: ['어떤 부분 더 알고 싶어?', '개선 계획 세워볼까?'],
      PLAN_REVIEW: ['수정된 플랜을 원해?', '다른 플랜 옵션도 볼까?'],
    };

    return followUps[analysisType] ?? [];
  }
}

// ===================== 내부 타입 =====================

interface PlanStats {
  totalMinutes: number;
  avgMinutes: number;
  maxDailyMinutes: number;
  minDailyMinutes: number;
  unitCounts: Record<number, number>;
  overloadDays: number[];
  daysWithRest: number;
}
