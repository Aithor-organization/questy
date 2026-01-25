/**
 * SearchSection
 * 강좌 검색 입력과 과목 필터 버튼을 포함하는 섹션
 */

import { SOCIAL_SUBJECTS, SCIENCE_SUBJECTS } from '../../../my/constants';
import { SubjectButton, TamguCategoryButton } from './SubjectFilterButtons';
import type { SearchSectionProps } from './types';

/** 기본 과목 목록 */
const MAIN_SUBJECTS = ['수학', '영어', '국어', '한국사'];

/**
 * 검색 입력 필드 컴포넌트
 */
function SearchInput({
  searchQuery,
  isSearching,
  onSearchQueryChange,
  onSearch,
}: Pick<SearchSectionProps, 'searchQuery' | 'isSearching' | 'onSearchQueryChange' | 'onSearch'>) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="강좌명 또는 강사명 검색..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        className="flex-1 min-w-0 px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
      />
      <button
        onClick={onSearch}
        disabled={isSearching}
        className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 shrink-0"
      >
        {isSearching ? '...' : '검색'}
      </button>
    </div>
  );
}

/**
 * SearchSection 메인 컴포넌트
 * 검색 입력, 과목 필터, 탐구 과목 선택을 포함
 */
export function SearchSection({
  searchQuery,
  selectedSubject,
  expandedTamgu,
  isSearching,
  onSearchQueryChange,
  onSearch,
  onSubjectClick,
  onTamguCategoryClick,
  onTamguSubjectClick,
}: SearchSectionProps) {
  // 탐구 과목 체크 함수
  const isScienceSubject = (subject: string | null) =>
    subject ? SCIENCE_SUBJECTS.includes(subject) : false;
  const isSocialSubject = (subject: string | null) =>
    subject ? SOCIAL_SUBJECTS.includes(subject) : false;

  return (
    <>
      <SearchInput
        searchQuery={searchQuery}
        isSearching={isSearching}
        onSearchQueryChange={onSearchQueryChange}
        onSearch={onSearch}
      />

      <div className="space-y-2">
        {/* 메인 과목 + 탐구 카테고리 버튼 */}
        <div className="flex gap-2 flex-wrap items-center">
          {MAIN_SUBJECTS.map((subject) => (
            <SubjectButton
              key={subject}
              subject={subject}
              isSelected={selectedSubject === subject}
              onClick={() => onSubjectClick(subject)}
            />
          ))}

          <TamguCategoryButton
            category="과탐"
            isExpanded={expandedTamgu === '과탐'}
            hasSelectedSubject={isScienceSubject(selectedSubject)}
            onClick={() => onTamguCategoryClick('과탐')}
          />

          <TamguCategoryButton
            category="사탐"
            isExpanded={expandedTamgu === '사탐'}
            hasSelectedSubject={isSocialSubject(selectedSubject)}
            onClick={() => onTamguCategoryClick('사탐')}
          />
        </div>

        {/* 과탐 세부 과목 */}
        {expandedTamgu === '과탐' && (
          <div className="flex gap-1.5 flex-wrap pl-2">
            {SCIENCE_SUBJECTS.map((subject) => (
              <SubjectButton
                key={subject}
                subject={subject}
                isSelected={selectedSubject === subject}
                onClick={() => onTamguSubjectClick(subject)}
                variant="science"
              />
            ))}
          </div>
        )}

        {/* 사탐 세부 과목 */}
        {expandedTamgu === '사탐' && (
          <div className="flex gap-1.5 flex-wrap pl-2">
            {SOCIAL_SUBJECTS.map((subject) => (
              <SubjectButton
                key={subject}
                subject={subject}
                isSelected={selectedSubject === subject}
                onClick={() => onTamguSubjectClick(subject)}
                variant="social"
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-1">
        과탐/사탐을 눌러 세부 과목을 선택하세요
      </p>
    </>
  );
}
