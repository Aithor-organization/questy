/**
 * AdmissionAgent
 * 입학 상담 전문 에이전트
 *
 * 이 파일은 모듈화된 AdmissionAgent를 re-export합니다.
 * 실제 구현은 ./admission/ 디렉토리에 분리되어 있습니다.
 *
 * 모듈 구조:
 * - admission/types.ts: 타입 정의
 * - admission/prompts.ts: 시스템 프롬프트
 * - admission/utils/: 추출, 단계 유틸리티
 * - admission/handlers/: 템플릿 핸들러
 * - admission/features/: 반 배정, 오리엔테이션
 */

export { AdmissionAgent } from './admission/admission-agent.js';
export type {
  OnboardingStage,
  ClassOption,
  ClassAssignment,
  OrientationStep,
  OrientationProgress,
} from './admission/types.js';
