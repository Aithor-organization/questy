/**
 * 일정 관련 핸들러
 */

import type { DirectorContext, MessageAction, AgentResponse } from '../../../../types/agent.js';
import { QuestActions } from '../../../shared/quest-actions.js';

// 응답 생성 함수 타입
type CreateResponseFn = (
  message: string,
  options: Partial<AgentResponse>
) => AgentResponse;

/**
 * 일정 조정 요청 처리
 */
export async function handleScheduleRequest(
  message: string,
  context: DirectorContext,
  generateScheduleCoachingResponse: (
    originalMessage: string,
    actionMessage: string,
    context: DirectorContext
  ) => Promise<string>,
  createResponse: CreateResponseFn
): Promise<AgentResponse> {
  console.log('[CoachAgent] Schedule request detected - generating actions');
  const messageActions: MessageAction[] = [];

  const todayQuests = context.todayQuests;
  const activePlans = context.activePlans;
  const result = QuestActions.generateRescheduleActions(
    message,
    todayQuests,
    activePlans?.[0],
  );

  messageActions.push(...result.messageActions);

  // 일정 조정 액션과 함께 코칭 메시지 생성
  const coachingResponse = await generateScheduleCoachingResponse(
    message,
    result.message,
    context
  );

  return createResponse(coachingResponse, {
    memoryExtracted: true,
    suggestedFollowUp: ['일정 조정 완료 후 알려줘', '다른 도움이 필요해?'],
    messageActions,
  });
}

/**
 * 일정 조회 요청 처리
 */
export function handleScheduleQuery(
  context: DirectorContext,
  createResponse: CreateResponseFn
): AgentResponse {
  console.log('[CoachAgent] Schedule query detected');
  const summary = QuestActions.generateScheduleSummary(
    context.activePlans ?? [],
    context.fullScheduleContext
  );

  const coachingIntro = '물론이지! 네 학습 일정을 알려줄게 📚\n\n';
  return createResponse(coachingIntro + summary, {
    memoryExtracted: true,
    suggestedFollowUp: ['오늘 바로 시작할까?', '일정 조정이 필요해?'],
  });
}

/**
 * 플랜 생성 요청 처리
 */
export function handlePlanCreationRequest(
  createResponse: CreateResponseFn
): AgentResponse {
  console.log('[CoachAgent] Plan creation request detected');
  const messageActions: MessageAction[] = [
    {
      id: `navigate-new-plan-${Date.now()}`,
      type: 'NAVIGATE',
      label: '새 플랜 만들기',
      icon: '➕',
      data: { navigateTo: '/new-plan' },
    },
  ];

  return createResponse(
    '새로운 학습 계획을 세우고 싶구나! 🎯\n아래 버튼을 눌러 플랜을 만들어보자.',
    {
      memoryExtracted: true,
      suggestedFollowUp: ['어떤 과목을 공부하고 싶어?'],
      messageActions,
    }
  );
}

/**
 * 일정 관련 코칭 응답 생성
 */
export async function generateScheduleCoachingResponse(
  _originalMessage: string,
  actionMessage: string,
  _context: DirectorContext
): Promise<string> {
  const empathyPrefixes = [
    '알겠어! 😊 ',
    '물론이지! ',
    '응, 도와줄게! ',
    '그래, 조정해줄게! ',
  ];
  const prefix = empathyPrefixes[Math.floor(Math.random() * empathyPrefixes.length)];
  return prefix + actionMessage;
}
