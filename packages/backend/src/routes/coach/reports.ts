/**
 * Coach Routes - Reports & Memory
 * 리포트, 메모리, 번아웃 체크 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { getAchievements, generateCoachFeedback } from './utils.js';

export const reportRoutes = new Hono();

// 주간 리포트
reportRoutes.get('/weekly/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const questTracker = supervisor.getQuestTracker();
  const memoryLane = supervisor.getMemoryLane();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const progress = registry.getStudentProgress(studentId);
  const streak = questTracker.getStreak(studentId);
  const allPlans = registry.getStudentPlans(studentId);

  const memories = memoryLane.getAllMemories(studentId);
  const completedQuestsCount = memories.filter(m => m.type === 'MASTERY').length;

  return c.json({
    success: true,
    data: {
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      },
      summary: {
        totalStudyDays: Math.min(streak, 7),
        totalStudyMinutes: completedQuestsCount * 30,
        completedQuests: completedQuestsCount,
        earnedXp: completedQuestsCount * 100,
        currentStreak: streak,
      },
      planProgress: allPlans.map(plan => ({
        planId: plan.id,
        title: plan.title,
        progress: Math.round((plan.completedSessions / plan.totalSessions) * 100),
        sessionsCompleted: plan.completedSessions,
        totalSessions: plan.totalSessions,
      })),
      achievements: getAchievements(streak, completedQuestsCount),
      coachFeedback: generateCoachFeedback(student.name, streak, progress),
    },
  });
});

// 학습 기억 조회
reportRoutes.get('/memories/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const memoryLane = supervisor.getMemoryLane();

  const memories = memoryLane.getAllMemories(studentId);
  const reviewRecommendations = memoryLane.getReviewRecommendations(studentId);

  return c.json({
    success: true,
    data: {
      totalMemories: memories.length,
      memories: memories.slice(0, 20),
      reviewRecommendations,
    },
  });
});

// 번아웃 체크
reportRoutes.get('/burnout-check/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const memoryLane = supervisor.getMemoryLane();

  const burnoutCheck = memoryLane.shouldContinueStudying(studentId);

  return c.json({
    success: true,
    data: burnoutCheck,
  });
});
