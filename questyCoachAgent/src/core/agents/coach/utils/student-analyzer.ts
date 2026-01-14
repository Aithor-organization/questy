/**
 * 학생 상태 분석 유틸리티
 */

import type { DirectorContext } from '../../../../types/agent.js';
import type { StudentState, ResponseType } from '../types.js';

/**
 * 학생 상태 분석
 */
export function analyzeStudentState(
  message: string,
  context: DirectorContext
): StudentState {
  const burnout = context.memoryContext.burnoutStatus;
  const emotion = detectEmotion(message);

  return {
    needsMotivation: /힘들|어려|못하겠|포기/.test(message),
    isConfused: /모르겠|헷갈|이해.*안/.test(message),
    isConfident: /알겠|이해했|쉬워/.test(message),
    emotion,
    burnoutLevel: burnout?.level ?? 'LOW',
  };
}

/**
 * 감정 감지
 */
export function detectEmotion(message: string): string {
  if (/기뻐|좋아|신나/.test(message)) return 'POSITIVE';
  if (/슬퍼|우울|힘들/.test(message)) return 'NEGATIVE';
  if (/화나|짜증|답답/.test(message)) return 'FRUSTRATED';
  return 'NEUTRAL';
}

/**
 * 응답 유형 결정
 */
export function determineResponseType(
  state: StudentState,
  message: string
): ResponseType {
  if (state.burnoutLevel === 'HIGH') return 'EMOTIONAL_SUPPORT';
  if (state.needsMotivation) return 'MOTIVATION';
  if (state.isConfused) return 'EXPLANATION';
  if (/문제|풀어|답/.test(message)) return 'PROBLEM_SOLVING';
  if (/피드백|어땠/.test(message)) return 'FEEDBACK';
  return 'GENERAL';
}

/**
 * 메모리 컨텍스트 구성
 */
export function buildMemoryContext(context: DirectorContext): string {
  const memories = context.memoryContext.relevantMemories;
  if (memories.length === 0) return '';

  const memoryText = memories.slice(0, 3).map((m) =>
    `- [${m.type}] ${m.title}: ${m.content.slice(0, 50)}...`
  ).join('\n');

  return `\n## 이전 학습 기억\n${memoryText}`;
}
