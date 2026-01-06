import { Hono } from 'hono';
import * as db from '../db/index.js';

export const questRoutes = new Hono();

// 학생의 오늘 퀘스트 조회
questRoutes.get('/today/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const quests = db.getTodayQuests(studentId);

  // 각 퀘스트에 태스크 정보도 포함
  const questsWithTasks = quests.map(quest => ({
    ...quest,
    units: quest.units ? JSON.parse(quest.units) : [],
    tasks: db.getQuestTasks(quest.id),
  }));

  return c.json({
    success: true,
    data: questsWithTasks,
  });
});

// 특정 플랜의 모든 퀘스트 조회
questRoutes.get('/plan/:planId', (c) => {
  const planId = c.req.param('planId');
  const quests = db.getPlanQuests(planId);

  const questsWithTasks = quests.map(quest => ({
    ...quest,
    units: quest.units ? JSON.parse(quest.units) : [],
    tasks: db.getQuestTasks(quest.id),
  }));

  return c.json({
    success: true,
    data: questsWithTasks,
  });
});

// 특정 퀘스트 상세 조회
questRoutes.get('/:questId', (c) => {
  const questId = c.req.param('questId');
  const quest = db.getQuest(questId);

  if (!quest) {
    return c.json({ success: false, error: '퀘스트를 찾을 수 없습니다' }, 404);
  }

  const tasks = db.getQuestTasks(questId);

  return c.json({
    success: true,
    data: {
      ...quest,
      units: quest.units ? JSON.parse(quest.units) : [],
      tasks,
    },
  });
});

// 퀘스트 시작 (상태를 in_progress로 변경)
questRoutes.patch('/:questId/start', (c) => {
  const questId = c.req.param('questId');
  const quest = db.getQuest(questId);

  if (!quest) {
    return c.json({ success: false, error: '퀘스트를 찾을 수 없습니다' }, 404);
  }

  const updated = db.updateQuest(questId, { status: 'in_progress' });
  return c.json({ success: true, data: updated });
});

// 퀘스트 완료 처리
questRoutes.patch('/:questId/complete', async (c) => {
  const questId = c.req.param('questId');
  const body = await c.req.json().catch(() => ({}));
  const { actualMinutes } = body;

  const quest = db.getQuest(questId);
  if (!quest) {
    return c.json({ success: false, error: '퀘스트를 찾을 수 없습니다' }, 404);
  }

  const updated = db.completeQuest(questId, actualMinutes);

  // 진도 업데이트
  if (quest.studentId) {
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = db.getTodayProgress(quest.studentId);

    db.upsertProgress({
      id: todayProgress?.id || `prog-${Date.now()}`,
      studentId: quest.studentId,
      planId: quest.planId || undefined,
      date: today,
      studyMinutes: (todayProgress?.studyMinutes || 0) + (actualMinutes || quest.estimatedMinutes || 0),
      questsCompleted: (todayProgress?.questsCompleted || 0) + 1,
      streak: (todayProgress?.streak || 0) + 1,
    });
  }

  return c.json({
    success: true,
    data: updated,
  });
});

// 퀘스트 건너뛰기
questRoutes.patch('/:questId/skip', (c) => {
  const questId = c.req.param('questId');
  const quest = db.getQuest(questId);

  if (!quest) {
    return c.json({ success: false, error: '퀘스트를 찾을 수 없습니다' }, 404);
  }

  const updated = db.updateQuest(questId, { status: 'skipped' });
  return c.json({ success: true, data: updated });
});

// 태스크 완료 토글
questRoutes.patch('/:questId/tasks/:taskId/toggle', (c) => {
  const taskId = c.req.param('taskId');
  const result = db.toggleTask(taskId);

  if (!result) {
    return c.json({ success: false, error: '태스크를 찾을 수 없습니다' }, 404);
  }

  return c.json({
    success: true,
    data: result,
  });
});

// 학생의 전체 퀘스트 히스토리 조회
questRoutes.get('/student/:studentId/history', (c) => {
  const studentId = c.req.param('studentId');
  const limit = parseInt(c.req.query('limit') || '50');
  const quests = db.getStudentQuests(studentId, limit);

  return c.json({
    success: true,
    data: quests.map(q => ({
      ...q,
      units: q.units ? JSON.parse(q.units) : [],
    })),
  });
});
