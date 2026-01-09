/**
 * MessageBubble
 * 개별 메시지 버블 컴포넌트
 * - 마크다운 렌더링 지원
 * - 액션 버튼 지원 (플랜 재설정 등)
 */

import type { ChatMessage } from '../../../stores/chatStore';
import { RescheduleCard } from './RescheduleCard';
import { ActionButtons } from './ActionButtons';
import { MarkdownContent } from '../../../components/MarkdownContent';

interface MessageBubbleProps {
  message: ChatMessage;
  roomId: string;
}

export function MessageBubble({ message, roomId }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const getAgentEmoji = (role?: string) => {
    switch (role) {
      case 'ADMISSION': return '🎓';
      case 'PLANNER': return '📋';
      case 'ANALYST': return '📊';
      case 'COACH':
      default: return '🤖';
    }
  };

  const getAgentColor = (role?: string) => {
    switch (role) {
      case 'ADMISSION': return 'bg-[var(--highlight-yellow)]';
      case 'PLANNER': return 'bg-[var(--highlight-blue)]';
      case 'ANALYST': return 'bg-[var(--highlight-pink)]';
      case 'COACH':
      default: return 'bg-[var(--sticker-mint)]';
    }
  };

  const getAgentLabel = (role?: string) => {
    switch (role) {
      case 'COACH': return '담임 코치';
      case 'PLANNER': return '학습 설계사';
      case 'ANALYST': return '학습 분석가';
      case 'ADMISSION': return '입학 상담사';
      default: return null;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 어시스턴트 아바타 */}
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full ${getAgentColor(message.agentRole)} flex items-center justify-center text-sm mr-2 flex-shrink-0`}
        >
          {getAgentEmoji(message.agentRole)}
        </div>
      )}

      <div className="max-w-[75%]">
        {/* 에이전트 역할 라벨 */}
        {!isUser && message.agentRole && (
          <p className="text-xs text-[var(--pencil-gray)] mb-1 ml-1">
            {getAgentLabel(message.agentRole)}
          </p>
        )}

        {/* 메시지 버블 */}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-[var(--highlight-yellow)] text-[var(--ink-black)] whitespace-pre-wrap'
              : 'bg-white border border-[var(--paper-lines)] text-[var(--ink-black)]'
          }`}
        >
          {/* 사용자 메시지는 일반 텍스트, AI 메시지는 마크다운 렌더링 */}
          {isUser ? (
            message.content
          ) : (
            <MarkdownContent content={message.content} />
          )}

          {/* 액션 버튼 (플랜 재설정 등) */}
          {!isUser && message.actions && message.actions.length > 0 && (
            <ActionButtons actions={message.actions} roomId={roomId} />
          )}

          {/* 일정 재조정 옵션 (백엔드 제공) */}
          {message.rescheduleOptions && message.rescheduleOptions.length > 0 && (
            <div className="mt-4 space-y-3">
              {message.rescheduleOptions.map(option => (
                <RescheduleCard key={option.id} option={option} roomId={roomId} />
              ))}
            </div>
          )}
        </div>

        {/* 타임스탬프 */}
        <p className="text-xs text-[var(--pencil-gray)] mt-1 ml-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
