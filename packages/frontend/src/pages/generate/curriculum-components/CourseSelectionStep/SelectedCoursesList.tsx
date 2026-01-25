/**
 * SelectedCoursesList
 * 선택된 강좌 목록과 이어듣기 시작점 선택 기능을 제공
 */

import type { SelectedCourse } from '../../../../types/curriculum';
import type { SelectedCoursesListProps } from './types';

/**
 * 개별 선택된 강좌 카드
 */
function SelectedCourseCard({
  course,
  onDeselect,
  onUpdateStartChapter,
}: {
  course: SelectedCourse;
  onDeselect: () => void;
  onUpdateStartChapter: (chapterIndex: number | undefined) => void;
}) {
  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onUpdateStartChapter(value === '' ? undefined : parseInt(value, 10));
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
      {/* 강좌 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--ink-black)] text-sm leading-tight">
            {course.courseName}
          </h4>
          <p className="text-xs text-[var(--pencil-gray)] mt-1">
            {course.lecturer} · {course.subject} · {course.chapters?.length || 0}강
          </p>
        </div>
        <button
          onClick={onDeselect}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
          aria-label="강좌 제거"
        >
          x
        </button>
      </div>

      {/* 이어듣기 선택 */}
      {course.chapters && course.chapters.length > 0 && (
        <ChapterSelector
          chapters={course.chapters}
          startFromChapter={course.startFromChapter}
          onChange={handleChapterChange}
        />
      )}
    </div>
  );
}

/**
 * 이어듣기 시작점 선택 드롭다운
 */
function ChapterSelector({
  chapters,
  startFromChapter,
  onChange,
}: {
  chapters: Array<{ title: string }>;
  startFromChapter: number | undefined;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
      <label className="text-xs text-[var(--pencil-gray)] mb-1.5 block">
        이어듣기 시작점
      </label>
      <select
        value={startFromChapter ?? ''}
        onChange={onChange}
        className="w-full text-sm px-3 py-2 border border-[var(--paper-lines)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent"
      >
        {chapters.map((chapter, idx) => {
          const truncatedTitle =
            chapter.title.length > 30 ? `${chapter.title.slice(0, 30)}...` : chapter.title;
          const suffix = idx > 0 ? ' 부터' : ' (처음부터)';
          return (
            <option key={idx} value={idx === 0 ? '' : idx}>
              {idx + 1}강. {truncatedTitle}
              {suffix}
            </option>
          );
        })}
      </select>
      {startFromChapter && startFromChapter > 0 && (
        <p className="text-xs text-[var(--ink-blue)] mt-2 flex items-center gap-1">
          <span>-</span>
          {startFromChapter}강 건너뛰고 {startFromChapter + 1}강부터 시작
        </p>
      )}
    </div>
  );
}

/**
 * SelectedCoursesList 메인 컴포넌트
 * 선택된 강좌가 없으면 아무것도 렌더링하지 않음
 */
export function SelectedCoursesList({
  selectedCourses,
  onDeselect,
  onUpdateStartChapter,
}: SelectedCoursesListProps) {
  if (selectedCourses.length === 0) {
    return null;
  }

  return (
    <div className="notebook-card p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-5 h-5 bg-[var(--ink-blue)] text-white rounded-full flex items-center justify-center text-xs">
          {selectedCourses.length}
        </span>
        선택한 강좌
      </h3>
      <div className="space-y-3">
        {selectedCourses.map((course) => (
          <SelectedCourseCard
            key={course.id}
            course={course}
            onDeselect={() => onDeselect(course.id)}
            onUpdateStartChapter={(idx) => onUpdateStartChapter(course.id, idx)}
          />
        ))}
      </div>
    </div>
  );
}
