/**
 * 온보딩 단계 관련 유틸리티
 */

import type { OnboardingStage } from '../types.js';
import type { StudentProfile } from '../../../../types/agent.js';

/**
 * 프론트엔드 stage를 OnboardingStage로 매핑
 */
export function mapFrontendStageToOnboardingStage(stage: string | undefined): OnboardingStage | null {
  if (!stage) return null;

  const mapping: Record<string, OnboardingStage> = {
    'name': 'COLLECT_BASIC',
    'grade': 'COLLECT_BASIC',
    'subjects': 'COLLECT_GOALS',
    'goals': 'COLLECT_GOALS',
    'classAssignment': 'CLASS_ASSIGN',
    'orientation': 'ORIENTATION',
    'complete': 'COMPLETE',
    'general': 'GENERAL',
    'welcome': 'WELCOME',
  };

  return mapping[stage] ?? null;
}

/**
 * 온보딩 단계 결정
 */
export function determineOnboardingStage(
  profile: StudentProfile | undefined,
  message: string
): OnboardingStage {
  // 기존 프로필이 완성되어 있으면 일반 문의
  if (profile && profile.enrolledSubjects.length > 0) {
    return 'GENERAL';
  }

  // 메시지 내용으로 단계 파악
  if (/시작|가입|처음|등록/.test(message)) return 'WELCOME';
  if (/학년|고등|중학|초등/.test(message)) return 'COLLECT_BASIC';
  if (/목표|수능|대학|시험/.test(message)) return 'COLLECT_GOALS';
  if (/스타일|방식|시간|선호/.test(message)) return 'COLLECT_STYLE';
  if (/완료|시작하자|준비됐/.test(message)) return 'COMPLETE';

  return 'WELCOME';
}

/**
 * 단계별 후속 질문
 */
export function getStageFollowUps(stage: OnboardingStage): string[] {
  const followUps: Record<OnboardingStage, string[]> = {
    WELCOME: ['학년을 알려주세요', '어떤 과목이 필요해요?'],
    COLLECT_BASIC: ['목표가 뭐예요?', '수능 준비 중이에요?'],
    COLLECT_GOALS: ['학습 스타일은 어때요?', '하루에 얼마나 공부해요?'],
    COLLECT_STYLE: ['시작할 준비됐어요?', '더 알려줄 게 있어요?'],
    COMPLETE: ['바로 공부 시작할까요?', '계획부터 세울까요?'],
    GENERAL: ['무엇을 도와드릴까요?', '다른 질문 있으세요?'],
    CLASS_ASSIGN: ['반 선택 도움이 필요해요?', '추천 반으로 할까요?'],
    ORIENTATION: ['다음 단계로 넘어갈까요?', '다시 설명해 드릴까요?'],
  };

  return followUps[stage] ?? [];
}
