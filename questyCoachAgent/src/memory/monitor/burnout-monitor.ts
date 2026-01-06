/**
 * BurnoutMonitor
 * 학생 번아웃 감지 및 대응 전략 제공
 * 7일간 감정 추적 및 경고 신호 모니터링
 */

import type { Emotion, BurnoutIndicator } from '../../types/memory.js';

// 번아웃 가중치 (부정적 감정)
const BURNOUT_WEIGHTS: Record<Emotion, number> = {
  FRUSTRATED: 0.9,
  TIRED: 0.7,
  CONFUSED: 0.5,
  NEUTRAL: 0,
  CURIOUS: -0.2,
  MOTIVATED: -0.5,
  CONFIDENT: -0.5,
};

// 대처 전략
const COPING_STRATEGIES: Record<'LOW' | 'MEDIUM' | 'HIGH', string[]> = {
  LOW: [
    '💪 좋은 컨디션입니다! 현재 학습 페이스를 유지하세요.',
    '🎯 집중력이 떨어지기 전에 짧은 휴식을 취하세요.',
  ],
  MEDIUM: [
    '⏰ 학습 시간을 줄이고 휴식을 늘려보세요.',
    '🚶 가벼운 산책이나 스트레칭을 해보세요.',
    '🎵 좋아하는 음악을 들으며 잠시 쉬어가세요.',
    '📱 다른 취미 활동으로 리프레시해보세요.',
  ],
  HIGH: [
    '🚨 번아웃 위험이 높습니다! 오늘은 쉬는 것을 권장합니다.',
    '😴 충분한 수면을 취하세요.',
    '🗣️ 부모님이나 선생님과 대화해보세요.',
    '🌿 자연 속에서 산책하며 마음을 진정시켜보세요.',
    '✋ 목표를 조금 낮추어도 괜찮습니다.',
  ],
};

// 경고 신호 패턴
const WARNING_PATTERNS = {
  consecutiveFrustration: {
    threshold: 3,
    message: '연속 3회 이상 좌절감을 느끼고 있습니다.',
  },
  lowMotivation: {
    threshold: 5,
    message: '최근 동기부여가 부족한 상태입니다.',
  },
  frequentTiredness: {
    threshold: 4,
    message: '피로감을 자주 호소하고 있습니다.',
  },
  noPositiveEmotions: {
    threshold: 7,
    message: '최근 일주일간 긍정적인 감정이 없었습니다.',
  },
};

export interface BurnoutMonitorConfig {
  trackingWindowDays: number;  // 추적 기간 (기본 7일)
  highThreshold: number;       // HIGH 임계값 (기본 0.7)
  mediumThreshold: number;     // MEDIUM 임계값 (기본 0.4)
}

const DEFAULT_CONFIG: BurnoutMonitorConfig = {
  trackingWindowDays: 7,
  highThreshold: 0.7,
  mediumThreshold: 0.4,
};

export interface EmotionRecord {
  emotion: Emotion;
  timestamp: Date;
}

export class BurnoutMonitor {
  private config: BurnoutMonitorConfig;
  private emotionHistory: Map<string, EmotionRecord[]>;  // studentId → records

  constructor(config: Partial<BurnoutMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emotionHistory = new Map();
  }

  /**
   * 감정 기록 추가
   */
  recordEmotion(studentId: string, emotion: Emotion): void {
    const records = this.emotionHistory.get(studentId) ?? [];

    records.push({
      emotion,
      timestamp: new Date(),
    });

    // 추적 기간 외의 오래된 기록 제거
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.trackingWindowDays);

    const filteredRecords = records.filter(
      (r) => r.timestamp >= cutoffDate
    );

