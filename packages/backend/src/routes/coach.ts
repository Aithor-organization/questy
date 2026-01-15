/**
 * Coach Agent Routes
 * QuestyCoachAgent 실제 통합 API
 *
 * 모듈화된 라우트 구조 (coach/ 디렉토리):
 * - types.ts: Zod 스키마 및 타입 정의
 * - singletons.ts: Supervisor/AutoRescheduler 싱글톤
 * - utils.ts: 유틸리티 함수
 * - students.ts: 학생 관리 라우트
 * - chat.ts: 채팅/입학상담 라우트
 * - plans.ts: 플랜 관리 라우트
 * - quests.ts: 퀘스트/오늘의 학습 라우트
 * - reports.ts: 리포트/메모리/번아웃 체크
 * - delays.ts: 스케줄 밀림 처리
 * - interventions.ts: 리마인더/저녁리뷰/위기개입
 * - scheduler.ts: 자동 일정 재조정
 * - level-test.ts: 레벨 테스트
 * - class-assignment.ts: 반 배정/오리엔테이션
 * - index.ts: 라우터 통합
 */

export { coachRoutes } from './coach/index.js';
