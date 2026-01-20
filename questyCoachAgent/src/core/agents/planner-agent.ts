/**
 * PlannerAgent (진화형)
 * 학습 계획 수립 전문 에이전트
 *
 * 이 파일은 모듈화된 PlannerAgent를 re-export합니다.
 * 실제 구현은 ./planner/ 디렉토리에 분리되어 있습니다.
 *
 * 모듈 구조:
 * - planner/types.ts: 타입 정의
 * - planner/prompts.ts: 시스템 프롬프트
 * - planner/utils/: 날짜, 추출 유틸리티
 * - planner/generators/: 퀘스트, 플랜, 스케줄 생성
 * - planner/handlers/: 요청, 조정 핸들러
 * - planner/learning/: 성과 추적
 */

export { PlannerAgent } from './planner/planner-agent.js';
export type {
  PlanGenerationRequest,
  DualPlanResult,
  AIRecommendation,
  AIQuestResult,
  PlanRequestType,
  // 커리큘럼 생성 타입 (LLM 기반)
  CurriculumGenerationRequest,
  CurriculumGenerationResult,
  CurriculumQuest,
  CurriculumCourse,
  CurriculumChapter,
  // 커리큘럼 검증 타입
  CurriculumReviewResult,
  ReviewCategory,
} from './planner/types.js';
