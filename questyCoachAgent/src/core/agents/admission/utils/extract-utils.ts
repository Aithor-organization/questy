/**
 * 정보 추출 유틸리티
 */

import type { Subject } from '../../../../types/memory.js';
import type { LearningStyle } from '../../../../types/agent.js';

/**
 * 학년 추출
 */
export function extractGrade(message: string): string | null {
  if (/고3|고등학교\s*3/.test(message)) return '고3';
  if (/고2|고등학교\s*2/.test(message)) return '고2';
  if (/고1|고등학교\s*1/.test(message)) return '고1';
  if (/중3|중학교\s*3/.test(message)) return '중3';
  if (/중2|중학교\s*2/.test(message)) return '중2';
  if (/중1|중학교\s*1/.test(message)) return '중1';
  if (/N수|재수|삼수/.test(message)) return 'N수생';
  return null;
}

/**
 * 목표 추출
 */
export function extractGoals(message: string): string[] {
  const goals: string[] = [];
  if (/수능/.test(message)) goals.push('수능 대비');
  if (/내신/.test(message)) goals.push('내신 관리');
  if (/대학/.test(message)) goals.push('대학 입시');
  if (/기초/.test(message)) goals.push('기초 다지기');
  if (/성적/.test(message)) goals.push('성적 향상');
  return goals.length > 0 ? goals : ['학습 능력 향상'];
}

/**
 * 과목 추출
 */
export function extractSubjects(message: string): Subject[] {
  const subjects: Subject[] = [];
  if (/국어|문학/.test(message)) subjects.push('KOREAN');
  if (/수학|미적/.test(message)) subjects.push('MATH');
  if (/영어/.test(message)) subjects.push('ENGLISH');
  if (/과학|물리|화학|생물/.test(message)) subjects.push('SCIENCE');
  if (/사회|역사/.test(message)) subjects.push('SOCIAL');
  return subjects.length > 0 ? subjects : ['GENERAL'];
}

/**
 * 학습 스타일 추출
 */
export function extractLearningStyle(message: string): LearningStyle {
  return {
    preferredPace: /빠르|빨리/.test(message) ? 'FAST' : /천천히|느리/.test(message) ? 'SLOW' : 'MEDIUM',
    visualLearner: /시각|영상|그림/.test(message),
    needsRepetition: /반복|여러\s*번/.test(message),
    prefersChallenges: /도전|어려운|심화/.test(message),
    attentionSpan: /집중.*짧|금방/.test(message) ? 'SHORT' : 'MEDIUM',
  };
}
