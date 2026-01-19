import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../config';
import { createSupabaseStorage } from '../lib/supabase-storage';
import type { StudyTips, DailyQuestClient } from '@questybook/shared';

// 타이머 기록 (클라이언트 전용 확장 - shared보다 상세)
interface TimerRecord {
  startedAt: string;      // 시작 시간 (ISO)
  endedAt?: string;       // 종료 시간 (ISO)
  elapsedSeconds: number; // 경과 시간 (초)
  completed: boolean;     // 완료 여부
}

// 활성 타이머 상태 (persist 대상)
type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED';

interface ActiveTimer {
  planId: string;
  questId: string;
  status: TimerStatus;
  startedAt: string;              // 최초 시작 시간 (ISO)
  lastResumedAt: string;          // 마지막 재개 시간 (ISO)
  elapsedBeforePause: number;     // 일시정지 전 누적 시간 (초)
}

/**
 * 클라이언트 상태 관리용 DailyQuest 타입
 * @questybook/shared의 DailyQuestClient를 기반으로 하되,
 * TimerRecord가 더 상세한 구조를 가지므로 확장하여 사용
 */
export interface DailyQuest extends Omit<DailyQuestClient, 'timerRecord'> {
  // 타이머 기록 (shared보다 상세한 구조)
  timerRecord?: TimerRecord;
}

interface Recommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

export interface QuestPlan {
  id: string;
  materialName: string;
  dailyQuests: DailyQuest[];
  summary: {
    totalDays: number;
    totalUnits: number;
    averageMinutesPerDay: number;
    totalEstimatedHours?: number;
  };
  recommendations?: Recommendation[];
  aiMessage?: string;
  createdAt: string;
}

// 타이머 기록 타입 export
export type { TimerRecord };

// 날짜별 퀘스트 (플랜 정보 포함)
export interface QuestWithPlan {
  id: string;  // 고유 식별자
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  completed?: boolean;
  // 상세 정보 (학습계획표에서 추출)
  topics?: string[];
  pages?: string;
  objectives?: string[];
  // AI 학습 팁 (수능 맞춤)
  studyTips?: StudyTips;
  // 문제풀이(자습) 메모
  practiceNote?: string;
  isPractice?: boolean;  // 문제풀이 퀘스트 여부
  // 타이머 기록
  timerRecord?: TimerRecord;
  // 플랜 정보
  planId: string;
  planName: string;
}

// 자동 재조정 결과 타입
interface AutoRescheduleResult {
  strategy: 'WEEKEND_SPILLOVER' | 'STACK_NEXT_DAY' | 'EXTEND_DEADLINE' | 'REDUCE_LOAD';
  newDate: string;
  isWeekend: boolean;
  reasoning: string;
  coachMessage: string;
  confidence: number;
}

// 스마트 재스케줄링 결과 타입 (다른 플랜과의 충돌 고려)
interface SmartRescheduleResult {
  success: boolean;
  rescheduledCount: number;
  rescheduledQuests: Array<{
    id: string;
    newDate: string;
    estimatedMinutes: number;
  }>;
  warnings?: string[];
  overloadDays?: string[];
}

interface QuestStore {
  plans: QuestPlan[];
  addPlan: (plan: Omit<QuestPlan, 'id' | 'createdAt'>) => void;
  removePlan: (planId: string) => void;
  toggleQuestComplete: (planId: string, questId: string) => void;
  getQuestsByDate: (date: string) => QuestWithPlan[];
  getTodayQuests: () => QuestWithPlan[];
  getPlanById: (planId: string) => QuestPlan | undefined;
  // 일정 조정 기능
  rescheduleQuest: (planId: string, questId: string, newDate: string) => boolean;
  postponeQuestsByDays: (planId: string, fromDate: string, daysToAdd: number) => void;
  postponeTodayQuests: (daysToAdd: number) => void;
  // AI 자동 재조정
  getIncompleteQuests: (date: string) => QuestWithPlan[];
  autoRescheduleQuest: (quest: QuestWithPlan, excludeWeekends?: boolean) => Promise<AutoRescheduleResult | null>;
  applyAutoReschedule: (planId: string, questId: string, result: AutoRescheduleResult) => void;
  // 스마트 재스케줄링 (다른 플랜과의 충돌 고려)
  smartRescheduleQuests: (planId: string, targetDate: string, strategy?: string) => Promise<SmartRescheduleResult | null>;
  // 문제풀이(자습) 메모
  updatePracticeNote: (planId: string, questId: string, note: string) => void;
  // 타이머 기록
  updateTimerRecord: (planId: string, questId: string, record: TimerRecord) => void;
  getQuestById: (planId: string, questId: string) => QuestWithPlan | undefined;

