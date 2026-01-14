/**
 * 스케줄 생성 모듈
 * 일정 요약, 세션, 추천 생성
 */

import { v4 as uuidv4 } from 'uuid';
import type { StudyPlan, StudySession, DirectorContext } from '../../../../types/agent.js';
import type { Subject, TopicMastery } from '../../../../types/memory.js';

/**
 * 학습 세션 생성
 */
export function generateSessions(
  totalDays: number,
  subject: Subject,
  masteryInfo: TopicMastery[]
): StudySession[] {
  const sessions: StudySession[] = [];
  const weakTopics = masteryInfo
    .filter(m => m.subject === subject && m.masteryScore < 5)
    .map(m => m.topicId);

  for (let i = 0; i < totalDays; i++) {
    const isReviewDay = (i + 1) % 7 === 0;

    sessions.push({
      id: uuidv4(),
      planId: '',
      order: i + 1,
      topic: isReviewDay
        ? '주간 복습'
        : weakTopics.length > 0
          ? `${weakTopics[i % weakTopics.length]} 학습`
          : `${i + 1}단원 학습`,
      estimatedMinutes: isReviewDay ? 30 : 45,
      status: 'PENDING',
    });
  }

  return sessions;
}

/**
 * 일정 요약 생성
 */
export function generateScheduleSummary(
  plans: StudyPlan[],
  reviewDue: TopicMastery[],
  fullScheduleContext?: DirectorContext['fullScheduleContext']
): string {
  let summary = '📅 **학습 일정**\n\n';

  // 전체 일정 컨텍스트가 있으면 더 상세한 정보 제공
  if (fullScheduleContext?.activePlans?.length) {
    summary = '📅 **전체 학습 일정**\n\n';

    for (const plan of fullScheduleContext.activePlans) {
      const progress = Math.round((plan.completedDays / plan.totalDays) * 100);
      summary += `📚 **${plan.title}**\n`;
      summary += `   진행률: ${progress}% (${plan.completedDays}/${plan.totalDays}일)\n`;
      summary += `   기간: ${plan.startDate.slice(5)} ~ ${plan.targetEndDate.slice(5)}\n`;

      // 앞으로 3일간의 퀘스트
      if (plan.dailyQuests?.length) {
        const upcomingQuests = plan.dailyQuests
          .filter(q => !q.completed)
          .slice(0, 3);

        if (upcomingQuests.length > 0) {
          summary += `   예정:\n`;
          for (const quest of upcomingQuests) {
            const dateStr = quest.date.slice(5, 10);
            summary += `   • ${dateStr}: ${quest.unitTitle} (${quest.range})\n`;
          }
        }
      }
      summary += '\n';
    }

    // 주간 통계
    if (fullScheduleContext.weeklyStats) {
      const stats = fullScheduleContext.weeklyStats;
      summary += `📊 **이번 주 현황**\n`;
      summary += `   완료: ${stats.completedQuests}/${stats.totalQuests} (${stats.completionRate}%)\n`;
      summary += `   연속 학습: ${stats.streakDays}일\n\n`;
    }

    // 향후 일정
    if (fullScheduleContext.upcomingQuests?.length) {
      summary += `🗓️ **앞으로의 일정**\n`;
      for (const day of fullScheduleContext.upcomingQuests.slice(0, 5)) {
        const dateStr = day.date.slice(5, 10);
        const questCount = day.quests.length;
        summary += `   ${dateStr}: ${questCount}개 퀘스트\n`;
      }
    }
  } else if (plans.length === 0) {
    summary += '활성 계획이 없어요. 새 계획을 세워볼까요?\n';
  } else {
    for (const plan of plans) {
      const nextSession = plan.sessions.find(s => s.status === 'PENDING');
      if (nextSession) {
        summary += `📚 **${plan.title}**\n`;
        summary += `   → ${nextSession.topic} (${nextSession.estimatedMinutes}분)\n\n`;
      }
    }
  }

  if (reviewDue.length > 0) {
    summary += '🔄 **복습 필요**\n';
    for (const topic of reviewDue.slice(0, 3)) {
      summary += `   → ${topic.topicId}\n`;
    }
  }

  return summary;
}

/**
 * 학습 추천 생성
 */
export function generateRecommendations(masteryInfo: TopicMastery[], plans: StudyPlan[]): string {
  const weakTopics = masteryInfo
    .filter(m => m.masteryScore < 4)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 3);

  let recommendations = '💡 **추천 학습 순서**\n\n';

  if (weakTopics.length > 0) {
    recommendations += '⚠️ **보강 필요 토픽** (우선순위 높음)\n';
    for (const topic of weakTopics) {
      recommendations += `   🔴 ${topic.topicId} (숙달도: ${topic.masteryScore.toFixed(1)}/10)\n`;
    }
    recommendations += '\n';
  }

  recommendations += '💪 이 부분들을 먼저 보강하면 전체 실력이 확 올라갈 거야!';
  return recommendations;
}
