/**
 * SearchResultsList
 * 검색된 강좌 목록을 표시하고 선택/해제 기능을 제공
 */

import type { Course } from '../../../../types/curriculum';
import type { SearchResultsListProps } from './types';

/**
 * 개별 검색 결과 아이템
 */
function SearchResultItem({
  course,
  isSelected,
  onToggle,
}: {
  course: Course;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`p-3 rounded-lg mb-2 flex justify-between items-start transition-colors ${
        isSelected ? 'bg-[var(--highlight-blue)]' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex-1 min-w-0 pr-3">
        <div className="font-medium text-sm">{course.courseName}</div>
        <div className="text-xs text-gray-500">
          {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`px-3 py-1 text-sm rounded transition-colors flex-shrink-0 self-center ${
          isSelected
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-[var(--ink-blue)] text-white hover:bg-[var(--ink-blue)]/90'
        }`}
      >
        {isSelected ? '제거' : '추가'}
      </button>
    </div>
  );
}

/**
 * SearchResultsList 메인 컴포넌트
 * 검색 결과가 없을 때 안내 메시지를 표시하고,
 * 결과가 있으면 각 강좌를 목록으로 표시
 */
export function SearchResultsList({
  searchResults,
  selectedCourses,
  onToggleSelect,
}: SearchResultsListProps) {
  if (searchResults.length === 0) {
    return (
      <div className="notebook-card p-2 max-h-48 overflow-y-auto">
        <p className="text-center text-gray-400 py-4 text-sm">강좌를 검색해주세요</p>
      </div>
    );
  }

  return (
    <div className="notebook-card p-2 max-h-48 overflow-y-auto">
      {searchResults.map((course) => {
        const isSelected = selectedCourses.some((c) => c.id === course.id);
        return (
          <SearchResultItem
            key={course.id}
            course={course}
            isSelected={isSelected}
            onToggle={() => onToggleSelect(course, isSelected)}
          />
        );
      })}
    </div>
  );
}
