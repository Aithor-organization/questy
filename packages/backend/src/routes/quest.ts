import { Hono } from 'hono';

export const questRoutes = new Hono();

// 오늘의 퀘스트 조회 (계획 ID 기반)
questRoutes.get('/today/:planId', (c) => {
  const planId = c.req.param('planId');
  const today = new Date().toISOString().split('T')[0];

  // TODO: 실제 DB에서 조회
  return c.json({
    success: true,
    data: {
      planId,
      date: today,
      message: '오늘의 퀘스트를 조회합니다',
    },
  });
});

// 퀘스트 완료 처리
questRoutes.patch('/:questId/complete', async (c) => {
  const questId = c.req.param('questId');

  // TODO: 실제 완료 처리 로직
  return c.json({
    success: true,
    data: { questId, completed: true },
  });
});

// 태스크 완료 토글
questRoutes.patch('/:questId/tasks/:taskId/toggle', async (c) => {
  const questId = c.req.param('questId');
  const taskId = c.req.param('taskId');

  // TODO: 실제 토글 로직
  return c.json({
    success: true,
    data: { questId, taskId, toggled: true },
  });
});
