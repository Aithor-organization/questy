/**
 * 일정 관련 핸들러 모듈
 */

import type { DirectorContext, MessageAction } from '../../../../types/agent.js';
import { QuestActions } from '../../../shared/quest-actions.js';

/**
 * 일정 관련 분석 응답 생성
 */
export function generateScheduleAnalysisResponse(
  _originalMessage: string,
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
export function generateScheduleInsights(context: DirectorContext): string {
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

/**
 * 일정 조정 요청 처리
 */
export function handleScheduleRequest(
  message: string,
  context: DirectorContext
): { response: string; messageActions: MessageAction[] } {
  const todayQuests = context.todayQuests;
  const result = QuestActions.generateRescheduleActions(
    message,
    todayQuests,
    context.activePlans?.[0],
  );

  const analysisResponse = generateScheduleAnalysisResponse(message, result.message, context);

  return {
    response: analysisResponse,
    messageActions: result.messageActions,
  };
}

/**
 * 일정 조회 처리
 */
export function handleScheduleQuery(context: DirectorContext): string {
  const summary = QuestActions.generateScheduleSummary(
    context.activePlans ?? [],
    context.fullScheduleContext
  );

  const analysisIntro = '📊 **학습 일정 분석 리포트**\n\n';
  return analysisIntro + summary + generateScheduleInsights(context);
}

/**
 * 플랜 생성 요청 처리
 */
export function handlePlanCreationRequest(): { response: string; messageActions: MessageAction[] } {
  const messageActions: MessageAction[] = [{
    id: `navigate-new-plan-${Date.now()}`,
    type: 'NAVIGATE',
    label: '새 플랜 만들기',
    icon: '➕',
    data: { navigateTo: '/new-plan' },
  }];

  return {
    response: '새로운 학습 계획을 세우고 싶으시군요! 📊\n\n분석 결과를 바탕으로 최적의 계획을 세워드릴게요.\n아래 버튼을 눌러 플랜을 만들어보세요.',
    messageActions,
  };
}
