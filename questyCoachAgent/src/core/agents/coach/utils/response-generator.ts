/**
 * 응답 생성 유틸리티
 */

import type { AgentRequest } from '../../../../types/agent.js';
import type { StudentState, ResponseType } from '../types.js';
import { RESPONSE_GUIDELINES, FOLLOW_UP_TEMPLATES, FALLBACK_TEMPLATES } from '../prompts.js';

// 대화 기록 타입
type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

/**
 * 코칭 프롬프트 구성
 */
export function buildCoachingPrompt(
  systemPrompt: string,
  memoryContext: string,
  state: StudentState,
  responseType: ResponseType,
  metadata?: AgentRequest['metadata'],
  recentConversations?: ConversationMessage[]
): string {
  // 학생 상태 정보
  const stateInfo = `
## 현재 학생 상태
- 동기부여 필요: ${state.needsMotivation ? '예' : '아니오'}
- 혼란 상태: ${state.isConfused ? '예' : '아니오'}
- 자신감: ${state.isConfident ? '높음' : '낮음'}
- 감정: ${state.emotion}
- 번아웃 레벨: ${state.burnoutLevel}`;

  // 퀘스트 컨텍스트 추출
  const questInfo = buildQuestContext(metadata?.questContext);

  // 최근 대화 기록 구성
  const conversationHistory = buildConversationHistory(recentConversations);

  // 전체 프롬프트 구성
  return [
    systemPrompt,
    memoryContext,
    conversationHistory,
    stateInfo,
    questInfo,
    `\n## 이번 응답 가이드라인\n${RESPONSE_GUIDELINES[responseType]}`,
  ].join('\n');
}

/**
 * 최근 대화 기록을 프롬프트 형식으로 변환
 */
function buildConversationHistory(conversations?: ConversationMessage[]): string {
  if (!conversations || conversations.length === 0) return '';

  // 최근 10개 대화만 사용 (너무 길면 토큰 낭비)
  const recentMessages = conversations.slice(-10);

  const historyText = recentMessages.map((msg) => {
    const role = msg.role === 'user' ? '학생' : '코치';
    return `${role}: ${msg.content}`;
  }).join('\n');

  return `
## 최근 대화 기록 (중요: 이 대화 맥락을 기억하세요)
${historyText}

위 대화에서 학생이 언급한 이름, 정보, 요청 사항을 기억하고 자연스럽게 대화를 이어가세요.`;
}

/**
 * 퀘스트 컨텍스트 구성
 */
function buildQuestContext(questContext?: {
  todayQuests?: Array<{
    unitTitle: string;
    estimatedMinutes?: number;
    planName?: string;
    completed?: boolean;
  }>;
  plansCount?: number;
  completedToday?: number;
  totalToday?: number;
}): string {
  if (!questContext) return '';

  const { todayQuests, plansCount, completedToday, totalToday } = questContext;

  if (todayQuests && todayQuests.length > 0) {
    const questList = todayQuests.map((q, i) =>
      `${i + 1}. [${q.completed ? '완료' : '진행중'}] ${q.unitTitle} (${q.estimatedMinutes}분) - ${q.planName}`
    ).join('\n');

    return `
## 오늘의 학습 현황 (매우 중요)
- 진행률: ${completedToday}/${totalToday} 완료
- 총 플랜: ${plansCount}개
- 오늘의 퀘스트 목록:
${questList}

학생이 "오늘 뭐 공부해?"라고 묻거나 학습 계획을 물어보면 **위의 퀘스트 목록을 기반으로** 구체적으로 안내하세요.
이미 완료한 것은 칭찬하고, 남은 퀘스트는 격려하며 시작하도록 유도하세요.`;
  }

  if (plansCount && plansCount > 0) {
    return `
## 오늘의 학습 현황
- 오늘은 예정된 퀘스트가 없습니다.
- 밀린 공부가 있거나 휴식일일 수 있습니다. 학생에게 확인해보세요.`;
  }

  return `
## 오늘의 학습 현황
- 아직 생성된 플랜이 없습니다. 플랜 생성을 제안하세요.`;
}

/**
 * 폴백 응답 (LLM 실패 시)
 */
export function getFallbackResponse(
  responseType: ResponseType,
  state: StudentState
): string {
  const template = FALLBACK_TEMPLATES[responseType];

  // FEEDBACK 타입은 상태에 따라 동적 처리
  if (responseType === 'FEEDBACK') {
    return `잘했어! 👏\n${state.isConfident ? '이해를 잘 하고 있구나.' : '조금만 더 연습하면 완벽해질 거야!'}`;
  }

  return template;
}

/**
 * 후속 질문 생성
 */
export function generateFollowUps(responseType: ResponseType): string[] {
  return FOLLOW_UP_TEMPLATES[responseType] ?? [];
}
