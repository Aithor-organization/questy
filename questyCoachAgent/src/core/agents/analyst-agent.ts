/**
 * AnalystAgent (진화형)
 * 학습 분석 전문 에이전트
 *
 * 이 파일은 모듈화된 AnalystAgent를 re-export합니다.
 * 실제 구현은 ./analyst/ 디렉토리에 분리되어 있습니다.
 *
 * 모듈 구조:
 * - analyst/types.ts: 타입 정의
 * - analyst/prompts.ts: 시스템 프롬프트
 * - analyst/utils/: 포맷팅 유틸리티
 * - analyst/generators/: 통계, 리뷰 생성
 * - analyst/handlers/: 분석, 일정 핸들러
 * - analyst/patterns/: 패턴 관리
 */

export { AnalystAgent } from './analyst/analyst-agent.js';
export type {
  AnalysisType,
  PlanReviewRequest,
  ExtendedPlanReview,
  PlanStats,
} from './analyst/types.js';
