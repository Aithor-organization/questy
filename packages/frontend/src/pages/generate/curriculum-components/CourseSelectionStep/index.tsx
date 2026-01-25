/**
 * CourseSelectionStep
 * 강좌 선택 단계 메인 컴포넌트
 *
 * 하위 컴포넌트:
 * - SearchSection: 검색 입력 및 과목 필터
 * - SearchResultsList: 검색 결과 목록
 * - SelectedCoursesList: 선택된 강좌 목록
 * - FeasibilityError: 실행 가능성 오류 표시
 */

import { useState } from 'react';
import { SearchSection } from './SearchSection';
import { SearchResultsList } from './SearchResultsList';
import { SelectedCoursesList } from './SelectedCoursesList';
import { FeasibilityError } from './FeasibilityError';
import type { CourseSelectionStepProps } from './types';
import type { Course } from '../../../../types/curriculum';

/**
 * CourseSelectionStep 메인 컴포넌트
 * 강좌 검색, 선택, 이어듣기 설정 기능을 제공
 */
export function CourseSelectionStep(props: CourseSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedTamgu, setExpandedTamgu] = useState<'과탐' | '사탐' | null>(null);

  /** 검색 실행 */
  const handleSearch = () => {
    if (searchQuery.trim()) {
      props.onSearch(searchQuery, selectedSubject || undefined);
    }
  };

  /** 메인 과목 클릭 (토글) */
  const handleSubjectClick = (subject: string) => {
    if (selectedSubject === subject) {
      setSelectedSubject(null);
      props.onSearchBySubject(subject);
    } else {
      setSelectedSubject(subject);
      props.onSearchBySubject(subject, searchQuery.trim() || undefined);
    }
  };

  /** 탐구 카테고리 클릭 (과탐/사탐 토글) */
  const handleTamguCategoryClick = (category: '과탐' | '사탐') => {
    setExpandedTamgu(expandedTamgu === category ? null : category);
  };

  /** 탐구 세부 과목 클릭 */
  const handleTamguSubjectClick = (subject: string) => {
    setSelectedSubject(subject);
    props.onSearchBySubject(subject, searchQuery.trim() || undefined);
  };

  /** 강좌 선택/해제 토글 */
  const handleToggleSelect = (course: Course, isSelected: boolean) => {
    if (isSelected) {
      props.onDeselect(course.id);
    } else {
      props.onSelect(course);
    }
  };

  const canProceed = props.selectedCourses.length > 0 && !props.feasibilityError;

  return (
    <div className="space-y-4">
      {/* 검색 섹션 */}
      <SearchSection
        searchQuery={searchQuery}
        selectedSubject={selectedSubject}
        expandedTamgu={expandedTamgu}
        isSearching={props.isSearching}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        onSubjectClick={handleSubjectClick}
        onTamguCategoryClick={handleTamguCategoryClick}
        onTamguSubjectClick={handleTamguSubjectClick}
      />

      {/* 검색 결과 */}
      <SearchResultsList
        searchResults={props.searchResults}
        selectedCourses={props.selectedCourses}
        onToggleSelect={handleToggleSelect}
      />

      {/* 선택된 강좌 목록 */}
      <SelectedCoursesList
        selectedCourses={props.selectedCourses}
        onDeselect={props.onDeselect}
        onUpdateStartChapter={props.onUpdateStartChapter}
      />

      {/* 실행 가능성 오류 */}
      {props.feasibilityError && (
        <FeasibilityError error={props.feasibilityError} onClear={props.onClearError} />
      )}

      {/* 네비게이션 버튼 */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={props.onBack}
          className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          이전
        </button>
        <button
          onClick={props.onNext}
          disabled={!canProceed}
          className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
        >
          퀘스트 생성
        </button>
      </div>
    </div>
  );
}

// Re-export types for external use
export type { CourseSelectionStepProps } from './types';
