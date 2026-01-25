/**
 * PreviewStates
 * PreviewStep의 상태 표시 컴포넌트들
 * 로딩, 에러, 빈 결과 상태 UI
 */

/**
 * 로딩 상태 UI
 * 퀘스트 생성 중일 때 표시
 */
export function LoadingState() {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4 animate-bounce">✨</div>
      <p className="text-lg font-medium">퀘스트 생성 중...</p>
      <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
    </div>
  );
}

/**
 * 에러/빈 결과 상태 UI
 * 퀘스트 생성 실패 시 표시
 */
export function EmptyState({ error, onBack }: { error?: Error | null; onBack: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">😕</div>
      <p className="text-lg font-medium">퀘스트 생성에 실패했습니다</p>
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-left max-w-md mx-auto">
          <p className="text-sm text-red-600 font-medium mb-1">오류 상세:</p>
          <p className="text-xs text-red-500 break-all">{error.message || String(error)}</p>
        </div>
      )}
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
      >
        다시 시도
      </button>
    </div>
  );
}

/**
 * 일별 커리큘럼 헤더
 * 상세 보기 토글 버튼 포함
 */
export function DailyCurriculumHeader({
  totalDays,
  showDetailedView,
  onToggleView,
}: {
  totalDays: number;
  showDetailedView: boolean;
  onToggleView: () => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <h3 className="text-sm font-medium text-gray-700">📅 일별 커리큘럼</h3>
      <button
        onClick={onToggleView}
        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
      >
        {showDetailedView ? '간략히 보기 ▲' : `전체 보기 (${totalDays}일) ▼`}
      </button>
    </div>
  );
}

/**
 * 하단 액션 버튼들
 * 이전/플래너에 추가 버튼
 */
export function ActionButtons({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        onClick={onBack}
        className="flex-1 py-3 border border-[var(--paper-lines)] rounded-lg font-medium hover:bg-gray-50 transition-colors"
      >
        ← 이전
      </button>
      <button
        onClick={onConfirm}
        className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium hover:bg-[var(--ink-blue)]/90 transition-colors"
      >
        플래너에 추가 📋
      </button>
    </div>
  );
}
