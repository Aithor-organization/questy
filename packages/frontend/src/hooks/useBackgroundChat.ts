/**
 * useBackgroundChat
 * 백그라운드 AI 응답 생성 훅
 * - 채팅방을 나가도 응답 생성 계속
 * - 응답 완료 시 알림 + 읽지 않은 메시지로 표시
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';
import { API_BASE_URL } from '../config';

interface QuestContext {
  todayQuests: Array<{
    unitTitle: string;
    range: string;
    completed: boolean;
    estimatedMinutes: number;
    planName: string;
  }>;
  plansCount: number;
  completedToday: number;
  totalToday: number;
}

// 전역 응답 큐 (여러 훅 인스턴스에서 공유)
const pendingRequests = new Map<string, AbortController>();

export function useBackgroundChat(roomId: string) {
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    addMessage,
    addPendingResponse,
    updatePendingResponse,
    removePendingResponse,
    addNotification,
    markRoomAsRead,
  } = useChatStore();

  // 컴포넌트 언마운트 시에도 요청은 계속 진행
  useEffect(() => {
    return () => {
      // 언마운트 시 abort하지 않음 - 백그라운드 계속 진행
      abortControllerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(
    async (message: string, questContext?: QuestContext) => {
      if (!message.trim()) return;

      // 세션 ID 가져오기/생성
      let sessionId = localStorage.getItem('questybook_session_id');
      if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem('questybook_session_id', sessionId);
      }

      const userName = localStorage.getItem('questybook_user_name') || '학생';

      // 사용자 메시지 추가
      const userMessageId = addMessage(roomId, {
        role: 'user',
        content: message,
      });

      // 대기 응답 등록
      addPendingResponse(roomId, userMessageId);
      setIsTyping(true);

      // AbortController 생성
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      pendingRequests.set(userMessageId, abortController);

      try {
        updatePendingResponse(userMessageId, 'processing');

        const response = await fetch(`${API_BASE_URL}/api/coach/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: sessionId,
            message,
            userName,
            questContext,
          }),
          signal: abortController.signal,
        });

        const data = await response.json();

        if (data.success) {
          // 세션 ID 업데이트
          if (data.data.studentId && data.data.studentId !== sessionId) {
            localStorage.setItem('questybook_session_id', data.data.studentId);
          }

          // AI 응답 메시지 추가 (읽지 않은 상태로)
          addMessage(roomId, {
            role: 'assistant',
            content: data.data.message,
            agentRole: data.data.agentRole,
            rescheduleOptions: data.data.rescheduleOptions || undefined,
          });

          // 현재 보고 있는 채팅방이면 읽음 처리
          const currentPath = window.location.pathname;
          if (currentPath === `/chat/${roomId}`) {
            markRoomAsRead(roomId);
          } else {
            // 다른 곳에 있으면 알림 표시
            addNotification({
              roomId,
              type: 'message',
              title: 'AI 코치의 답변',
              message: data.data.message.slice(0, 50) + (data.data.message.length > 50 ? '...' : ''),
            });
          }

          updatePendingResponse(userMessageId, 'completed');
        } else {
          // 실패 응답
          addMessage(roomId, {
            role: 'assistant',
            content: '죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요.',
            agentRole: 'COACH',
          });
          updatePendingResponse(userMessageId, 'failed');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // 사용자가 취소한 경우
          console.log('Request was cancelled');
          return;
        }

        console.error('Chat error:', error);

        // 오프라인 폴백 응답
        const fallbackResponse = generateOfflineResponse(message);
        addMessage(roomId, {
          role: 'assistant',
          content: fallbackResponse,
          agentRole: 'COACH',
        });

        // 알림 (다른 화면에 있을 때)
        const currentPath = window.location.pathname;
        if (currentPath !== `/chat/${roomId}`) {
          addNotification({
            roomId,
            type: 'message',
            title: 'AI 코치의 답변',
            message: fallbackResponse.slice(0, 50) + '...',
          });
        }

        updatePendingResponse(userMessageId, 'failed');
      } finally {
        setIsTyping(false);
        removePendingResponse(userMessageId);
        pendingRequests.delete(userMessageId);
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [roomId, addMessage, addPendingResponse, updatePendingResponse, removePendingResponse, addNotification, markRoomAsRead]
  );

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsTyping(false);
    }
  }, []);

  return {
    sendMessage,
    cancelRequest,
    isTyping,
  };
}

// 오프라인 폴백 응답 생성
function generateOfflineResponse(message: string): string {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('힘들') || lowerMsg.includes('포기') || lowerMsg.includes('못하겠')) {
    return `지금 많이 힘드시죠? 😢\n\n완전히 이해해요. 공부가 항상 쉽지만은 않으니까요. 하지만 잠깐 멈춰도 괜찮아요.\n\n오늘은 가볍게 10분만 해보는 건 어떨까요? 💪`;
  }

  if (lowerMsg.includes('진도') || lowerMsg.includes('분석')) {
    return `학습 현황을 확인했어요! 📊\n\n꾸준히 잘 하고 계시네요. 조금씩이라도 매일 하는 게 중요해요!\n\n더 자세한 분석은 '리포트' 메뉴에서 확인할 수 있어요.`;
  }

  if (lowerMsg.includes('계획') || lowerMsg.includes('플랜')) {
    return `학습 계획을 세워볼까요? 📋\n\n새 플랜 메뉴에서 교재 목차를 업로드하면 AI가 맞춤 계획을 만들어드려요!\n\n원하시면 바로 안내해드릴게요. ✨`;
  }

  return `좋은 질문이에요! 📚\n\n무엇이든 함께 해결해봐요. 구체적으로 어떤 부분이 궁금하신가요? 😊`;
}
