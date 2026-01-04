import { z } from 'zod';

// 교재/인강 정보
export const MaterialSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['book', 'lecture', 'video', 'document']),
  totalUnits: z.number().positive(), // 총 단원/강의 수
  unitNames: z.array(z.string()).optional(), // 각 단원명
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type Material = z.infer<typeof MaterialSchema>;

// 일일 퀘스트
export const DailyQuestSchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  dayNumber: z.number().positive(), // D-day 기준 몇 번째 날
  title: z.string(),
  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    materialUnit: z.number().optional(), // 연결된 단원
    estimatedMinutes: z.number().positive(),
    completed: z.boolean().default(false),
  })),
  totalEstimatedMinutes: z.number(),
  completed: z.boolean().default(false),
});

export type DailyQuest = z.infer<typeof DailyQuestSchema>;

// 학습 계획 (커리큘럼)
export const StudyPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  material: MaterialSchema,
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(), // YYYY-MM-DD
  totalDays: z.number().positive(),
  dailyQuests: z.array(DailyQuestSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StudyPlan = z.infer<typeof StudyPlanSchema>;

// API 요청/응답
export const CreatePlanRequestSchema = z.object({
  title: z.string().min(1),
  materialType: z.enum(['book', 'lecture', 'video', 'document']),
  materialTitle: z.string().min(1),
  totalUnits: z.number().positive(),
  unitNames: z.array(z.string()).optional(),
  startDate: z.string(),
  endDate: z.string(),
  dailyStudyMinutes: z.number().positive().default(120), // 기본 2시간
  preferences: z.object({
    includeReview: z.boolean().default(true), // 복습 포함
    restDays: z.array(z.number()).default([]), // 쉬는 요일 (0=일, 6=토)
    difficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
  }).optional(),
});

export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });
