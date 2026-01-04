import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  // 플랜 정보
  planId: string;
  planName: string;
}

interface QuestStore {
  plans: QuestPlan[];
  addPlan: (plan: Omit<QuestPlan, 'id' | 'createdAt'>) => void;
  removePlan: (planId: string) => void;
  toggleQuestComplete: (planId: string, day: number) => void;
  getQuestsByDate: (date: string) => QuestWithPlan[];
  getTodayQuests: () => QuestWithPlan[];
  getPlanById: (planId: string) => QuestPlan | undefined;
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
    }),
    {
      name: 'questybook-storage',
    }
  )
);
