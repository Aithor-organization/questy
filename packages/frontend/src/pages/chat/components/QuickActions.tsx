/**
 * QuickActions
 * 빠른 액션 버튼 컴포넌트
 */

const QUICK_ACTIONS = [
  { id: 'today', label: '오늘 뭐 공부해?', emoji: '📚' },
  { id: 'progress', label: '내 진도 어때?', emoji: '📊' },
  { id: 'help', label: '공부법 추천해줘', emoji: '💡' },
  { id: 'tired', label: '오늘 좀 힘들어', emoji: '😢' },
];

interface QuickActionsProps {
  onAction: (label: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2 bg-white border-t border-[var(--paper-lines)]">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.label)}
            className="flex-shrink-0 px-3 py-1.5 bg-[var(--paper-cream)] rounded-full text-sm border border-[var(--paper-lines)] hover:bg-[var(--highlight-yellow)] transition-colors"
          >
            {action.emoji} {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
