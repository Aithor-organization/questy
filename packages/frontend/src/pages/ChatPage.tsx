/**
 * ChatPage
 * 코치와 대화하기 - 카카오톡 스타일 채팅 UI
 * - 학생 등록 없이 바로 사용 가능
 * - 메시지 영구 저장 (탭 이동/앱 재시작 후에도 유지)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout } from '../components/notebook/NotebookLayout';
import { useChatStore } from '../stores/chatStore';

const QUICK_ACTIONS = [
  { id: 'today', label: '오늘 뭐 공부해?', emoji: '📚' },
  { id: 'progress', label: '내 진도 어때?', emoji: '📊' },
  { id: 'help', label: '공부법 추천해줘', emoji: '💡' },
  { id: 'tired', label: '오늘 좀 힘들어', emoji: '😢' },
];

export function ChatPage() {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Zustand store 사용 (영구 저장)
  const {
    messages,
    addMessage,
    markAllAsRead,
  } = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('학생');
  const [isInitialized, setIsInitialized] = useState(false);

  // 초기화
  useEffect(() => {
    // 저장된 세션 ID와 이름 불러오기 (또는 새로 생성)
    let storedSessionId = localStorage.getItem('questybook_session_id');
    const storedName = localStorage.getItem('questybook_user_name');

    if (!storedSessionId) {
      storedSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem('questybook_session_id', storedSessionId);
    }

    setSessionId(storedSessionId);
    setUserName(storedName || '학생');

    // 페이지 진입 시 모든 메시지 읽음 처리
    markAllAsRead();

    // 메시지가 없으면 환영 메시지 추가
    if (messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: `안녕하세요! 저는 AI 학습 코치예요! 🌟\n\n무엇을 도와드릴까요? 학습 질문, 계획 상담, 아니면 그냥 수다도 좋아요! 😊`,
        agentRole: 'COACH',
      });
    }

    setIsInitialized(true);
  }, [messages.length, addMessage, markAllAsRead]);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 페이지 포커스 시 읽음 처리
  useEffect(() => {
    const handleFocus = () => {
      markAllAsRead();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [markAllAsRead]);

  const addAssistantMessage = (content: string, agentRole: string = 'COACH') => {
    addMessage({
      role: 'assistant',
      content,
      agentRole,
    });
    // 현재 페이지에 있으면 바로 읽음 처리
    markAllAsRead();
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    // 사용자 메시지 추가
    addMessage({
      role: 'user',
      content: message,
    });

    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:3001/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: sessionId,  // studentId로 전송 (없으면 서버에서 자동 생성)
          message,
          userName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // studentId 업데이트 (서버에서 자동 생성된 경우)
        if (data.data.studentId && data.data.studentId !== sessionId) {
          setSessionId(data.data.studentId);
          localStorage.setItem('questybook_session_id', data.data.studentId);
        }
        addAssistantMessage(data.data.message, data.data.agentRole);
      } else {
        addAssistantMessage('죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요.', 'COACH');
      }
    } catch (error) {
      console.error('Chat error:', error);
      // 오프라인 폴백
      addAssistantMessage(
        generateOfflineResponse(message),
        'COACH'
      );
    } finally {
      setIsTyping(false);
    }
  };

  const generateOfflineResponse = (message: string): string => {
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const message = inputValue.trim();
    setInputValue('');
    sendMessage(message);
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    sendMessage(action.label);
  };

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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isInitialized) {
    return (
      <NotebookLayout>
        <div className="notebook-page flex items-center justify-center" style={{ minHeight: '75vh' }}>
          <div className="text-[var(--pencil-gray)]">로딩 중...</div>
        </div>
      </NotebookLayout>
    );
  }

  return (
    <NotebookLayout>
      <div className="notebook-page p-0 overflow-hidden flex flex-col" style={{ minHeight: '75vh' }}>
        {/* 채팅 헤더 */}
        <div className="bg-[var(--sticker-mint)] px-4 py-3 border-b border-[var(--paper-lines)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">
                🤖
              </div>
              <div>
                <h2 className="font-bold text-white">AI 학습 코치</h2>
                <p className="text-xs text-white/80">언제든 물어보세요!</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/planner')}
                className="px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors"
              >
                📋 플래너
              </button>
              <button
                onClick={() => navigate('/report')}
                className="px-3 py-1 bg-white/20 text-white rounded-full text-sm hover:bg-white/30 transition-colors"
              >
                📊 리포트
              </button>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[var(--paper-cream)]">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className={`w-8 h-8 rounded-full ${getAgentColor(msg.agentRole)} flex items-center justify-center text-sm mr-2 flex-shrink-0`}>
                  {getAgentEmoji(msg.agentRole)}
                </div>
              )}
              <div className="max-w-[75%]">
                {msg.role === 'assistant' && msg.agentRole && (
                  <p className="text-xs text-[var(--pencil-gray)] mb-1 ml-1">
                    {msg.agentRole === 'COACH' && '담임 코치'}
                    {msg.agentRole === 'PLANNER' && '학습 설계사'}
                    {msg.agentRole === 'ANALYST' && '학습 분석가'}
                    {msg.agentRole === 'ADMISSION' && '입학 상담사'}
                  </p>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[var(--highlight-yellow)] text-[var(--ink-black)]'
                      : 'bg-white border border-[var(--paper-lines)] text-[var(--ink-black)]'
                  }`}
                >
                  {msg.content}
                </div>
                <p className="text-xs text-[var(--pencil-gray)] mt-1 ml-1">
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-[var(--sticker-mint)] flex items-center justify-center text-sm mr-2">
                🤖
              </div>
              <div className="bg-white border border-[var(--paper-lines)] rounded-2xl px-4 py-2">
                <span className="animate-pulse">코치가 답변을 준비 중이에요...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 빠른 액션 */}
        <div className="px-4 py-2 bg-white border-t border-[var(--paper-lines)]">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="flex-shrink-0 px-3 py-1.5 bg-[var(--paper-cream)] rounded-full text-sm border border-[var(--paper-lines)] hover:bg-[var(--highlight-yellow)] transition-colors"
              >
                {action.emoji} {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-[var(--paper-lines)] p-4 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="메시지를 입력해주세요..."
              className="flex-1 px-4 py-3 rounded-full border border-[var(--paper-lines)] focus:outline-none focus:border-[var(--ink-blue)] bg-[var(--paper-cream)]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="px-6 py-3 bg-[var(--sticker-mint)] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
            >
              전송
            </button>
          </form>
        </div>
      </div>
    </NotebookLayout>
  );
}
