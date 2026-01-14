/**
 * 분석 핸들러 모듈
 * - 진도 분석
 * - 취약점 분석
 * - 패턴 분석
 * - 비교 분석
 * - 종합 리포트
 */

import type { TopicMastery, Subject } from '../../../../types/memory.js';
import type { DirectorContext } from '../../../../types/agent.js';
import {
  createProgressBar,
  getMasteryEmoji,
  getWeaknessLevel,
  getTypeEmoji,
} from '../utils/format-utils.js';

/**
 * 진도 분석
 */
export function analyzeProgress(
  plans: DirectorContext['activePlans'],
  masteryInfo: TopicMastery[]
): string {
  if (plans.length === 0) {
    return '📊 **진도 분석**\n\n활성 학습 계획이 없어요. 계획을 세우면 진도를 추적할 수 있어요!';
  }

  let report = '📊 **진도 분석 리포트**\n\n';

  for (const plan of plans) {
    const progress = (plan.completedSessions / plan.totalSessions) * 100;
    const bar = createProgressBar(progress);

    report += `**${plan.title}**\n`;
    report += `${bar} ${progress.toFixed(0)}%\n`;
    report += `완료: ${plan.completedSessions}/${plan.totalSessions} 세션\n\n`;
  }

  // 숙달도 요약
  const avgMastery = masteryInfo.length > 0
    ? masteryInfo.reduce((sum, m) => sum + m.masteryScore, 0) / masteryInfo.length
    : 0;

  report += `\n📈 **평균 숙달도**: ${avgMastery.toFixed(1)}/10\n`;
  report += getMasteryEmoji(avgMastery);

  return report;
}

/**
 * 취약점 분석
 */
export function analyzeWeakness(
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
      const level = getWeaknessLevel(topic.masteryScore);
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
export function analyzePatterns(
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
    const emoji = getTypeEmoji(type);
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
export function generateComparison(masteryInfo: TopicMastery[]): string {
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
    const bar = createProgressBar(avg * 10);
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
export function generateOverallReport(
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
