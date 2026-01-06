/**
 * SpacedRepetitionManager
 * SM-2 알고리즘 기반 간격 반복 학습 시스템
 * EMA (α=0.3) 기반 숙달도 업데이트
 */

import { addDays, isBefore, isToday, startOfDay } from 'date-fns';
import type { TopicMastery, Subject } from '../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';

export interface SpacedRepetitionConfig {
  emaAlpha: number;           // EMA 알파 (기본 0.3)
  minEasinessFactor: number;  // 최소 EF (기본 1.3)
  maxInterval: number;        // 최대 간격 일수 (기본 30)
  initialInterval: number;    // 첫 복습 간격 (기본 1)
}

const DEFAULT_CONFIG: SpacedRepetitionConfig = {
  emaAlpha: 0.3,
  minEasinessFactor: 1.3,
  maxInterval: 30,
  initialInterval: 1,
};

export class SpacedRepetitionManager {
  private config: SpacedRepetitionConfig;
  private masteryStore: Map<string, TopicMastery>;

  constructor(config: Partial<SpacedRepetitionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.masteryStore = new Map();
  }

  /**
   * 토픽 숙달도 초기화
   */
  initializeMastery(params: {
    topicId: string;
    subject: Subject;
    initialScore?: number;
  }): TopicMastery {
    const now = new Date();
    const mastery: TopicMastery = {
      topicId: params.topicId,
      subject: params.subject,
      masteryScore: params.initialScore ?? 0,
      easinessFactor: 2.5,  // SM-2 기본값
      interval: this.config.initialInterval,
      repetitions: 0,
      nextReviewDate: addDays(now, this.config.initialInterval),
      lastReviewDate: now,
      totalAttempts: 0,
      successfulAttempts: 0,
    };

    this.masteryStore.set(params.topicId, mastery);
    return mastery;
  }

  /**
   * SM-2 알고리즘 + EMA 기반 숙달도 업데이트
   * @param quality 0-5 품질 점수 (0=완전 실패, 5=완벽)
   */
  updateMastery(topicId: string, quality: number): TopicMastery {
    let mastery = this.masteryStore.get(topicId);
    if (!mastery) {
      // 존재하지 않으면 새로 생성
      mastery = this.initializeMastery({
        topicId,
        subject: 'GENERAL',
      });
    }

    const now = new Date();
    mastery.totalAttempts++;
    mastery.lastReviewDate = now;

    // SM-2 알고리즘 적용
    if (quality < 3) {
      // 실패: 반복 횟수 리셋, 간격 1일로
      mastery.repetitions = 0;
      mastery.interval = 1;
    } else {
      // 성공: 간격 증가
      mastery.successfulAttempts++;

      if (mastery.repetitions === 0) {
        mastery.interval = 1;
      } else if (mastery.repetitions === 1) {
        mastery.interval = 6;
      } else {
        mastery.interval = Math.min(
          this.config.maxInterval,
          Math.round(mastery.interval * mastery.easinessFactor)
        );
      }
      mastery.repetitions++;
    }

    // Easiness Factor 업데이트
    mastery.easinessFactor = Math.max(
      this.config.minEasinessFactor,
      mastery.easinessFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );

    // 다음 복습 날짜 계산
    mastery.nextReviewDate = addDays(now, mastery.interval);

    // EMA 기반 숙달도 점수 업데이트 (0-10 스케일)
    const performanceScore = quality * 2; // 0-5 → 0-10
    mastery.masteryScore = this.calculateEMA(
      mastery.masteryScore,
      performanceScore
    );

    this.masteryStore.set(topicId, mastery);
    return mastery;
  }

  /**
   * EMA (Exponential Moving Average) 계산
   */
  private calculateEMA(currentScore: number, newScore: number): number {
    const alpha = this.config.emaAlpha;
    return alpha * newScore + (1 - alpha) * currentScore;
  }

  /**
   * 오늘 복습해야 할 토픽 조회
   */
  getTopicsDueForReview(subject?: Subject): TopicMastery[] {
    const today = startOfDay(new Date());
    const dueTopics: TopicMastery[] = [];

    for (const mastery of this.masteryStore.values()) {
      if (subject && mastery.subject !== subject) continue;

      const reviewDate = startOfDay(mastery.nextReviewDate);
      if (isBefore(reviewDate, today) || isToday(reviewDate)) {
        dueTopics.push(mastery);
      }
    }

    // 우선순위: 숙달도가 낮은 것 먼저
    return dueTopics.sort((a, b) => a.masteryScore - b.masteryScore);
  }

  /**
   * 토픽 숙달도 조회
   */
  getMastery(topicId: string): TopicMastery | undefined {
    return this.masteryStore.get(topicId);
  }

  /**
   * 과목별 전체 숙달도 통계
   */
  getSubjectStats(subject: Subject): {
    averageMastery: number;
    totalTopics: number;
    masteredTopics: number;  // 숙달도 8 이상
    struggleTopics: number;  // 숙달도 3 미만
  } {
    const topicsInSubject = Array.from(this.masteryStore.values())
      .filter((m) => m.subject === subject);

    if (topicsInSubject.length === 0) {
      return {
        averageMastery: 0,
        totalTopics: 0,
        masteredTopics: 0,
        struggleTopics: 0,
      };
    }

    const totalMastery = topicsInSubject.reduce(
      (sum, m) => sum + m.masteryScore,
      0
    );

    return {
      averageMastery: totalMastery / topicsInSubject.length,
      totalTopics: topicsInSubject.length,
      masteredTopics: topicsInSubject.filter((m) => m.masteryScore >= 8).length,
      struggleTopics: topicsInSubject.filter((m) => m.masteryScore < 3).length,
    };
  }

  /**
   * 모든 숙달도 데이터 내보내기
   */
  exportAll(): TopicMastery[] {
    return Array.from(this.masteryStore.values());
  }

  /**
   * 숙달도 데이터 가져오기
   */
  importAll(data: TopicMastery[]): void {
    this.masteryStore.clear();
    for (const mastery of data) {
      this.masteryStore.set(mastery.topicId, mastery);
    }
  }

  /**
   * 간격 반복 권장 사항 생성
   */
  generateRecommendations(subject?: Subject): string[] {
    const recommendations: string[] = [];
    const dueTopics = this.getTopicsDueForReview(subject);

    if (dueTopics.length === 0) {
      recommendations.push('✅ 오늘 복습할 토픽이 없습니다!');
      return recommendations;
    }

    if (dueTopics.length <= 3) {
      recommendations.push(`📚 오늘 복습할 토픽: ${dueTopics.length}개`);
    } else {
      recommendations.push(`⚠️ 밀린 복습이 ${dueTopics.length}개 있습니다!`);
    }

    // 가장 급한 3개 토픽 표시
    const urgentTopics = dueTopics.slice(0, 3);
    for (const topic of urgentTopics) {
      const priority = topic.masteryScore < 3 ? '🔴' : topic.masteryScore < 6 ? '🟡' : '🟢';
      recommendations.push(
        `${priority} ${topic.topicId} (숙달도: ${topic.masteryScore.toFixed(1)}/10)`
      );
    }

    return recommendations;
  }
}
