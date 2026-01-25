/**
 * FeasibilityError
 * 일정 생성 불가능 오류를 표시하는 컴포넌트
 */

import type { FeasibilityErrorProps } from './types';

/**
 * FeasibilityError 컴포넌트
 * 실행 가능성 검증 실패 시 오류 메시지를 표시
 */
export function FeasibilityError({ error, onClear }: FeasibilityErrorProps) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2">
          <span className="text-red-500 text-lg" role="img" aria-label="경고">
            !
          </span>
          <div>
            <p className="font-medium text-red-700">일정 생성이 불가능합니다</p>
            <p className="text-sm text-red-600 mt-1 whitespace-pre-line">{error}</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-red-400 hover:text-red-600"
          aria-label="오류 닫기"
        >
          x
        </button>
      </div>
    </div>
  );
}
