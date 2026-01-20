/**
 * ErrorBoundary Component
 * React 렌더링 에러를 잡아서 fallback UI를 표시
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 렌더링 에러 발생:', error);
    console.error('[ErrorBoundary] 컴포넌트 스택:', errorInfo.componentStack);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 max-w-md mx-auto">
          <div className="notebook-page p-6 text-center">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="handwrite text-xl text-[var(--ink-black)] mb-3">
              앗, 문제가 발생했어요
            </h2>
            <p className="text-sm text-[var(--pencil-gray)] mb-4">
              화면을 표시하는 중 오류가 발생했습니다.
              <br />
              다시 시도해 주세요.
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-[var(--pencil-gray)] cursor-pointer hover:underline">
                  오류 상세 정보
                </summary>
                <pre className="mt-2 p-2 bg-[var(--paper-cream)] rounded text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-[var(--ink-blue)] text-white rounded-lg text-sm hover:bg-opacity-90 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 퀘스트 생성 전용 에러 Fallback UI
 */
export function QuestGenerationErrorFallback({
  error,
  onRetry,
  onReset,
}: {
  error?: Error | string | null;
  onRetry?: () => void;
  onReset?: () => void;
}) {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className="notebook-page p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">📚❌</div>
        <h2 className="handwrite text-2xl text-[var(--ink-black)] mb-3">
          퀘스트 생성에 실패했어요
        </h2>
        <p className="text-sm text-[var(--pencil-gray)] mb-4">
          AI가 학습 계획을 만드는 중 문제가 발생했습니다.
          <br />
          다시 시도하거나 다른 이미지로 시도해 주세요.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-[var(--highlight-pink)] rounded-lg text-left">
            <p className="text-xs text-[var(--pencil-gray)] mb-1">오류 내용:</p>
            <p className="text-sm text-[var(--ink-black)]">{errorMessage}</p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-[var(--ink-blue)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors"
            >
              🔄 다시 생성하기
            </button>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="px-6 py-3 border border-[var(--paper-lines)] rounded-lg text-sm text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)] transition-colors"
            >
              처음부터 다시
            </button>
          )}
        </div>

        <div className="mt-6 p-4 bg-[var(--paper-cream)] rounded-lg">
          <p className="text-xs text-[var(--pencil-gray)]">
            💡 <strong>팁:</strong> 목차나 학습계획표가 잘 보이는 페이지를 선택하면
            더 정확한 퀘스트가 생성됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
