/**
 * useStreamingChat
 * SSE 기반 스트리밍 채팅 훅
 * - 실시간 응답 표시 (타이핑 효과)
 * - 완료 후 메시지 저장
 */

import { useState, useCallback, useRef } from 'react';
import { useChatStore, type MessageAction } from '../stores/chatStore';
import { API_BASE_URL } from '../config';

interface QuestContext {
  todayQuests: Array<{
    unitTitle: string;
    range: string;
    completed: boolean;
    estimatedMinutes: number;
    planName: string;
    planId?: string;
    day?: number;
  }>;
  activePlans?: Array<{
    id: string;
    title: string;
    totalDays: number;
    completedDays: number;
    startDate: string;
    targetEndDate: string;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    dailyQuests?: Array<{
      day: number;
      date: string;
      unitTitle: string;
      range: string;
      completed: boolean;
      estimatedMinutes?: number;
    }>;
  }>;
  weeklyStats?: {
    totalQuests: number;
    completedQuests: number;
    completionRate: number;
    streakDays: number;
    averageMinutesPerDay: number;
  };
  plansCount: number;
  completedToday: number;
  totalToday: number;
}

// 학습 프로필 (온보딩에서 수집한 정보)
interface UserProfile {
  age: number | null;
  examYear: number;
  targetUniversity: string;
  targetGrades: Record<string, number>;
  currentGrades: Record<string, number>;
  selectedTamgu1: string;
  selectedTamgu2: string;
  subscribedPlatforms: string[];
  dailyStudyHours: number;
}

export function useStreamingChat(roomId: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingAgentRole, setStreamingAgentRole] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    addMessage,
    markRoomAsRead,
    addNotification,
  } = useChatStore();

  const sendMessageStream = useCallback(
    async (message: string, questContext?: QuestContext, userProfile?: UserProfile) => {
      if (!message.trim()) return;

      // 세션 ID 가져오기/생성
      let sessionId = localStorage.getItem('questybook_session_id');
      if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem('questybook_session_id', sessionId);
      }

      const userName = localStorage.getItem('questybook_user_name') || '학생';

      // 사용자 메시지 추가 (async)
      await addMessage(roomId, {
        role: 'user',
        content: message,
      });

      // 스트리밍 상태 초기화
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingAgentRole(null);

      // AbortController 생성
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // conversationId 가져오기/생성
        let conversationId = localStorage.getItem(`questybook_conv_${roomId}`);
        if (!conversationId) {
          conversationId = `conv-${roomId}-${Date.now()}`;
          localStorage.setItem(`questybook_conv_${roomId}`, conversationId);
        }

        const response = await fetch(`${API_BASE_URL}/api/coach/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: sessionId,
            message,
            userName,
            questContext,
            userProfile,  // 학습 프로필 추가 (목표 대학, 목표 등급 등)
            conversationId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // SSE 파싱
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let agentRole = 'COACH';
        let actions: MessageAction[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = 'chunk';

          for (const line of lines) {
            const trimmed = line.trim();

            // 이벤트 타입 파싱
            if (trimmed.startsWith('event: ')) {
              currentEvent = trimmed.slice(7);
              continue;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.slice(6);
                const data = JSON.parse(jsonStr);

                // 오류 이벤트 처리
                if (currentEvent === 'error' || data.error) {
                  console.error('Stream error from server:', data.error);
                  throw new Error(data.error || '서버 오류');
                }

                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }

                if (data.agentRole) {
                  agentRole = data.agentRole;
                  setStreamingAgentRole(agentRole);
                }

                if (data.studentId) {
                  localStorage.setItem('questybook_session_id', data.studentId);
                }

                // done 이벤트에서 actions 캡처
                if (currentEvent === 'done' && data.actions) {
                  actions = data.actions;
                }
              } catch (parseError) {
                // 오류 이벤트 처리 중 throw된 경우 상위로 전파
                if ((parseError as Error).message !== '서버 오류') {
                  // JSON 파싱 실패는 무시
                } else {
                  throw parseError;
                }
              }
            }
          }
        }

        // 스트리밍 완료 - 메시지로 저장 (async)
        const finalContent = fullContent || '죄송해요, 응답을 생성하지 못했어요. 다시 시도해주세요.';

        await addMessage(roomId, {
          role: 'assistant',
          content: finalContent,
          agentRole,
          actions: actions.length > 0 ? actions : undefined,
        });

        // 현재 보고 있는 채팅방이면 읽음 처리 (async)
        const currentPath = window.location.pathname;
        const isInCurrentRoom =
          currentPath === `/chat/${roomId}` ||
          (currentPath === '/chat' && roomId === 'ai-coach-default');

        if (isInCurrentRoom) {
          await markRoomAsRead(roomId);
        } else if (fullContent) {
          addNotification({
            roomId,
            type: 'message',
            title: 'AI 코치의 답변',
            message: fullContent.slice(0, 50) + (fullContent.length > 50 ? '...' : ''),
          });
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('Streaming was cancelled');
          return;
        }

        console.error('Streaming chat error:', error);

        // 오류 시 폴백 메시지 (async)
        await addMessage(roomId, {
          role: 'assistant',
          content: '죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요.',
          agentRole: 'COACH',
        });
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingAgentRole(null);
        abortControllerRef.current = null;
      }
    },
    [roomId, addMessage, markRoomAsRead, addNotification]
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingAgentRole(null);
    }
  }, []);

  return {
    sendMessageStream,
    cancelStream,
    isStreaming,
    streamingContent,
    streamingAgentRole,
  };
}
