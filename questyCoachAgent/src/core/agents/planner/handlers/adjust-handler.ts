/**
 * 플랜 조정 핸들러
 * 일정 조정, 퀘스트 미루기/당기기 처리
 */

import type { StudyPlan, DirectorContext, MessageAction } from '../../../../types/agent.js';
import { parseKoreanDate, formatDateString, formatDateKorean } from '../utils/date-utils.js';
import { generateScheduleSummary } from '../generators/schedule-generator.js';

/**
 * 일정 조정 + 실제 액션 버튼 생성
 */
export async function adjustPlanWithActions(
  plan: StudyPlan | undefined,
  message: string,
  memoryContext: DirectorContext['memoryContext'],
  todayQuests: DirectorContext['todayQuests'] | undefined,
  fullScheduleContext: DirectorContext['fullScheduleContext'] | undefined,
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<{ message: string; messageActions: MessageAction[] }> {
  console.log(`[AdjustHandler] adjustPlanWithActions called with message: "${message}"`);

  // 모든 퀘스트 결합
  let allQuests = [
    ...(todayQuests?.mainQuests ?? []),
    ...(todayQuests?.bonusQuests ?? []),
    ...(todayQuests?.reviewQuests ?? []),
  ];

  // todayQuests가 비어있고 fullScheduleContext가 있으면 퀘스트 추출
  if (allQuests.length === 0 && fullScheduleContext?.activePlans?.length) {
    const todayStr = new Date().toISOString().split('T')[0];
    const sourceDate = parseKoreanDate(message);
    const sourceDateStr = sourceDate ? formatDateString(sourceDate) : null;

    for (const fsPlan of fullScheduleContext.activePlans) {
      const targetDateForSearch = sourceDateStr ?? todayStr;
      const matchingQuests = fsPlan.dailyQuests?.filter(q => q.date === targetDateForSearch) ?? [];

      for (const dq of matchingQuests) {
        allQuests.push({
          id: `fs-quest-${fsPlan.id}-${dq.day}`,
          planId: fsPlan.id,
          title: dq.unitTitle,
          date: dq.date,
          status: dq.completed ? 'COMPLETED' : 'PENDING',
          estimatedMinutes: dq.estimatedMinutes ?? 30,
        } as any);
      }

      // 오늘 퀘스트도 없으면 다가오는 미완료 퀘스트 중 첫 번째 추출
      if (allQuests.length === 0) {
        const upcomingQuests = fsPlan.dailyQuests?.filter(q => !q.completed && q.date >= todayStr)?.slice(0, 3) ?? [];
        for (const dq of upcomingQuests) {
          allQuests.push({
            id: `fs-quest-${fsPlan.id}-${dq.day}`,
            planId: fsPlan.id,
            title: dq.unitTitle,
            date: dq.date,
            status: 'PENDING',
            estimatedMinutes: dq.estimatedMinutes ?? 30,
          } as any);
        }
      }
    }
    console.log(`[AdjustHandler] Extracted ${allQuests.length} quests from fullScheduleContext`);
  }

  const hasFullSchedulePlan = (fullScheduleContext?.activePlans?.length ?? 0) > 0;
  const messageActions: MessageAction[] = [];

  // 1. 날짜 파싱
  const targetDate = parseKoreanDate(message);
  const targetDateStr = targetDate ? formatDateString(targetDate) : null;
  console.log(`[AdjustHandler] Parsed target date: ${targetDateStr}`);

  // 2. "오늘" 퀘스트 미루기 패턴 감지
  const isPostponeToday = /오늘|지금/.test(message) && /미뤄|미루|연기|못/.test(message);
  const postponeDaysMatch = message.match(/(\d+)\s*일/);
  const postponeDays = postponeDaysMatch ? parseInt(postponeDaysMatch[1], 10) : 1;

  // 3. 퀘스트 정보 확인
  const hasQuests = allQuests.length > 0;
  const incompleteQuests = allQuests.filter(q => q.status !== 'COMPLETED');

  // 4. 메시지 액션 생성
  if (targetDate && hasQuests) {
    for (const quest of incompleteQuests) {
      if (quest.planId) {
        const questDate = new Date(quest.date);
        const dayNumber = Math.floor((questDate.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)) + 1;

        messageActions.push({
          id: `reschedule-${quest.planId}-${quest.id}-${Date.now()}`,
          type: 'RESCHEDULE_QUEST',
          label: `"${quest.title}" → ${formatDateKorean(targetDate)}로 이동`,
          icon: '📆',
          data: {
            planId: quest.planId,
            questId: quest.id,
            questDay: dayNumber,
            newDate: targetDateStr!,
          },
        });
      }
    }

    if (messageActions.length === 0) {
      const daysToTarget = Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      messageActions.push({
        id: `postpone-to-date-${Date.now()}`,
        type: 'POSTPONE_TODAY',
        label: `${formatDateKorean(targetDate)}로 미루기`,
        icon: '📅',
        data: { daysToAdd: daysToTarget },
      });
    }
  } else if (isPostponeToday && hasQuests) {
    messageActions.push({
      id: `postpone-today-${Date.now()}`,
      type: 'POSTPONE_TODAY',
      label: `오늘 퀘스트 ${postponeDays}일 미루기`,
      icon: '📅',
      data: { daysToAdd: postponeDays },
    });
  }

  // 5. 응답 메시지 생성
  let responseMessage: string;

  if (!plan && !hasQuests && !hasFullSchedulePlan) {
    responseMessage = '아직 활성 플랜이 없어요! 📚\n먼저 학습 계획을 만들어볼까요?';
    messageActions.push({
      id: `navigate-new-plan-${Date.now()}`,
      type: 'NAVIGATE',
      label: '새 플랜 만들기',
      icon: '➕',
      data: { navigateTo: '/new-plan' },
    });
  } else if (messageActions.length > 0) {
    const dateStr = targetDate ? formatDateKorean(targetDate) : `${postponeDays}일 뒤`;
    responseMessage = `네, ${dateStr}로 옮겨드릴게요! 📅\n아래 버튼을 눌러 확정해주세요 👇`;
  } else if (hasFullSchedulePlan) {
    const scheduleSummary = generateScheduleSummary([], memoryContext.reviewDue, fullScheduleContext);
    responseMessage = `일정 조정을 도와드릴게요! 📅\n\n${scheduleSummary}\n\n어떤 퀘스트를 어디로 옮기고 싶으신가요?`;
  } else {
    responseMessage = await generateAdjustResponse(message, plan, memoryContext, generateResponse);
  }

  return { message: responseMessage, messageActions };
}

/**
 * LLM 기반 조정 응답 생성 (폴백용)
 */
async function generateAdjustResponse(
  message: string,
  plan: StudyPlan | undefined,
  memoryContext: DirectorContext['memoryContext'],
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<string> {
  const planInfo = plan
    ? `현재 계획: ${plan.title}\n진행률: ${((plan.completedSessions / plan.totalSessions) * 100).toFixed(0)}%`
    : '현재 활성 계획이 없습니다.';

  const adjustPrompt = `당신은 QuestyBook의 학습 일정 조정 AI입니다.
학생의 요청을 친근하게 수락하고, 어떻게 변경할지 안내하세요.

## 현재 상태
${planInfo}

## 응답 가이드
- 긍정적으로 수락 ("네, 옮겨드릴게요!" 등)
- 친근한 톤, 이모지 사용
- 100자 이내로 간결하게`;

  try {
    return await generateResponse(adjustPrompt, message, {
      model: 'claude-4.5-haiku',
      temperature: 0.7,
      maxTokens: 256,
    });
  } catch {
    return plan ? '일정을 조정해드릴게요! 📅' : '먼저 플랜을 만들어볼까요? 📚';
  }
}
