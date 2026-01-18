/**
 * Coach Routes - Type Definitions & Zod Schemas
 * 코치 라우트 타입 및 검증 스키마
 */

import { z } from 'zod';

// ===================== 학생 관리 =====================

export const CreateStudentSchema = z.object({
  name: z.string().min(1).max(50),
  grade: z.string().min(1).max(10),
  subjects: z.array(z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL'])).optional(),
  goals: z.array(z.string()).optional(),
});

// ===================== 채팅 =====================

// 학습 프로필 스키마 (온보딩에서 수집한 정보)
export const UserProfileSchema = z.object({
  age: z.number().nullable().optional(),
  examYear: z.number().optional(),  // 0=현역, 1=재수, 2=삼수, 3=그 이상
  targetUniversity: z.string().optional(),
  targetGrades: z.record(z.string(), z.number()).optional(),  // {"국어": 1, "수학": 2, ...}
  currentGrades: z.record(z.string(), z.number()).optional(),
  selectedTamgu1: z.string().optional(),
  selectedTamgu2: z.string().optional(),
  subscribedPlatforms: z.array(z.string()).optional(),
  dailyStudyHours: z.number().optional(),
});

export const ChatSchema = z.object({
  studentId: z.string().optional(),
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  userName: z.string().optional(),
  metadata: z.object({
    currentSubject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']).optional(),
  }).optional(),
  userProfile: UserProfileSchema.optional(),  // 학습 프로필 (목표 대학, 목표 등급 등)
  questContext: z.object({
    todayQuests: z.array(z.object({
      unitTitle: z.string(),
      range: z.string(),
      completed: z.boolean().optional(),
      estimatedMinutes: z.number().optional(),
      planName: z.string().optional(),
      planId: z.string().optional(),
      day: z.number().optional(),
    })).optional(),
    activePlans: z.array(z.object({
      id: z.string(),
      title: z.string(),
      textbookTitle: z.string().optional(),
      subject: z.string().optional(),
      totalDays: z.number(),
      completedDays: z.number(),
      startDate: z.string(),
      targetEndDate: z.string(),
      status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
      dailyQuests: z.array(z.object({
        day: z.number(),
        date: z.string(),
        unitTitle: z.string(),
        range: z.string(),
        completed: z.boolean(),
        estimatedMinutes: z.number().optional(),
      })).optional(),
    })).optional(),
    upcomingQuests: z.array(z.object({
      date: z.string(),
      quests: z.array(z.object({
        planId: z.string(),
        planTitle: z.string(),
        day: z.number(),
        unitTitle: z.string(),
        range: z.string(),
        estimatedMinutes: z.number().optional(),
      })),
    })).optional(),
    weeklyStats: z.object({
      totalQuests: z.number(),
      completedQuests: z.number(),
      completionRate: z.number(),
      streakDays: z.number(),
      averageMinutesPerDay: z.number(),
    }).optional(),
    plansCount: z.number().optional(),
    completedToday: z.number().optional(),
    totalToday: z.number().optional(),
  }).optional(),
});

export const AdmissionChatSchema = z.object({
  message: z.string().min(1).max(2000),
  stage: z.enum(['name', 'grade', 'subjects', 'goals', 'general']),
  context: z.object({
    currentInfo: z.object({
      name: z.string().optional(),
      grade: z.string().optional(),
      subjects: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

// ===================== 플랜 =====================

export const CreatePlanSchema = z.object({
  studentId: z.string().min(1),
  textbookId: z.string().min(1),
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  title: z.string().min(1).max(100),
  totalSessions: z.number().int().positive(),
  targetDays: z.number().int().positive(),
  topics: z.array(z.string()).optional(),
});

// ===================== 리마인더/리뷰 =====================

export const EveningReviewSchema = z.object({
  studentId: z.string().min(1),
});

export const ReminderSchema = z.object({
  questId: z.string().min(1),
  questName: z.string().min(1),
  estimatedMinutes: z.number().int().positive().default(30),
  reminderType: z.enum(['first', '15min', '30min']).default('first'),
});

// ===================== 자동 일정 재조정 =====================

export const AutoRescheduleSchema = z.object({
  incompleteQuests: z.array(z.object({
    questId: z.string(),
    planId: z.string(),
    planName: z.string(),
    unitTitle: z.string(),
    range: z.string(),
    day: z.number(),
    originalDate: z.string(),
    estimatedMinutes: z.number(),
    excludeWeekends: z.boolean(),
  })),
  planSettings: z.object({
    planId: z.string(),
    planName: z.string(),
    excludeWeekends: z.boolean(),
    totalDays: z.number(),
    remainingDays: z.number(),
    targetEndDate: z.string(),
  }),
  studentPattern: z.object({
    preferredStudyDays: z.array(z.enum(['weekday', 'weekend'])),
    averageQuestsPerDay: z.number(),
    completionRate: z.number(),
    weekendAvailability: z.boolean(),
    consecutiveMissedDays: z.number(),
  }).optional(),
  existingQuestsOnNextDay: z.number().default(0),
});

// ===================== 레벨 테스트 =====================

export const LevelTestStartSchema = z.object({
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  questionCount: z.number().int().min(3).max(20).default(5),
});

export const LevelTestSubmitSchema = z.object({
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  questions: z.array(z.object({
    id: z.string(),
    subject: z.string(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.number(),
    topic: z.string(),
  })),
  answers: z.array(z.number()),
});

// ===================== 반 배정/오리엔테이션 =====================

export const ClassAssignSchema = z.object({
  classId: z.string().min(1),
  levelTestResult: z.object({
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  }).optional(),
});

export const OrientationStepSchema = z.object({
  stepId: z.string().min(1),
});
