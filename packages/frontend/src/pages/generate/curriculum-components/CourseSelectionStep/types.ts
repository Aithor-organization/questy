/**
 * CourseSelectionStep 컴포넌트 타입 정의
 * 강좌 선택 단계에서 사용되는 모든 타입을 정의합니다.
 */

import type { Course, SelectedCourse } from '../../../../types/curriculum';

/**
 * CourseSelectionStep 메인 컴포넌트 Props
 */
export interface CourseSelectionStepProps {
  /** 검색 결과 강좌 목록 */
  searchResults: Course[];
  /** 선택된 강좌 목록 */
  selectedCourses: SelectedCourse[];
  /** 검색 중 여부 */
  isSearching: boolean;
  /** 실행 가능성 오류 메시지 */
  feasibilityError: string | null;
  /** 검색 실행 핸들러 */
  onSearch: (query: string, subject?: string) => void;
  /** 과목별 검색 핸들러 */
  onSearchBySubject: (subject: string, query?: string) => void;
  /** 강좌 선택 핸들러 */
  onSelect: (course: Course) => void;
  /** 강좌 선택 해제 핸들러 */
  onDeselect: (courseId: string) => void;
  /** 이어듣기 시작점 업데이트 핸들러 */
  onUpdateStartChapter: (courseId: string, chapterIndex: number | undefined) => void;
  /** 이전 단계로 이동 */
  onBack: () => void;
  /** 다음 단계로 이동 */
  onNext: () => void;
  /** 오류 초기화 */
  onClearError: () => void;
}

/**
 * SearchSection 컴포넌트 Props
 */
export interface SearchSectionProps {
  /** 검색 쿼리 */
  searchQuery: string;
  /** 선택된 과목 */
  selectedSubject: string | null;
  /** 확장된 탐구 카테고리 */
  expandedTamgu: '과탐' | '사탐' | null;
  /** 검색 중 여부 */
  isSearching: boolean;
  /** 검색 쿼리 변경 */
  onSearchQueryChange: (query: string) => void;
  /** 검색 실행 */
  onSearch: () => void;
  /** 과목 클릭 */
  onSubjectClick: (subject: string) => void;
  /** 탐구 카테고리 클릭 */
  onTamguCategoryClick: (category: '과탐' | '사탐') => void;
  /** 탐구 세부 과목 클릭 */
  onTamguSubjectClick: (subject: string) => void;
}

/**
 * SearchResultsList 컴포넌트 Props
 */
export interface SearchResultsListProps {
  /** 검색 결과 */
  searchResults: Course[];
  /** 선택된 강좌 목록 */
  selectedCourses: SelectedCourse[];
  /** 강좌 선택/해제 토글 */
  onToggleSelect: (course: Course, isSelected: boolean) => void;
}

/**
 * SelectedCoursesList 컴포넌트 Props
 */
export interface SelectedCoursesListProps {
  /** 선택된 강좌 목록 */
  selectedCourses: SelectedCourse[];
  /** 강좌 선택 해제 */
  onDeselect: (courseId: string) => void;
  /** 이어듣기 시작점 업데이트 */
  onUpdateStartChapter: (courseId: string, chapterIndex: number | undefined) => void;
}

/**
 * FeasibilityError 컴포넌트 Props
 */
export interface FeasibilityErrorProps {
  /** 오류 메시지 */
  error: string;
  /** 오류 초기화 */
  onClear: () => void;
}
