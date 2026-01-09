/**
 * GenerateButton Component
 * 퀘스트 생성 버튼
 */

interface GenerateButtonProps {
  canGenerate: boolean;
  isLoading: boolean;
  onGenerate: () => void;
}

export function GenerateButton({
  canGenerate,
  isLoading,
  onGenerate,
}: GenerateButtonProps) {
  return (
    <button
      onClick={onGenerate}
      disabled={!canGenerate || isLoading}
      className={`w-full py-4 rounded-lg handwrite text-xl transition-all ${
        !canGenerate
          ? 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
          : 'bg-[var(--ink-blue)] text-white hover:shadow-lg'
      }`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="animate-spin">🔄</span>
          AI가 분석 중...
        </span>
      ) : (
        '🚀 퀘스트 생성하기'
      )}
    </button>
  );
}
