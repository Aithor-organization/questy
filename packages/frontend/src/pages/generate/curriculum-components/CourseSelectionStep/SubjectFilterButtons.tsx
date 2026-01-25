/**
 * SubjectFilterButtons
 * 과목 필터링 버튼 컴포넌트들
 */

/**
 * 과목 필터 버튼 Props
 */
interface SubjectButtonProps {
  subject: string;
  isSelected: boolean;
  onClick: () => void;
  variant?: 'default' | 'science' | 'social';
}

/**
 * 과목 필터 버튼
 * 메인 과목 및 탐구 세부 과목에 사용
 */
export function SubjectButton({
  subject,
  isSelected,
  onClick,
  variant = 'default',
}: SubjectButtonProps) {
  const baseClass = 'px-3 py-1 text-sm rounded-full transition-colors';
  const variantClasses = {
    default: isSelected
      ? 'bg-[var(--ink-blue)] text-white'
      : 'bg-[var(--highlight-yellow)] hover:bg-yellow-200',
    science: isSelected
      ? 'bg-[var(--ink-blue)] text-white'
      : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200',
    social: isSelected
      ? 'bg-[var(--ink-blue)] text-white'
      : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200',
  };

  return (
    <button onClick={onClick} className={`${baseClass} ${variantClasses[variant]}`}>
      {subject}
    </button>
  );
}

/**
 * 탐구 카테고리 버튼 Props
 */
interface TamguCategoryButtonProps {
  category: '과탐' | '사탐';
  isExpanded: boolean;
  hasSelectedSubject: boolean;
  onClick: () => void;
}

/**
 * 탐구 카테고리 버튼 (과탐/사탐)
 * 클릭 시 세부 과목 목록을 펼침/접음
 */
export function TamguCategoryButton({
  category,
  isExpanded,
  hasSelectedSubject,
  onClick,
}: TamguCategoryButtonProps) {
  const isScience = category === '과탐';
  const baseClass = 'px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1';
  const activeClass = 'bg-[var(--ink-blue)] text-white';
  const inactiveClass = isScience
    ? 'bg-green-100 hover:bg-green-200 text-green-700'
    : 'bg-orange-100 hover:bg-orange-200 text-orange-700';

  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${isExpanded || hasSelectedSubject ? activeClass : inactiveClass}`}
    >
      {category}
      <svg
        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
