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
  return (
    <div className={`notebook-page relative ${className}`}>
      {/* 스프링 홀 장식 */}
      {decoration === 'holes' && (
        <div className="notebook-holes hidden sm:flex">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="notebook-hole" />
          ))}
        </div>
      )}

      {/* 와시 테이프 장식 */}
      {decoration === 'tape' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-6 washi-tape" />
      )}

      {/* 콘텐츠 영역 */}
      <div className={`p-6 ${decoration === 'holes' ? 'pl-16 sm:pl-20' : ''}`}>
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
