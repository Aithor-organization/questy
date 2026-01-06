import { Hono } from 'hono';
import { CreatePlanRequestSchema, StudyPlan } from '@questybook/shared';
import { generateStudyPlan } from '../services/quest-generator';
import * as db from '../db/index.js';

export const planRoutes = new Hono();

// 학습 계획 생성
planRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePlanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: '잘못된 요청 형식입니다',
        details: parsed.error.issues,
      }, 400);
    }

    const plan = await generateStudyPlan(parsed.data);

    // DB에 플랜 저장
    db.createPlan({
      id: plan.id,
      studentId: parsed.data.studentId,
      name: plan.name,
      materialName: parsed.data.materialName,
      subject: parsed.data.subject,
      totalDays: plan.totalDays,
      totalUnits: plan.dailyQuests?.length || 0,
      estimatedHours: plan.dailyQuests?.reduce((acc, q) => acc + (q.estimatedMinutes || 0), 0) / 60,
      status: 'active',
      startDate: plan.startDate ? new Date(plan.startDate) : undefined,
      endDate: plan.endDate ? new Date(plan.endDate) : undefined,
    });

    // 각 퀘스트도 DB에 저장
    if (plan.dailyQuests && plan.dailyQuests.length > 0) {
      const questsToCreate = plan.dailyQuests.map((quest, index) => ({
        id: quest.id,
        planId: plan.id,
        studentId: parsed.data.studentId,
        day: index + 1,
        date: quest.date,
        title: quest.title,
        description: quest.description,
        units: JSON.stringify(quest.units || []),
        estimatedMinutes: quest.estimatedMinutes,
        status: 'pending' as const,
      }));
      db.createQuests(questsToCreate);

      // 각 퀘스트의 태스크도 저장
      for (const quest of plan.dailyQuests) {
        if (quest.tasks && quest.tasks.length > 0) {
          const tasksToCreate = quest.tasks.map((task, idx) => ({
            id: `task-${quest.id}-${idx}`,
            questId: quest.id,
            title: task.title,
            type: task.type,
            estimatedMinutes: task.estimatedMinutes,
            order: idx,
          }));
          db.createTasks(tasksToCreate);
        }
      }
    }

    return c.json({ success: true, data: plan });
  } catch (error) {
    console.error('계획 생성 오류:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '계획 생성 실패',
    }, 500);
  }
});

// 학생별 계획 조회
planRoutes.get('/student/:studentId', (c) => {
  const studentId = c.req.param('studentId');
  const studentPlans = db.getStudentPlans(studentId);
  return c.json({ success: true, data: studentPlans });
});

// 학생별 활성 계획 조회
planRoutes.get('/student/:studentId/active', (c) => {
  const studentId = c.req.param('studentId');
  const activePlans = db.getActivePlans(studentId);
  return c.json({ success: true, data: activePlans });
});

// 특정 계획 조회
planRoutes.get('/:id', (c) => {
  const plan = db.getPlan(c.req.param('id'));

  if (!plan) {
    return c.json({ success: false, error: '계획을 찾을 수 없습니다' }, 404);
  }

  // 플랜에 속한 퀘스트도 함께 조회
  const quests = db.getPlanQuests(plan.id);

  return c.json({
    success: true,
    data: {
      ...plan,
      dailyQuests: quests.map(q => ({
        ...q,
        units: q.units ? JSON.parse(q.units) : [],
      })),
    }
  });
});

// 계획 상태 업데이트
planRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;

  const plan = db.getPlan(id);
  if (!plan) {
    return c.json({ success: false, error: '계획을 찾을 수 없습니다' }, 404);
  }

  const updated = db.updatePlan(id, { status });
  return c.json({ success: true, data: updated });
});

// 계획 삭제 (soft delete - status를 'deleted'로 변경)
planRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');
  const plan = db.getPlan(id);

  if (!plan) {
    return c.json({ success: false, error: '계획을 찾을 수 없습니다' }, 404);
  }

  db.updatePlan(id, { status: 'deleted' });
  return c.json({ success: true });
});
