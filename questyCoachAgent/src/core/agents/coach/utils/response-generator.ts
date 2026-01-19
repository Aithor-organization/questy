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

  // 사용자 프로필 컨텍스트 구성
  const userProfileInfo = buildUserProfileContext(metadata?.userProfile);

  // 퀘스트 컨텍스트 추출
  const questInfo = buildQuestContext(metadata?.questContext);

  // 최근 대화 기록 구성
  const conversationHistory = buildConversationHistory(recentConversations);

  // 전체 프롬프트 구성
  return [
    systemPrompt,
    memoryContext,
    conversationHistory,
    userProfileInfo,
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
 * 사용자 프로필 컨텍스트 구성 (온보딩에서 수집한 정보)
 */
function buildUserProfileContext(userProfile?: {
  age?: number | null;
  examYear?: number;
  targetUniversity?: string;
  targetGrades?: Record<string, number>;
  currentGrades?: Record<string, number>;
  selectedTamgu1?: string;
  selectedTamgu2?: string;
  subscribedPlatforms?: string[];
  dailyStudyHours?: number;
}): string {
  if (!userProfile) return '';

  const parts: string[] = ['## 학생 프로필 (개인화된 코칭에 활용)'];

  // 수험 상태
  if (userProfile.examYear !== undefined) {
    const examYearLabels: Record<number, string> = {
      0: '현역 수험생',
      1: '재수생',
      2: '삼수생',
      3: 'N수생',
    };
    parts.push(`- 수험 상태: ${examYearLabels[userProfile.examYear] || '수험생'}`);
  }

  // 목표 대학
  if (userProfile.targetUniversity) {
    parts.push(`- 목표 대학: ${userProfile.targetUniversity}`);
  }

  // 선택 탐구
  const tamguList: string[] = [];
  if (userProfile.selectedTamgu1) tamguList.push(userProfile.selectedTamgu1);
  if (userProfile.selectedTamgu2) tamguList.push(userProfile.selectedTamgu2);
  if (tamguList.length > 0) {
    parts.push(`- 선택 탐구: ${tamguList.join(', ')}`);
  }

  // 목표 등급
  if (userProfile.targetGrades && Object.keys(userProfile.targetGrades).length > 0) {
    const targetList = Object.entries(userProfile.targetGrades)
      .map(([subject, grade]) => `${subject} ${grade}등급`)
      .join(', ');
    parts.push(`- 목표 등급: ${targetList}`);
  }

  // 현재 등급
  if (userProfile.currentGrades && Object.keys(userProfile.currentGrades).length > 0) {
    const currentList = Object.entries(userProfile.currentGrades)
      .map(([subject, grade]) => `${subject} ${grade}등급`)
      .join(', ');
    parts.push(`- 현재 등급: ${currentList}`);
  }

  // 하루 순공 시간
  if (userProfile.dailyStudyHours) {
    parts.push(`- 하루 목표 공부시간: ${userProfile.dailyStudyHours}시간`);
  }

  // 구독 인강
  if (userProfile.subscribedPlatforms && userProfile.subscribedPlatforms.length > 0) {
    parts.push(`- 구독 중인 인강: ${userProfile.subscribedPlatforms.join(', ')}`);
  }

  // 프로필 정보가 있는 경우에만 반환
  if (parts.length <= 1) return '';

  parts.push('\n학생의 프로필을 참고하여 맞춤형 코칭을 제공하세요. 목표 대학과 등급을 고려한 조언을 하면 좋습니다.');

  return parts.join('\n');
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
  activePlans?: Array<{
    id: string;
    title: string;
    totalDays: number;
    completedDays: number;
    startDate: string;
    targetEndDate: string;
    status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
    dailyQuests?: Array<{
      day: number;
      date: string;
      unitTitle: string;
      range?: string;
      completed: boolean;
      estimatedMinutes?: number;
    }>;
  }>;
  weeklyStats?: {
    totalQuests: number;
    completedQuests: number;
    completionRate: number;
    streakDays: number;
    averageMinutesPerDay: number;
  };
  plansCount?: number;
  completedToday?: number;
  totalToday?: number;
}): string {
  if (!questContext) return '';

  const { todayQuests, activePlans, weeklyStats, plansCount, completedToday, totalToday } = questContext;
  const parts: string[] = [];

  // 오늘의 퀘스트 현황
  if (todayQuests && todayQuests.length > 0) {
    const questList = todayQuests.map((q, i) =>
      `${i + 1}. [${q.completed ? '완료' : '진행중'}] ${q.unitTitle} (${q.estimatedMinutes}분) - ${q.planName}`
    ).join('\n');

    parts.push(`
## 오늘의 학습 현황 (매우 중요)
- 진행률: ${completedToday}/${totalToday} 완료
- 총 플랜: ${plansCount}개
- 오늘의 퀘스트 목록:
${questList}

학생이 "오늘 뭐 공부해?"라고 묻거나 학습 계획을 물어보면 **위의 퀘스트 목록을 기반으로** 구체적으로 안내하세요.
이미 완료한 것은 칭찬하고, 남은 퀘스트는 격려하며 시작하도록 유도하세요.`);
  } else if (plansCount && plansCount > 0) {
    parts.push(`
## 오늘의 학습 현황
- 오늘은 예정된 퀘스트가 없습니다.
- 밀린 공부가 있거나 휴식일일 수 있습니다. 학생에게 확인해보세요.`);
  } else {
    parts.push(`
## 오늘의 학습 현황
- 아직 생성된 플랜이 없습니다. 플랜 생성을 제안하세요.`);
  }

  // 활성 플랜 정보 (진도 조회용)
  if (activePlans && activePlans.length > 0) {
    const planList = activePlans.map(p => {
      const progressPercent = p.totalDays > 0 ? Math.round((p.completedDays / p.totalDays) * 100) : 0;
      return `- 📚 ${p.title}: ${p.completedDays}/${p.totalDays}일 완료 (${progressPercent}%) [${p.startDate} ~ ${p.targetEndDate}]`;
    }).join('\n');

    parts.push(`
## 학생의 활성 플랜 (진도 조회 시 참고)
${planList}

학생이 "내 진도 어때?", "플랜 진행 상황", "얼마나 했어?" 등을 물어보면 **위의 활성 플랜 정보를 기반으로** 구체적인 진도와 격려 메시지를 제공하세요.`);
  }

  // 주간 통계 (진도 조회용)
  if (weeklyStats) {
    parts.push(`
## 이번 주 학습 통계
- 이번 주 완료율: ${weeklyStats.completionRate}% (${weeklyStats.completedQuests}/${weeklyStats.totalQuests})
- 연속 학습: ${weeklyStats.streakDays}일 🔥
- 평균 일일 학습시간: ${weeklyStats.averageMinutesPerDay}분`);
  }

  return parts.join('\n');
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
    return `잘하셨어요! 👏\n${state.isConfident ? '이해를 잘 하고 계시네요.' : '조금만 더 연습하면 완벽해질 거예요!'}`;
  }

  return template;
}

/**
 * 후속 질문 생성
 */
export function generateFollowUps(responseType: ResponseType): string[] {
  return FOLLOW_UP_TEMPLATES[responseType] ?? [];
}
