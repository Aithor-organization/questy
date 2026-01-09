/**
 * ChatRoomPage
 * 개별 채팅방 화면 - 카카오톡 스타일
 * - 특정 채팅방의 메시지 표시
 * - AI 응답은 백그라운드에서 계속 진행
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  const initRef = useRef(false);
  const prevRoomIdRef = useRef(targetRoomId);
  const isFirstScrollRef = useRef(true); // 첫 스크롤 여부 추적

  // roomId 변경 시 초기화 상태 리셋
  useEffect(() => {
    if (prevRoomIdRef.current !== targetRoomId) {
      initRef.current = false;
      isFirstScrollRef.current = true; // 방 변경 시 첫 스크롤 플래그 리셋
      setIsInitialized(false);
      prevRoomIdRef.current = targetRoomId;
    }
  }, [targetRoomId]);

  // 초기화: 환영 메시지 및 읽음 처리 (최초 1회만)
  useEffect(() => {
    if (initRef.current) return;

    const currentRoom = getRoomById(targetRoomId) || getDefaultRoom();
    if (!currentRoom) return;

    initRef.current = true;

    // 페이지 진입 시 읽음 처리
    markRoomAsRead(targetRoomId);

    // 기본 채팅방이고 메시지가 없으면 환영 메시지
    if (currentRoom.isDefault && currentRoom.messages.length === 0) {
      addMessage(targetRoomId, {
        role: 'assistant',
        content: `안녕하세요! 저는 AI 학습 코치예요! 🌟\n\n무엇을 도와드릴까요? 학습 질문, 계획 상담, 아니면 그냥 수다도 좋아요! 😊`,
        agentRole: 'COACH',
      });
    }

    setIsInitialized(true);
  }, [targetRoomId, getRoomById, getDefaultRoom, addMessage, markRoomAsRead]);

  // 첫 진입 시 스크롤: useLayoutEffect로 paint 전에 실행
  useLayoutEffect(() => {
    if (isFirstScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
      isFirstScrollRef.current = false;
    }
  }, [room?.messages]);

  // 이후 메시지 추가 시: 부드럽게 스크롤
  useEffect(() => {
    if (!isFirstScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room?.messages.length]);

  // 포커스 시 읽음 처리
  useEffect(() => {
    const handleFocus = () => markRoomAsRead(targetRoomId);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [targetRoomId, markRoomAsRead]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // 주간 통계 계산
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 이번주 일요일
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 이번주 토요일

    // 이번 주 퀘스트 수집
    const allQuests = plans.flatMap(p =>
      p.dailyQuests.map(q => ({ ...q, planId: p.id }))
    );
    const weekQuests = allQuests.filter(q => {
      const questDate = new Date(q.date);
      return questDate >= weekStart && questDate <= weekEnd;
    });
    const completedWeekQuests = weekQuests.filter(q => q.completed);

    // 연속 학습일 계산 (간단 버전)
    let streakDays = 0;
    const checkDate = new Date(today);
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayQuests = allQuests.filter(q => q.date === dateStr);
      if (dayQuests.length > 0 && dayQuests.every(q => q.completed)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dayQuests.length > 0) {
        break;
      } else {
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // 퀘스트 컨텍스트 구성 (activePlans 포함)
    const questContext = {
      todayQuests: todayQuests.map(q => ({
        unitTitle: q.unitTitle,
        range: q.range,
        completed: q.completed ?? false,
        estimatedMinutes: q.estimatedMinutes,
        planName: q.planName,
        planId: q.planId,
        day: q.day,
      })),
      // 전체 일정 정보 추가 (학습설계사 일정 조회용)
      activePlans: plans.map(p => ({
        id: p.id,
        title: p.materialName,
        totalDays: p.summary.totalDays,
        completedDays: p.dailyQuests.filter(q => q.completed).length,
        startDate: p.dailyQuests[0]?.date ?? p.createdAt.split('T')[0],
        targetEndDate: p.dailyQuests[p.dailyQuests.length - 1]?.date ?? p.createdAt.split('T')[0],
        status: 'ACTIVE' as const,
        dailyQuests: p.dailyQuests.map(q => ({
          day: q.day,
          date: q.date,
          unitTitle: q.unitTitle,
          range: q.range,
          completed: q.completed ?? false,
          estimatedMinutes: q.estimatedMinutes,
        })),
      })),
      // 주간 통계
      weeklyStats: {
        totalQuests: weekQuests.length,
        completedQuests: completedWeekQuests.length,
        completionRate: weekQuests.length > 0
          ? Math.round((completedWeekQuests.length / weekQuests.length) * 100)
          : 0,
        streakDays,
        averageMinutesPerDay: plans.length > 0
          ? Math.round(plans.reduce((sum, p) => sum + p.summary.averageMinutesPerDay, 0) / plans.length)
          : 0,
      },
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
