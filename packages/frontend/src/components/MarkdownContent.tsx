/**
 * MarkdownContent
 * 채팅 메시지용 마크다운 렌더러
 * - 제목, 굵은 글씨, 리스트 등 지원
 * - 노트북 스타일에 맞는 커스텀 스타일링
 */

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownContentProps {
  content: string;
}

// 커스텀 컴포넌트 스타일링
const components: Components = {
  // 헤딩
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-[var(--ink-black)] mb-2 mt-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-[var(--ink-black)] mb-2 mt-3 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-bold text-[var(--ink-black)] mb-1 mt-2 first:mt-0">
      {children}
    </h3>
  ),

  // 단락
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),

  // 굵은 글씨
  strong: ({ children }) => (
    <strong className="font-bold text-[var(--ink-blue)]">{children}</strong>
  ),

  // 기울임
  em: ({ children }) => (
    <em className="italic text-[var(--pencil-gray)]">{children}</em>
  ),

  // 순서 없는 리스트
  ul: ({ children }) => (
    <ul className="list-none ml-0 mb-2 space-y-1">{children}</ul>
  ),

  // 순서 있는 리스트
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 mb-2 space-y-1">{children}</ol>
  ),

  // 리스트 아이템
  li: ({ children }) => (
    <li className="flex items-start gap-2">
      <span className="text-[var(--ink-blue)] mt-0.5">•</span>
      <span className="flex-1">{children}</span>
    </li>
  ),

  // 코드 (인라인)
  code: ({ children, className }) => {
    // 블록 코드인지 확인
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-[var(--paper-cream)] border border-[var(--paper-lines)] rounded-lg p-3 text-sm font-mono overflow-x-auto my-2">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[var(--highlight-yellow)] px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },

  // 코드 블록
  pre: ({ children }) => (
    <pre className="bg-[var(--paper-cream)] border border-[var(--paper-lines)] rounded-lg p-3 text-sm font-mono overflow-x-auto my-2">
      {children}
    </pre>
  ),

  // 링크
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--ink-blue)] underline hover:opacity-80"
    >
      {children}
    </a>
  ),

  // 인용
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[var(--ink-blue)] pl-3 py-1 my-2 bg-[var(--highlight-blue)] bg-opacity-30 rounded-r">
      {children}
    </blockquote>
  ),

  // 수평선
  hr: () => (
    <hr className="border-t-2 border-dashed border-[var(--paper-lines)] my-3" />
  ),
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
