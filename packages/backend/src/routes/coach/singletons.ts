/**
 * Coach Routes - Singleton Instances
 * Supervisor 및 AutoRescheduler 싱글톤 관리
 */

import {
  Supervisor,
  AutoRescheduler,
} from '@questy/coach-agent';

// Supervisor 싱글톤 인스턴스
let supervisorInstance: Supervisor | null = null;

// AutoRescheduler 싱글톤 인스턴스
let autoReschedulerInstance: AutoRescheduler | null = null;

/**
 * Supervisor 싱글톤 인스턴스 반환
 */
export function getSupervisor(): Supervisor {
  if (!supervisorInstance) {
    supervisorInstance = new Supervisor({
      enableMemoryExtraction: true,
      enableBurnoutCheck: false,
      enableQuestSystem: true,
    });
    console.log('[Coach] Supervisor 인스턴스 생성됨');
  }
  return supervisorInstance;
}

/**
 * AutoRescheduler 싱글톤 인스턴스 반환
 */
export function getAutoRescheduler(): AutoRescheduler {
  if (!autoReschedulerInstance) {
    autoReschedulerInstance = new AutoRescheduler();
    console.log('[Coach] AutoRescheduler 인스턴스 생성됨');
  }
  return autoReschedulerInstance;
}