    this.emotionHistory.set(studentId, filteredRecords);
  }

  /**
   * 번아웃 상태 평가
   */
  assessBurnout(studentId: string): BurnoutIndicator {
    const records = this.emotionHistory.get(studentId) ?? [];

    // 번아웃 점수 계산 (0-1)
    const burnoutScore = this.calculateBurnoutScore(records);

    // 레벨 결정
    let level: 'LOW' | 'MEDIUM' | 'HIGH';
    if (burnoutScore >= this.config.highThreshold) {
      level = 'HIGH';
    } else if (burnoutScore >= this.config.mediumThreshold) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }

    // 경고 신호 감지
    const warningSignals = this.detectWarningSignals(records);

    // 대처 전략 결정
    const strategies = this.selectCopingStrategies(level, warningSignals);

    return {
      studentId,
      level,
      recentEmotions: records.slice(-10).map((r) => ({
        emotion: r.emotion,
        timestamp: r.timestamp,
      })),
      warningSignals,
      suggestedCopingStrategies: strategies,
      lastAssessedAt: new Date(),
    };
  }

  /**
   * 번아웃 점수 계산
   */
  private calculateBurnoutScore(records: EmotionRecord[]): number {
    if (records.length === 0) return 0;

    // 최근 기록에 더 높은 가중치
    let weightedSum = 0;
    let totalWeight = 0;

    records.forEach((record, index) => {
      const recencyWeight = (index + 1) / records.length;  // 최근일수록 높음
      const emotionWeight = BURNOUT_WEIGHTS[record.emotion];

      weightedSum += emotionWeight * recencyWeight;
      totalWeight += recencyWeight;
    });

    // 0-1 범위로 정규화
    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.max(0, Math.min(1, (rawScore + 1) / 2));  // [-1,1] → [0,1]
  }

  /**
   * 경고 신호 감지
   */
  private detectWarningSignals(records: EmotionRecord[]): string[] {
    const signals: string[] = [];

    // 연속 좌절감 체크
    let consecutiveFrustration = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].emotion === 'FRUSTRATED') {
        consecutiveFrustration++;
      } else {
        break;
      }
    }
    if (consecutiveFrustration >= WARNING_PATTERNS.consecutiveFrustration.threshold) {
      signals.push(WARNING_PATTERNS.consecutiveFrustration.message);
    }

    // 피로 빈도 체크
    const tiredCount = records.filter((r) => r.emotion === 'TIRED').length;
    if (tiredCount >= WARNING_PATTERNS.frequentTiredness.threshold) {
      signals.push(WARNING_PATTERNS.frequentTiredness.message);
    }

    // 긍정 감정 부재 체크
    const positiveEmotions = ['MOTIVATED', 'CONFIDENT', 'CURIOUS'];
    const hasPositive = records.some((r) =>
      positiveEmotions.includes(r.emotion)
    );
    if (records.length >= 7 && !hasPositive) {
      signals.push(WARNING_PATTERNS.noPositiveEmotions.message);
    }

    return signals;
  }

  /**
   * 대처 전략 선택
   */
  private selectCopingStrategies(
    level: 'LOW' | 'MEDIUM' | 'HIGH',
    warningSignals: string[]
  ): string[] {
    const strategies = [...COPING_STRATEGIES[level]];

    // 경고 신호에 따른 추가 전략
    if (warningSignals.length > 0) {
      strategies.unshift(`⚠️ 주의: ${warningSignals.length}개의 경고 신호가 감지되었습니다.`);
    }

    return strategies;
  }

  /**
   * 학습 권장 여부 판단
   */
  shouldContinueStudying(studentId: string): {
    recommendation: 'CONTINUE' | 'TAKE_BREAK' | 'STOP_TODAY';
    reason: string;
  } {
    const assessment = this.assessBurnout(studentId);

    switch (assessment.level) {
      case 'HIGH':
        return {
          recommendation: 'STOP_TODAY',
          reason: '번아웃 위험이 높습니다. 오늘은 충분히 쉬세요.',
        };
      case 'MEDIUM':
        return {
          recommendation: 'TAKE_BREAK',
          reason: '피로가 누적되고 있습니다. 짧은 휴식을 취하세요.',
        };
      default:
        return {
          recommendation: 'CONTINUE',
          reason: '컨디션이 좋습니다. 학습을 계속할 수 있습니다.',
        };
    }
  }

  /**
   * 감정 추이 분석
   */
  getEmotionTrend(studentId: string): {
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    summary: string;
  } {
    const records = this.emotionHistory.get(studentId) ?? [];

    if (records.length < 4) {
      return {
        trend: 'STABLE',
        summary: '충분한 데이터가 없습니다.',
      };
    }

    // 최근 절반 vs 이전 절반 비교
    const mid = Math.floor(records.length / 2);
    const recentRecords = records.slice(mid);
    const olderRecords = records.slice(0, mid);

    const recentScore = this.calculateBurnoutScore(recentRecords);
    const olderScore = this.calculateBurnoutScore(olderRecords);

    const diff = recentScore - olderScore;

    if (diff < -0.1) {
      return {
        trend: 'IMPROVING',
        summary: '최근 감정 상태가 개선되고 있습니다! 👍',
      };
    } else if (diff > 0.1) {
      return {
        trend: 'DECLINING',
        summary: '최근 스트레스가 증가하고 있습니다. 주의가 필요합니다.',
      };
    } else {
      return {
        trend: 'STABLE',
        summary: '감정 상태가 안정적입니다.',
      };
    }
  }

  /**
   * 전체 기록 내보내기
   */
  exportHistory(studentId: string): EmotionRecord[] {
    return this.emotionHistory.get(studentId) ?? [];
  }
}
