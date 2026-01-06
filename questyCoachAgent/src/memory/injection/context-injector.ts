/**
 * MemoryContextInjector
 * 에이전트 프롬프트에 학습 기억 컨텍스트를 주입
 */

import type {
  MemoryContext,
  RetrievedMemory,
  TopicMastery,
  BurnoutIndicator,
  Subject,
} from '../../types/memory.js';

export interface ContextInjectorConfig {
  maxMemoriesToInject: number;     // 최대 주입 메모리 수 (기본 5)
  maxMasteryToShow: number;        // 최대 숙달도 정보 수 (기본 3)
  includeBurnoutStatus: boolean;   // 번아웃 상태 포함 여부
  verboseMode: boolean;            // 상세 모드
}

const DEFAULT_CONFIG: ContextInjectorConfig = {
  maxMemoriesToInject: 5,
  maxMasteryToShow: 3,
  includeBurnoutStatus: true,
  verboseMode: false,
};

export class MemoryContextInjector {
  private config: ContextInjectorConfig;

  constructor(config: Partial<ContextInjectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 메모리 컨텍스트를 프롬프트 텍스트로 변환
   */
  injectContext(context: MemoryContext, currentSubject?: Subject): string {
    const sections: string[] = [];

    // 1. 관련 학습 기억
    if (context.relevantMemories.length > 0) {
      sections.push(this.formatMemories(context.relevantMemories));
    }

    // 2. 숙달도 정보
    if (context.masteryInfo.length > 0) {
      sections.push(this.formatMasteryInfo(context.masteryInfo, currentSubject));
    }

    // 3. 복습 필요 토픽
    if (context.reviewDue.length > 0) {
      sections.push(this.formatReviewDue(context.reviewDue));
    }

    // 4. 번아웃 상태
    if (this.config.includeBurnoutStatus && context.burnoutStatus) {
      sections.push(this.formatBurnoutStatus(context.burnoutStatus));
    }

    if (sections.length === 0) {
      return '';
    }

    return `
<학생_학습_컨텍스트>
${sections.join('\n\n')}
</학생_학습_컨텍스트>
`.trim();
  }

  /**
   * 관련 학습 기억 포맷팅
   */
  private formatMemories(memories: RetrievedMemory[]): string {
    const topMemories = memories.slice(0, this.config.maxMemoriesToInject);

    const formattedMemories = topMemories.map((memory, index) => {
      const typeEmoji = this.getTypeEmoji(memory.type);
      const relevanceBar = this.createRelevanceBar(memory.retrievalScore);

      if (this.config.verboseMode) {
        return `${index + 1}. ${typeEmoji} [${memory.type}] ${memory.title}
   내용: ${memory.content.slice(0, 100)}...
   관련도: ${relevanceBar} (${(memory.retrievalScore * 100).toFixed(0)}%)
   과목: ${memory.subject} | 신뢰도: ${(memory.confidence * 100).toFixed(0)}%`;
      }

      return `${index + 1}. ${typeEmoji} ${memory.title} (${(memory.retrievalScore * 100).toFixed(0)}%)`;
    });

    return `## 관련 학습 기억 (최근)
${formattedMemories.join('\n')}`;
  }

  /**
   * 숙달도 정보 포맷팅
   */
  private formatMasteryInfo(masteryInfo: TopicMastery[], currentSubject?: Subject): string {
    // 현재 과목 우선, 그 다음 숙달도 낮은 순
    const sorted = [...masteryInfo]
      .sort((a, b) => {
        if (currentSubject) {
          if (a.subject === currentSubject && b.subject !== currentSubject) return -1;
          if (b.subject === currentSubject && a.subject !== currentSubject) return 1;
        }
        return a.masteryScore - b.masteryScore;
      })
      .slice(0, this.config.maxMasteryToShow);

    const formattedMastery = sorted.map((m) => {
      const masteryLevel = this.getMasteryLevel(m.masteryScore);
      const bar = this.createMasteryBar(m.masteryScore);
      return `- ${m.topicId}: ${bar} ${masteryLevel} (${m.masteryScore.toFixed(1)}/10)`;
    });

    return `## 토픽 숙달도
${formattedMastery.join('\n')}`;
  }

  /**
   * 복습 필요 토픽 포맷팅
   */
  private formatReviewDue(reviewDue: TopicMastery[]): string {
    if (reviewDue.length === 0) return '';

    const urgentTopics = reviewDue.slice(0, 3);
    const formatted = urgentTopics.map((t) => {
      const daysOverdue = this.calculateDaysOverdue(t.nextReviewDate);
      const urgency = daysOverdue > 3 ? '🚨' : daysOverdue > 0 ? '⚠️' : '📅';
      return `- ${urgency} ${t.topicId} (${daysOverdue > 0 ? `${daysOverdue}일 밀림` : '오늘'})`;
    });

    return `## 복습 필요 (SM-2 기반)
${formatted.join('\n')}`;
  }

  /**
   * 번아웃 상태 포맷팅
   */
  private formatBurnoutStatus(status: BurnoutIndicator): string {
    const levelEmoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🔴',
    }[status.level];

    let content = `## 학생 상태
${levelEmoji} 번아웃 위험: ${status.level}`;

    if (status.warningSignals.length > 0) {
      content += `\n⚠️ 경고 신호: ${status.warningSignals[0]}`;
    }

    if (status.level !== 'LOW') {
      content += `\n💡 권장: ${status.suggestedCopingStrategies[0]}`;
    }

    return content;
  }

  /**
   * 메모리 유형별 이모지
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
    };
    return emojis[type] ?? '📝';
  }

  /**
   * 관련도 바 생성
   */
  private createRelevanceBar(score: number): string {
    const filled = Math.round(score * 5);
    return '█'.repeat(filled) + '░'.repeat(5 - filled);
  }

  /**
   * 숙달도 바 생성
   */
  private createMasteryBar(score: number): string {
    const filled = Math.round(score);
    return '▓'.repeat(filled) + '░'.repeat(10 - filled);
  }

  /**
   * 숙달도 레벨 텍스트
   */
  private getMasteryLevel(score: number): string {
    if (score >= 8) return '숙달';
    if (score >= 6) return '양호';
    if (score >= 4) return '보통';
    if (score >= 2) return '미흡';
    return '취약';
  }

  /**
   * 밀린 복습 일수 계산
   */
  private calculateDaysOverdue(nextReviewDate: Date): number {
    const now = new Date();
    const diff = now.getTime() - nextReviewDate.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * 컨텍스트 요약 (토큰 절약용)
   */
  createCompactContext(context: MemoryContext): string {
    const parts: string[] = [];

    // 핵심 기억만 한 줄씩
    if (context.relevantMemories.length > 0) {
      const top3 = context.relevantMemories.slice(0, 3);
      parts.push(`[기억] ${top3.map((m) => m.title).join('; ')}`);
    }

    // 취약 토픽만
    const weakTopics = context.masteryInfo.filter((m) => m.masteryScore < 4);
    if (weakTopics.length > 0) {
      parts.push(`[취약] ${weakTopics.map((t) => t.topicId).join(', ')}`);
    }

    // 번아웃 상태
    if (context.burnoutStatus && context.burnoutStatus.level !== 'LOW') {
      parts.push(`[상태] ${context.burnoutStatus.level}`);
    }

    return parts.join(' | ');
  }
}
