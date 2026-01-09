/**
 * ChatRoomPage
 * 개별 채팅방 화면 - 카카오톡 스타일
 * - 특정 채팅방의 메시지 표시
 * - AI 응답은 백그라운드에서 계속 진행
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotebookLayout } from '../../components/notebook/NotebookLayout';
import { useChatStore, DEFAULT_ROOM_ID } from '../../stores/chatStore';
import { useQuestStore, getTodayDateString } from '../../stores/questStore';
import { useBackgroundChat } from '../../hooks/useBackgroundChat';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { QuickActions } from './components/QuickActions';
import { ChatHeader } from './components/ChatHeader';

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    getRoomById,
    getDefaultRoom,
    addMessage,
    markRoomAsRead,
    getPendingResponseForRoom,
  } = useChatStore();

  // roomId가 없으면 기본 채팅방으로
  const targetRoomId = roomId || DEFAULT_ROOM_ID;
  const room = getRoomById(targetRoomId) || getDefaultRoom();
  const pendingResponse = getPendingResponseForRoom(targetRoomId);

  // 백그라운드 채팅 훅 사용
  const { sendMessage: sendBackgroundMessage, isTyping } = useBackgroundChat(targetRoomId);

  // Quest store에서 퀘스트 정보 가져오기
  const { plans, getQuestsByDate } = useQuestStore();
  const todayQuests = getQuestsByDate(getTodayDateString());

  const [inputValue, setInputValue] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // 초기화: 환영 메시지 및 읽음 처리
  useEffect(() => {
    if (!room) return;

    // 페이지 진입 시 읽음 처리
    markRoomAsRead(targetRoomId);

    // 기본 채팅방이고 메시지가 없으면 환영 메시지
    if (room.isDefault && room.messages.length === 0) {
      addMessage(targetRoomId, {
        role: 'assistant',
        content: `안녕하세요! 저는 AI 학습 코치예요! 🌟\n\n무엇을 도와드릴까요? 학습 질문, 계획 상담, 아니면 그냥 수다도 좋아요! 😊`,
        agentRole: 'COACH',
      });
    }

    setIsInitialized(true);
  }, [room, targetRoomId, addMessage, markRoomAsRead]);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages]);

  // 포커스 시 읽음 처리
  useEffect(() => {
    const handleFocus = () => markRoomAsRead(targetRoomId);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [targetRoomId, markRoomAsRead]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // 퀘스트 컨텍스트 구성
    const questContext = {
      todayQuests: todayQuests.map(q => ({
        unitTitle: q.unitTitle,
        range: q.range,
        completed: q.completed ?? false,
        estimatedMinutes: q.estimatedMinutes,
        planName: q.planName,
      })),
      plansCount: plans.length,
      completedToday: todayQuests.filter(q => q.completed).length,
      totalToday: todayQuests.length,
    };

    // 백그라운드로 메시지 전송 (화면 이동해도 응답 계속 생성)
    await sendBackgroundMessage(message, questContext);
    setInputValue('');
  };

  const handleQuickAction = (label: string) => {
    handleSendMessage(label);
  };

  const handleBack = () => {
    navigate('/chat');
  };

  if (!room || !isInitialized) {
    return (
      <NotebookLayout>
        <div className="notebook-page-chat flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="text-[var(--pencil-gray)]">로딩 중...</div>
        </div>
      </NotebookLayout>
    );
  }

  return (
    <NotebookLayout>
      <div className="notebook-page-chat p-0 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
        {/* 채팅 헤더 */}
        <ChatHeader
          room={room}
          onBack={handleBack}
          onNavigate={navigate}
        />

        {/* 메시지 영역 */}
        <MessageList
          messages={room.messages}
          isTyping={isTyping || pendingResponse?.status === 'processing'}
          roomId={targetRoomId}
          messagesEndRef={messagesEndRef}
        />

        {/* 빠른 액션 (기본 채팅방만) */}
        {room.isDefault && (
          <QuickActions onAction={handleQuickAction} />
        )}

        {/* 입력 영역 */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          disabled={isTyping}
        />
      </div>
    </NotebookLayout>
  );
}
