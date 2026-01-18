/**
 * QuickActions
 * 빠른 액션 버튼 컴포넌트
 */

interface QuickActionsProps {
  onChat: () => void;
  onReport: () => void;
  onCrisis: () => void;
}

export function QuickActions({ onChat, onReport, onCrisis }: QuickActionsProps) {
  return (
    <>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onChat}
          className="flex-1 py-3 bg-[var(--sticker-mint)] text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm"
        >
          💬 코치와 대화
        </button>
        <button
          onClick={onReport}
          className="flex-1 py-3 bg-white border border-[var(--paper-lines)] rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          📊 학습 리포트
        </button>
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={onCrisis}
          className="text-[var(--pencil-gray)] text-sm hover:text-[var(--ink-blue)]"
        >
          😔 공부가 너무 힘들어요...
        </button>
      </div>
    </>
  );
}
