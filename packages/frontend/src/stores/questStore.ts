import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../config';

// AI 학습 팁 (수능 맞춤)
interface StudyTips {
  importance: string; // "중요도 높음", "자주 출제됨" 등
  keyPoints: string[]; // 핵심 포인트
  commonMistakes?: string; // 자주 하는 실수
  studyMethod?: string; // 추천 학습법
  relatedUnits?: string; // 연계 단원
}

interface DailyQuest {
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

// 날짜별 퀘스트 (플랜 정보 포함)
export interface QuestWithPlan {
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

interface QuestStore {
  plans: QuestPlan[];
  addPlan: (plan: Omit<QuestPlan, 'id' | 'createdAt'>) => void;
  removePlan: (planId: string) => void;
  toggleQuestComplete: (planId: string, day: number) => void;
  getQuestsByDate: (date: string) => QuestWithPlan[];
  getTodayQuests: () => QuestWithPlan[];
  getPlanById: (planId: string) => QuestPlan | undefined;
  // 일정 조정 기능
  rescheduleQuest: (planId: string, day: number, newDate: string) => boolean;
  postponeQuestsByDays: (planId: string, fromDate: string, daysToAdd: number) => void;
  postponeTodayQuests: (daysToAdd: number) => void;
  // AI 자동 재조정
  getIncompleteQuests: (date: string) => QuestWithPlan[];
  autoRescheduleQuest: (quest: QuestWithPlan, excludeWeekends?: boolean) => Promise<AutoRescheduleResult | null>;
  applyAutoReschedule: (planId: string, day: number, result: AutoRescheduleResult) => void;
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

      toggleQuestComplete: (planId: string, day: number) => {
        const today = getTodayDateString();
        const plan = get().plans.find(p => p.id === planId);
        const quest = plan?.dailyQuests.find(q => q.day === day);

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
                    quest.day === day
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
          const quest = plan.dailyQuests.find((q) => q.date === date);
          if (quest) {
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
      rescheduleQuest: (planId: string, day: number, newDate: string) => {
        const plan = get().plans.find((p) => p.id === planId);
        const quest = plan?.dailyQuests.find((q) => q.day === day);

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
                    q.day === day ? { ...q, date: newDate } : q
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
      applyAutoReschedule: (planId: string, day: number, result: AutoRescheduleResult) => {
        const success = get().rescheduleQuest(planId, day, result.newDate);

        if (success) {
          console.log(`[QuestStore] 자동 재조정 적용: ${result.strategy} → ${result.newDate}`);
        } else {
          console.error('[QuestStore] 자동 재조정 적용 실패');
        }
      },
    }),
    {
      name: 'questybook-storage',
    }
  )
);
