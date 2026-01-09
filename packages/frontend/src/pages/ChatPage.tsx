/**
 * ChatPage
 * 하위 호환성용 - 기본 채팅방으로 리다이렉트
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_ROOM_ID } from '../stores/chatStore';

export function ChatPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 기본 AI 코치 채팅방으로 리다이렉트
    navigate(`/chat/${DEFAULT_ROOM_ID}`, { replace: true });
  }, [navigate]);

  return null;
}
