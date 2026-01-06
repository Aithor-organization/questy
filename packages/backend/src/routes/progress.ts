import { Hono } from 'hono';
import * as db from '../db/index.js';

export const progressRoutes = new Hono();

// 학생 통계 조회
progressRoutes.get('/stats/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const stats = db.getStudentStats(studentId);

  return c.json({
    success: true,
    data: stats,
  });
});

// 학생 진도 히스토리 조회
progressRoutes.get('/history/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const days = parseInt(c.req.query('days') || '30');
  const progress = db.getStudentProgress(studentId, days);

  return c.json({
    success: true,
    data: progress,
  });
});

// 오늘 진도 조회
progressRoutes.get('/today/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const today = db.getTodayProgress(studentId);

  return c.json({
    success: true,
    data: today || {
      studyMinutes: 0,
      questsCompleted: 0,
      tasksCompleted: 0,
      streak: 0,
    },
  });
});

// 진도 수동 업데이트 (학습 시간 기록 등)
progressRoutes.post('/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const body = await c.req.json();
  const { studyMinutes, questsCompleted, tasksCompleted } = body;

  const today = new Date().toISOString().split('T')[0];
  const existing = db.getTodayProgress(studentId);

  const progress = db.upsertProgress({
    id: existing?.id || `prog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    studentId,
    date: today,
    studyMinutes: (existing?.studyMinutes || 0) + (studyMinutes || 0),
    questsCompleted: questsCompleted ?? existing?.questsCompleted ?? 0,
    tasksCompleted: tasksCompleted ?? existing?.tasksCompleted ?? 0,
    streak: existing?.streak || 1,
  });

  return c.json({
    success: true,
    data: progress,
  });
});

// 대화 기록 조회
progressRoutes.get('/conversations/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const limit = parseInt(c.req.query('limit') || '50');
  const conversations = db.getConversations(studentId, limit);

  return c.json({
    success: true,
    data: conversations,
  });
});
