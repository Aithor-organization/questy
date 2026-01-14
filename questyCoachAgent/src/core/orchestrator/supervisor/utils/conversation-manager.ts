/**
 * 대화 기록 관리 유틸리티
 */

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * 대화 기록 관리자
 */
export class ConversationManager {
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();
  private readonly maxHistoryLength = 50;

  /**
   * 대화 기록 추가
   */
  addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const history = this.conversationHistory.get(conversationId) ?? [];
    history.push({ role, content, timestamp: new Date() });

    // 최대 길이 초과 시 오래된 메시지 제거
    if (history.length > this.maxHistoryLength) {
      history.splice(0, history.length - this.maxHistoryLength);
    }

    this.conversationHistory.set(conversationId, history);
  }

  /**
   * 대화 기록 조회
   */
  getHistory(conversationId: string): ConversationMessage[] {
    return this.conversationHistory.get(conversationId) ?? [];
  }

  /**
   * 대화 기록 삭제
   */
  clearHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
  }
}