  // === 활성 타이머 관리 ===
  activeTimer: ActiveTimer | null;
  startTimer: (planId: string, questId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  completeTimer: () => Promise<void>;
  cancelTimer: () => void;
  getElapsedSeconds: () => number;
  saveTimerProgress: () => void;  // 주기적 저장용
}

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useQuestStore = create<QuestStore>()(
  persist(
    (set, get) => ({
      plans: [],
      activeTimer: null,

      addPlan: (plan) => {
        const newPlan: QuestPlan = {
          ...plan,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ plans: [...state.plans, newPlan] }));
      },

      removePlan: (planId: string) => {
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== planId),
        }));
      },

      toggleQuestComplete: (planId: string, questId: string) => {
        const today = getTodayDateString();
        const plan = get().plans.find(p => p.id === planId);
        const quest = plan?.dailyQuests.find(q => q.id === questId);

        // 오늘 날짜의 퀘스트만 완료 가능
        if (quest && quest.date !== today) {
          console.warn('[QuestStore] 오늘 퀘스트만 완료할 수 있습니다.');
          return;
        }

        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? {
                  ...plan,
                  dailyQuests: plan.dailyQuests.map((quest) =>
                    quest.id === questId
                      ? { ...quest, completed: !quest.completed }
                      : quest
                  ),
                }
              : plan
          ),
        }));
      },

      getQuestsByDate: (date: string) => {
        const { plans } = get();
        const quests: QuestWithPlan[] = [];

        for (const plan of plans) {
          // 같은 날짜에 여러 퀘스트가 있을 수 있음 (강의 + 복습)
          const questsOnDate = plan.dailyQuests.filter((q) => q.date === date);
          for (const quest of questsOnDate) {
            quests.push({
              ...quest,
              planId: plan.id,
              planName: plan.materialName,
            });
          }
        }

        return quests;
      },

      getTodayQuests: () => {
        const today = getTodayDateString();
        return get().getQuestsByDate(today);
      },

      getPlanById: (planId: string) => {
        return get().plans.find((p) => p.id === planId);
      },

      // 특정 퀘스트의 날짜를 변경
      rescheduleQuest: (planId: string, questId: string, newDate: string) => {
        const plan = get().plans.find((p) => p.id === planId);
        const quest = plan?.dailyQuests.find((q) => q.id === questId);

        if (!quest) {
          console.warn('[QuestStore] 퀘스트를 찾을 수 없습니다.');
          return false;
        }

        // 이미 완료된 퀘스트는 날짜 변경 불가
        if (quest.completed) {
          console.warn('[QuestStore] 완료된 퀘스트는 날짜를 변경할 수 없습니다.');
          return false;
        }

        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? {
                  ...plan,
                  dailyQuests: plan.dailyQuests.map((q) =>
                    q.id === questId ? { ...q, date: newDate } : q
                  ),
                }
              : plan
          ),
        }));

        console.log(`[QuestStore] 퀘스트 날짜 변경: ${quest.date} → ${newDate}`);
        return true;
      },

      // 특정 날짜 이후의 모든 퀘스트를 N일 미루기
      postponeQuestsByDays: (planId: string, fromDate: string, daysToAdd: number) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan;

            return {
              ...plan,
              dailyQuests: plan.dailyQuests.map((quest) => {
                // 이미 완료된 퀘스트는 제외
                if (quest.completed) return quest;

                // fromDate 이후의 퀘스트만 미루기
                if (quest.date >= fromDate) {
                  const newDate = new Date(quest.date);
                  newDate.setDate(newDate.getDate() + daysToAdd);
                  const newDateStr = newDate.toISOString().split('T')[0];
                  return { ...quest, date: newDateStr };
                }
                return quest;
              }),
            };
          }),
        }));

        console.log(`[QuestStore] ${fromDate} 이후 퀘스트 ${daysToAdd}일 미룸`);
      },

      // 오늘 퀘스트를 N일 미루기 (가장 많이 쓰일 기능)
      postponeTodayQuests: (daysToAdd: number) => {
        const today = getTodayDateString();
        const todayQuests = get().getQuestsByDate(today);

        // 완료되지 않은 오늘 퀘스트만 미루기
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + daysToAdd);
        const newDateStr = newDate.toISOString().split('T')[0];

        set((state) => ({
          plans: state.plans.map((plan) => ({
            ...plan,
            dailyQuests: plan.dailyQuests.map((quest) => {
              // 오늘 날짜이고 미완료인 퀘스트만 미루기
              if (quest.date === today && !quest.completed) {
                return { ...quest, date: newDateStr };
              }
              return quest;
            }),
          })),
        }));

        const postponedCount = todayQuests.filter((q) => !q.completed).length;
        console.log(`[QuestStore] 오늘 퀘스트 ${postponedCount}개를 ${newDateStr}로 미룸`);
      },

      // 특정 날짜의 미완료 퀘스트 조회
      getIncompleteQuests: (date: string) => {
        return get().getQuestsByDate(date).filter((q) => !q.completed);
      },

      // AI 기반 자동 재조정 요청
      autoRescheduleQuest: async (quest: QuestWithPlan, excludeWeekends = true): Promise<AutoRescheduleResult | null> => {
        try {
          const sessionId = localStorage.getItem('questybook_session_id') || 'guest';
          const plan = get().getPlanById(quest.planId);

          if (!plan) {
            console.error('[QuestStore] 플랜을 찾을 수 없습니다:', quest.planId);
            return null;
          }

          // 남은 일수 계산
          const today = new Date();
          const lastQuest = plan.dailyQuests[plan.dailyQuests.length - 1];
          const targetEndDate = lastQuest ? new Date(lastQuest.date) : today;
          const remainingDays = Math.max(1, Math.ceil((targetEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

          // 내일 이미 있는 퀘스트 수 계산
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0]!;
          const existingQuestsOnNextDay = get().getQuestsByDate(tomorrowStr).length;

          const response = await fetch(
            `${API_BASE_URL}/api/coach/students/${sessionId}/quests/${quest.day}/auto-reschedule`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: quest.planId,
                planName: quest.planName,
                unitTitle: quest.unitTitle,
                range: quest.range,
                day: quest.day,
                originalDate: quest.date,
                estimatedMinutes: quest.estimatedMinutes,
                excludeWeekends,
                totalDays: plan.summary.totalDays,
                remainingDays,
                targetEndDate: targetEndDate.toISOString().split('T')[0],
                existingQuestsOnNextDay,
                completionRate: 0.7, // 기본값 (추후 실제 계산 가능)
                weekendAvailability: true,
                consecutiveMissedDays: 0,
              }),
            }
          );

          const data = await response.json();

          if (data.success && data.data?.result) {
            console.log('[QuestStore] 자동 재조정 결과:', data.data.result);
            return data.data.result;
          }

          console.error('[QuestStore] 자동 재조정 실패:', data.error);
          return null;
        } catch (error) {
          console.error('[QuestStore] 자동 재조정 API 오류:', error);
          return null;
        }
      },

      // 자동 재조정 결과 적용
      applyAutoReschedule: (planId: string, questId: string, result: AutoRescheduleResult) => {
        const success = get().rescheduleQuest(planId, questId, result.newDate);

        if (success) {
          console.log(`[QuestStore] 자동 재조정 적용: ${result.strategy} → ${result.newDate}`);
        } else {
          console.error('[QuestStore] 자동 재조정 적용 실패');
        }
      },

      // 스마트 재스케줄링 (다른 플랜과의 충돌 고려)
      smartRescheduleQuests: async (
        planId: string,
        targetDate: string,
        strategy: string = 'smart'
      ): Promise<SmartRescheduleResult | null> => {
        try {
          const plan = get().getPlanById(planId);
          if (!plan) {
            console.error('[QuestStore] 플랜을 찾을 수 없습니다:', planId);
            return null;
          }

          // 재스케줄링할 퀘스트 ID 목록 (미완료 퀘스트)
          const questIds = plan.dailyQuests
            .filter((q) => !q.completed)
            .map((q) => q.id);

          if (questIds.length === 0) {
            console.log('[QuestStore] 재스케줄링할 퀘스트가 없습니다.');
            return { success: true, rescheduledCount: 0, rescheduledQuests: [] };
          }

          // 다른 플랜들의 정보 수집 (현재 플랜 제외)
          const existingPlans = get().plans
            .filter((p) => p.id !== planId)
            .map((p) => ({
              id: p.id,
              title: p.materialName,
              quests: p.dailyQuests.map((q) => ({
                scheduledDate: q.date,
                estimatedMinutes: q.estimatedMinutes,
              })),
            }));

          console.log(`[QuestStore] 스마트 재스케줄링: ${questIds.length}개 퀘스트, 기존 플랜 ${existingPlans.length}개 고려`);

          const response = await fetch(`${API_BASE_URL}/api/curriculum/reschedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questIds,
              targetDate,
              dailyStudyHours: 10, // 기본 10시간
              strategy,
              existingPlans, // 다른 플랜 정보 전달
            }),
          });

          const data = await response.json();

          if (data.success) {
            // 재스케줄링 결과 적용
            const rescheduledQuests = data.data.rescheduledQuests || [];
            rescheduledQuests.forEach((rq: { id: string; scheduled_date: string }) => {
              get().rescheduleQuest(planId, rq.id, rq.scheduled_date);
            });

            console.log(`[QuestStore] 스마트 재스케줄링 완료: ${rescheduledQuests.length}개 퀘스트 재배치`);

            return {
              success: true,
              rescheduledCount: data.data.rescheduledCount || rescheduledQuests.length,
              rescheduledQuests: rescheduledQuests.map((rq: any) => ({
                id: rq.id,
                newDate: rq.scheduled_date,
                estimatedMinutes: rq.estimated_minutes,
              })),
              warnings: data.data.newSchedule?.warnings,
              overloadDays: data.data.newSchedule?.daily_overload,
            };
          }

          console.error('[QuestStore] 스마트 재스케줄링 실패:', data.error);
          return null;
        } catch (error) {
          console.error('[QuestStore] 스마트 재스케줄링 API 오류:', error);
          return null;
        }
      },

      // 문제풀이(자습) 메모 업데이트
      updatePracticeNote: (planId: string, questId: string, note: string) => {
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? {
                  ...plan,
                  dailyQuests: plan.dailyQuests.map((quest) =>
                    quest.id === questId
                      ? { ...quest, practiceNote: note }
                      : quest
                  ),
                }
              : plan
          ),
        }));
        console.log(`[QuestStore] 메모 업데이트: planId=${planId}, questId=${questId}`);
      },

      updateTimerRecord: (planId: string, questId: string, record: TimerRecord) => {
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? {
                  ...plan,
                  dailyQuests: plan.dailyQuests.map((quest) =>
                    quest.id === questId
                      ? { ...quest, timerRecord: record }
                      : quest
                  ),
                }
              : plan
          ),
        }));
        console.log(`[QuestStore] 타이머 기록 업데이트: planId=${planId}, questId=${questId}, elapsed=${record.elapsedSeconds}s`);
      },

      getQuestById: (planId: string, questId: string) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return undefined;
        const quest = plan.dailyQuests.find(q => q.id === questId);
        if (!quest) return undefined;
        return {
          ...quest,
          planId: plan.id,
          planName: plan.materialName,
        };
      },

      // === 활성 타이머 관리 ===

      // 타이머 시작
      startTimer: (planId: string, questId: string) => {
        const now = new Date().toISOString();
        const quest = get().getQuestById(planId, questId);

        if (!quest) {
          console.error('[QuestStore] 타이머 시작 실패: 퀘스트를 찾을 수 없음');
          return;
        }

        // 이미 다른 타이머가 실행 중이면 저장 후 종료
        const currentTimer = get().activeTimer;
        if (currentTimer && (currentTimer.planId !== planId || currentTimer.questId !== questId)) {
          get().saveTimerProgress();
        }

        // 기존 timerRecord가 있으면 이어서 시작
        const existingRecord = quest.timerRecord;
        const elapsedBeforePause = existingRecord && !existingRecord.completed
          ? existingRecord.elapsedSeconds
          : 0;
        const startedAt = existingRecord && !existingRecord.completed
          ? existingRecord.startedAt
          : now;

        set({
          activeTimer: {
            planId,
            questId,
            status: 'RUNNING',
            startedAt,
            lastResumedAt: now,
            elapsedBeforePause,
          },
        });

        console.log(`[QuestStore] 타이머 시작: planId=${planId}, questId=${questId}, elapsed=${elapsedBeforePause}s`);
      },

      // 타이머 일시정지
      pauseTimer: () => {
        const timer = get().activeTimer;
        if (!timer || timer.status !== 'RUNNING') return;

        // 현재까지 경과 시간 계산
        const elapsed = get().getElapsedSeconds();

        set({
          activeTimer: {
            ...timer,
            status: 'PAUSED',
            elapsedBeforePause: elapsed,
          },
        });

        // timerRecord에도 저장
        get().updateTimerRecord(timer.planId, timer.questId, {
          startedAt: timer.startedAt,
          elapsedSeconds: elapsed,
          completed: false,
        });

        console.log(`[QuestStore] 타이머 일시정지: ${elapsed}s 경과`);
      },

      // 타이머 재개
      resumeTimer: () => {
        const timer = get().activeTimer;
        if (!timer || timer.status !== 'PAUSED') return;

        set({
          activeTimer: {
            ...timer,
            status: 'RUNNING',
            lastResumedAt: new Date().toISOString(),
          },
        });

        console.log(`[QuestStore] 타이머 재개: ${timer.elapsedBeforePause}s부터`);
      },

      // 타이머 완료 (퀘스트 완료 처리 포함)
      completeTimer: async () => {
        const timer = get().activeTimer;
        if (!timer) return;

        const elapsed = get().getElapsedSeconds();
        const endedAt = new Date().toISOString();

        // timerRecord 최종 저장
        get().updateTimerRecord(timer.planId, timer.questId, {
          startedAt: timer.startedAt,
          endedAt,
          elapsedSeconds: elapsed,
          completed: true,
        });

        // 퀘스트 완료 처리
        get().toggleQuestComplete(timer.planId, timer.questId);

        // 백엔드에 실제 학습 시간 저장 (선택적)
        try {
          const sessionId = localStorage.getItem('questybook_session_id') || 'guest';
          const quest = get().getQuestById(timer.planId, timer.questId);

          if (quest) {
            await fetch(`${API_BASE_URL}/api/quests/${quest.id}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: sessionId,
                actualMinutes: Math.ceil(elapsed / 60),
                completedAt: endedAt,
              }),
            });
          }
        } catch (error) {
          console.error('[QuestStore] 백엔드 저장 실패:', error);
        }

        // 타이머 초기화
        set({ activeTimer: null });

        console.log(`[QuestStore] 타이머 완료: ${Math.ceil(elapsed / 60)}분 학습`);
      },

      // 타이머 취소 (진행 상황 저장 후 종료)
      cancelTimer: () => {
        const timer = get().activeTimer;
        if (!timer) return;

        // 현재까지 진행 상황 저장
        const elapsed = get().getElapsedSeconds();
        if (elapsed > 0) {
          get().updateTimerRecord(timer.planId, timer.questId, {
            startedAt: timer.startedAt,
            elapsedSeconds: elapsed,
            completed: false,
          });
        }

        set({ activeTimer: null });
        console.log(`[QuestStore] 타이머 취소: ${elapsed}s 저장됨`);
      },

      // 현재 경과 시간 계산 (초)
      getElapsedSeconds: () => {
        const timer = get().activeTimer;
        if (!timer) return 0;

        if (timer.status === 'PAUSED') {
          return timer.elapsedBeforePause;
        }

        // RUNNING 상태: 이전 누적 + 현재 세션 시간
        const now = Date.now();
        const lastResumed = new Date(timer.lastResumedAt).getTime();
        const currentSession = Math.floor((now - lastResumed) / 1000);

        return timer.elapsedBeforePause + currentSession;
      },

      // 주기적 저장 (30초마다 호출)
      saveTimerProgress: () => {
        const timer = get().activeTimer;
        if (!timer || timer.status !== 'RUNNING') return;

        const elapsed = get().getElapsedSeconds();

        get().updateTimerRecord(timer.planId, timer.questId, {
          startedAt: timer.startedAt,
          elapsedSeconds: elapsed,
          completed: false,
        });

        console.log(`[QuestStore] 타이머 진행 저장: ${elapsed}s`);
      },
    }),
    {
      name: 'questybook-storage',
      version: 2, // id 필드 추가 마이그레이션
      // Supabase 스토리지 사용 (localStorage 폴백 지원)
      storage: createSupabaseStorage('quest'),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as { plans?: QuestPlan[] };

        // v1 → v2: 기존 퀘스트에 id 필드가 없으면 자동 생성
        if (version < 2 && state.plans) {
          console.log('[QuestStore] 마이그레이션: 퀘스트에 고유 ID 부여');
          state.plans = state.plans.map(plan => ({
            ...plan,
            dailyQuests: plan.dailyQuests.map(quest => ({
              ...quest,
              id: quest.id || crypto.randomUUID(),
            })),
          }));
        }

        return state;
      },
    }
  )
);
