/**
 * 메시지 추출 유틸리티
 * 메시지에서 과목, 기간 등 정보 추출
 */

import type { Subject } from '../../../../types/memory.js';
import type { PlanRequestType } from '../types.js';

/**
 * 메시지에서 과목 추출
 */
export function extractSubject(message: string): Subject {
  if (/국어|문학/.test(message)) return 'KOREAN';
  if (/수학|미적/.test(message)) return 'MATH';
  if (/영어|영문/.test(message)) return 'ENGLISH';
  if (/과학|물리|화학|생물/.test(message)) return 'SCIENCE';
  if (/사회|역사/.test(message)) return 'SOCIAL';
  return 'GENERAL';
}

/**
 * 메시지에서 학습 기간 추출 (일 단위)
 */
export function extractDuration(message: string): number {
  const match = message.match(/(\d+)\s*(일|주|week|day)/);
  if (match) {
    const num = parseInt(match[1]);
    if (/주|week/.test(match[2])) return num * 7;
    return num;
  }
  return 30; // 기본값: 30일
}

/**
 * 요청 유형에 따른 후속 질문 생성
 */
export function generateFollowUps(requestType: PlanRequestType): string[] {
  const followUps: Record<PlanRequestType, string[]> = {
    CREATE_PLAN: ['바로 시작할까?', '계획 수정이 필요해?'],
    ADJUST_PLAN: ['이 정도면 괜찮아?', '더 조정할 부분 있어?'],
    CHECK_SCHEDULE: ['지금 바로 시작할까?', '일정 변경이 필요해?'],
    RECOMMEND: ['이대로 진행할까?', '다른 추천이 필요해?'],
    GENERATE_FROM_IMAGE: ['플랜을 선택해줄래?', '다른 기간으로 다시 생성할까?'],
    GENERAL: ['어떤 과목 계획이 필요해?', '현재 진행 중인 계획 확인할까?'],
  };

  return followUps[requestType] ?? [];
}
