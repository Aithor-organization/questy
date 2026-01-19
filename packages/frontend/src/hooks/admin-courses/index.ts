/**
 * Admin Courses - Unified Hook
 * 관리자 강좌/강사 관리 통합 훅
 *
 * 모듈화된 구조:
 * - types.ts: 타입 정의 및 유틸리티 함수
 * - useTeachers.ts: 강사 관련 훅
 * - useCourses.ts: 강좌 관련 훅
 * - useBatchUpdate.ts: 배치 업데이트 훅
 */

import { useTeachers } from './useTeachers';
import { useCourses } from './useCourses';
import { useBatchUpdate } from './useBatchUpdate';

// 타입 re-export
export type { Teacher, Course, BatchUpdateOptions, BatchProgressData } from './types';

// 개별 훅 re-export
export { useTeachers } from './useTeachers';
export { useCourses } from './useCourses';
export { useBatchUpdate } from './useBatchUpdate';

/**
 * useAdminCourses
 * 모든 관리자 강좌/강사 기능을 통합한 훅
 */
export function useAdminCourses() {
  const teacherHook = useTeachers();
  const courseHook = useCourses(teacherHook.fetchTeachers);
  const batchHook = useBatchUpdate();

  return {
    // 강사 관련
    teachers: teacherHook.teachers,
    fetchTeachers: teacherHook.fetchTeachers,
    addTeacher: teacherHook.addTeacher,
    editTeacher: teacherHook.editTeacher,
    deleteTeacher: teacherHook.deleteTeacher,

    // 강좌 관련
    courses: courseHook.courses,
    fetchCoursesByTeacher: courseHook.fetchCoursesByTeacher,
    addCourse: courseHook.addCourse,
    addCoursesBatch: courseHook.addCoursesBatch,
    updateCourse: courseHook.updateCourse,
    editCourse: courseHook.editCourse,
    deleteCourse: courseHook.deleteCourse,
    getAllCourses: courseHook.getAllCourses,

    // 배치 업데이트
    batchUpdateCourses: batchHook.batchUpdateCourses,

    // 공통 상태
    loading: teacherHook.loading || courseHook.loading,
    error: teacherHook.error || courseHook.error,
    clearError: () => {
      teacherHook.clearError();
      courseHook.clearError();
    },
  };
}

export default useAdminCourses;
