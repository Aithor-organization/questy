/**
 * useAdminCourses
 * 관리자 강좌/강사 관리 훅 - Supabase 직접 연동
 *
 * 모듈화된 구조 (admin-courses/ 디렉토리):
 * - types.ts: 타입 정의 및 유틸리티 함수
 * - useTeachers.ts: 강사 관련 훅
 * - useCourses.ts: 강좌 관련 훅
 * - useBatchUpdate.ts: 배치 업데이트 훅
 * - index.ts: 통합 훅
 */

export {
  useAdminCourses,
  useTeachers,
  useCourses,
  useBatchUpdate,
  type Teacher,
  type Course,
  type BatchUpdateOptions,
  type BatchProgressData,
} from './admin-courses';

export { useAdminCourses as default } from './admin-courses';
