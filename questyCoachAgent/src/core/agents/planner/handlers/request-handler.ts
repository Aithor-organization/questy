/**
 * 요청 핸들러 모듈
 * 요청 분류, 플랜 생성, 일반 요청 처리
 */

import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import type { StudyPlan, DirectorContext } from '../../../../types/agent.js';
import type { TopicMastery } from '../../../../types/memory.js';
import type { PlanRequestType } from '../types.js';
import { extractSubject, extractDuration } from '../utils/extract-utils.js';
import { generateSessions } from '../generators/schedule-generator.js';

/**
 * 요청 유형 분류
 */
export function classifyRequest(message: string): PlanRequestType {
  if (/이미지|목차|사진/.test(message)) return 'GENERATE_FROM_IMAGE';
  if (/새|시작|만들어|계획.*세워/.test(message)) return 'CREATE_PLAN';
  if (/조정|바꿔|수정|변경|미뤄|미룰|연기|옮겨|늦춰|당겨/.test(message)) return 'ADJUST_PLAN';
  if (/일정|스케줄|언제|뭐.*해야/.test(message)) return 'CHECK_SCHEDULE';
  if (/추천|권장|어떻게/.test(message)) return 'RECOMMEND';
  return 'GENERAL';
}

/**
 * 학습 플랜 생성
 */
export async function createStudyPlan(
  studentId: string,
  message: string,
  masteryInfo: TopicMastery[]
): Promise<{ message: string; plan: StudyPlan }> {
  const subject = extractSubject(message);
  const totalDays = extractDuration(message);

  const plan: StudyPlan = {
    id: uuidv4(),
    studentId,
    textbookId: 'default-textbook',
    subject,
    title: `${subject} 학습 계획`,
    totalSessions: totalDays,
    completedSessions: 0,
    startDate: new Date(),
    targetEndDate: addDays(new Date(), totalDays),
    status: 'ACTIVE',
    sessions: generateSessions(totalDays, subject, masteryInfo),
  };

  const messageResponse = `📅 **${plan.title}** 생성 완료!

📊 **계획 개요**
- 총 세션: ${plan.totalSessions}회
- 기간: ${totalDays}일
- 시작일: 오늘
- 목표 완료일: ${plan.targetEndDate.toLocaleDateString('ko-KR')}

📝 **첫 주 계획**
${plan.sessions.slice(0, 7).map((s, i) =>
  `${i + 1}일차: ${s.topic} (${s.estimatedMinutes}분)`
).join('\n')}

화이팅! 💪 함께 달려보자!`;

  return { message: messageResponse, plan };
}

/**
 * 일반적인 학습 계획 관련 요청을 LLM으로 처리
 */
export async function handleGeneralRequest(
  message: string,
  activePlans: StudyPlan[],
  memoryContext: DirectorContext['memoryContext'],
  generateResponse: (systemPrompt: string, userPrompt: string, options?: object) => Promise<string>
): Promise<string> {
  const planInfo = activePlans.length > 0
    ? activePlans.map(p => `- ${p.title} (진행률: ${((p.completedSessions / p.totalSessions) * 100).toFixed(0)}%)`).join('\n')
    : '현재 활성 계획이 없습니다.';

  const generalPrompt = `당신은 친근한 학습 계획 전문가입니다.
학생의 질문이나 요청에 도움을 주세요.

## 현재 학습 상황
${planInfo}

## 제공 가능한 서비스
- 새 교재 학습 계획 수립
- 현재 진도 조정
- 복습 스케줄 확인
- 학습 일정 변경 (미루기, 당기기)
- 학습 추천

학생의 요청을 이해하고 적절한 도움을 제공해주세요.
친근하고 격려하는 톤으로 응답하며, 이모지를 적절히 사용하세요.
응답은 200자 이내로 간결하게 해주세요.`;

  try {
    return await generateResponse(generalPrompt, message, {
      model: 'claude-4.5-haiku',
      temperature: 0.7,
      maxTokens: 512,
    });
  } catch (error) {
    console.error('[RequestHandler] LLM general request failed:', error);
    return '어떤 계획을 세워드릴까요? 📚\n- 새 교재 학습 계획\n- 현재 진도 조정\n- 복습 스케줄 확인';
  }
}
