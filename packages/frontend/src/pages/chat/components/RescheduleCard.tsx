/**
 * RescheduleCard
 * 일정 재조정 옵션 카드
 */

import { useState } from 'react';
import { API_BASE_URL } from '../../../config';
import { useChatStore, type RescheduleOption } from '../../../stores/chatStore';

interface RescheduleCardProps {
  option: RescheduleOption;
  roomId: string;
}

export function RescheduleCard({ option, roomId }: RescheduleCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const { addMessage } = useChatStore();

  const handleApply = async () => {
    setIsApplying(true);

    try {
      const sessionId = localStorage.getItem('questybook_session_id');
      const response = await fetch(
        `${API_BASE_URL}/api/coach/students/${sessionId}/reschedule/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId: option.id }),
        }
      );

      const data = await response.json();

      if (data.success) {
        addMessage(roomId, {
          role: 'assistant',
          content: `✅ ${data.message || '일정이 성공적으로 변경되었어요!'}`,
          agentRole: 'PLANNER',
        });
      } else {
        addMessage(roomId, {
          role: 'assistant',
          content: '일정 변경에 실패했어요. 다시 시도해주세요.',
          agentRole: 'COACH',
        });
      }
    } catch (error) {
      console.error('Reschedule apply error:', error);
      addMessage(roomId, {
        role: 'assistant',
        content: '일정 변경 중 오류가 발생했어요.',
        agentRole: 'COACH',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getFeasibilityStyle = () => {
    switch (option.feasibility) {
      case 'HIGH':
        return 'bg-green-100 text-green-700';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      case 'LOW':
        return 'bg-red-100 text-red-700';
    }
  };

  const getFeasibilityLabel = () => {
    switch (option.feasibility) {
      case 'HIGH': return '쉬움';
      case 'MEDIUM': return '보통';
      case 'LOW': return '어려움';
    }
  };

  return (
    <div
      className={`p-3 rounded-xl border-2 ${
        option.isRecommended
          ? 'border-[var(--ink-blue)] bg-[var(--highlight-blue)]'
          : 'border-[var(--paper-lines)] bg-[var(--paper-cream)]'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm">
          {option.planName}
          {option.isRecommended && (
            <span className="ml-2 text-xs bg-[var(--ink-blue)] text-white px-2 py-0.5 rounded-full">
              추천
            </span>
          )}
        </h4>
        <span className={`text-xs px-2 py-0.5 rounded ${getFeasibilityStyle()}`}>
          {getFeasibilityLabel()}
        </span>
      </div>

      <p className="text-sm text-[var(--pencil-gray)] mb-2">{option.description}</p>
      <p className="text-xs text-[var(--ink-blue)] mb-3">📊 {option.impactSummary}</p>

      {option.warningMessage && (
        <p className="text-xs text-orange-600 mb-2">⚠️ {option.warningMessage}</p>
      )}

      <button
        onClick={handleApply}
        disabled={isApplying}
        className="w-full py-2 bg-[var(--ink-blue)] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
      >
        {isApplying ? '적용 중...' : '✓ 적용하기'}
      </button>
    </div>
  );
}
