/**
 * ValidationErrorModal
 * 커리큘럼 검증 실패 시 표시되는 모달
 */

import type { ValidationResult } from '../../../types/curriculum';

interface ValidationErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: ValidationResult | null;
}

export function ValidationErrorModal({ isOpen, onClose, validation }: ValidationErrorModalProps) {
  if (!isOpen || !validation) return null;

  const { issues, suggestions } = validation;
  const errors = issues.filter(i => i.severity === 'invalid');
  const warnings = issues.filter(i => i.severity === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 내용 */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <ModalHeader />
        <ModalBody errors={errors} warnings={warnings} suggestions={suggestions} />
        <ModalFooter onClose={onClose} />
      </div>
    </div>
  );
}

function ModalHeader() {
  return (
    <div className="sticky top-0 bg-red-50 border-b border-red-100 px-6 py-4 rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-red-800">커리큘럼 생성 불가</h2>
          <p className="text-sm text-red-600">일정을 조정해주세요</p>
        </div>
      </div>
    </div>
  );
}

function ModalBody({
  errors,
  warnings,
  suggestions,
}: {
  errors: ValidationResult['issues'];
  warnings: ValidationResult['issues'];
  suggestions: string[];
}) {
  return (
    <div className="px-6 py-4 space-y-4">
      {/* 에러 (INVALID) */}
      {errors.length > 0 && (
        <IssueSection
          title="불가능한 일정"
          icon="🚫"
          count={errors.length}
          items={errors}
          bgColor="bg-red-50"
          borderColor="border-red-200"
          textColor="text-red-800"
          titleColor="text-red-700"
          detailColor="text-red-600"
        />
      )}

      {/* 경고 (WARNING) */}
      {warnings.length > 0 && (
        <IssueSection
          title="주의사항"
          icon="⚡"
          count={warnings.length}
          items={warnings}
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
          textColor="text-amber-800"
          titleColor="text-amber-700"
          detailColor="text-amber-600"
        />
      )}

      {/* 제안사항 */}
      {suggestions.length > 0 && (
        <SuggestionsSection suggestions={suggestions} />
      )}
    </div>
  );
}

function IssueSection({
  title,
  icon,
  count,
  items,
  bgColor,
  borderColor,
  textColor,
  titleColor,
  detailColor,
}: {
  title: string;
  icon: string;
  count: number;
  items: ValidationResult['issues'];
  bgColor: string;
  borderColor: string;
  textColor: string;
  titleColor: string;
  detailColor: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className={`text-sm font-semibold ${titleColor} flex items-center gap-1`}>
        <span>{icon}</span> {title} ({count}개)
      </h3>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className={`${bgColor} border ${borderColor} rounded-lg p-3`}>
            <p className={`text-sm ${textColor}`}>{item.message}</p>
            {item.details && (
              <div className={`mt-1 text-xs ${detailColor}`}>
                {item.details.date && <span>날짜: {item.details.date} | </span>}
                {item.details.count !== undefined && <span>실제: {item.details.count} | </span>}
                {item.details.expected !== undefined && <span>권장: {item.details.expected} 이하</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionsSection({ suggestions }: { suggestions: string[] }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
        <span>💡</span> 해결 방법
      </h3>
      <ul className="space-y-1">
        {suggestions.map((suggestion, idx) => (
          <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModalFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 rounded-b-2xl">
      <button
        onClick={onClose}
        className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-[var(--ink-blue)]/90 transition-colors"
      >
        설정 다시 조정하기
      </button>
      <p className="text-xs text-gray-500 text-center mt-2">
        목표일을 늘리거나 강좌 수를 줄여주세요
      </p>
    </div>
  );
}
