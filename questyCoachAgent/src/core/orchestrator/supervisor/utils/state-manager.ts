/**
 * 실행 상태 관리 유틸리티
 */

import type { AgentRole } from '../../../../types/agent.js';
import type { ExecutionState } from '../types.js';

/**
 * 실행 상태 관리자
 */
export class ExecutionStateManager {
  private executionStates: Map<string, ExecutionState> = new Map();

  /**
   * 상태 조회 또는 생성
   */
  getOrCreate(conversationId: string, studentId: string): ExecutionState {
    let state = this.executionStates.get(conversationId);

    if (!state) {
      state = {
        conversationId,
        studentId,
        activeAgent: 'COACH',
        executionPath: [],
        turnCount: 0,
      };
      this.executionStates.set(conversationId, state);
    }

    return state;
  }

  /**
   * 상태 조회
   */
  get(conversationId: string): ExecutionState | undefined {
    return this.executionStates.get(conversationId);
  }

  /**
   * 실행 경로에 에이전트 추가
   */
  addToExecutionPath(state: ExecutionState, agent: AgentRole): void {
    state.activeAgent = agent;
    state.executionPath.push({
      agent,
      timestamp: new Date(),
    });
  }

  /**
   * 실행 경로 완료 기록
   */
  completeExecutionPath(state: ExecutionState): void {
    const lastPath = state.executionPath[state.executionPath.length - 1];
    if (lastPath) {
      lastPath.duration = Date.now() - lastPath.timestamp.getTime();
    }
  }

  /**
   * 턴 카운트 증가
   */
  incrementTurnCount(state: ExecutionState): void {
    state.turnCount++;
  }
}
