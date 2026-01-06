/**
 * NotebookPage
 * 노트북 페이지 스타일 컨테이너
 */

import type { ReactNode } from 'react';

interface NotebookPageProps {
  children: ReactNode;
  title?: string;
  decoration?: 'holes' | 'tape' | 'none';
  className?: string;
}

export function NotebookPage({
  children,
  title,
  decoration = 'holes',
  className = '',
}: NotebookPageProps) {
  // decoration='holes'면 빨간 마진선 + 펀치홀 자동 표시
  const pageClass = decoration === 'holes' ? 'notebook-page-lined' : 'notebook-page';

  return (
    <div className={`${pageClass} relative ${className}`}>
      {/* 와시 테이프 장식 */}
      {decoration === 'tape' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-6 washi-tape" />
      )}

      {/* 콘텐츠 영역 - notebook-page-lined는 CSS에서 자동 패딩 처리 */}
      <div className={`p-6 ${decoration === 'holes' ? '' : ''}`}>
        {title && (
          <h2 className="handwrite handwrite-xl text-[var(--ink-black)] mb-4 border-b-2 border-[var(--ink-blue)] pb-2">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
