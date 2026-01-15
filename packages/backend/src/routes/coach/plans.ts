/**
 * Coach Routes - Plan Management
 * 플랜 관리 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { CreatePlanSchema } from './types.js';
import type { Subject } from '@questy/coach-agent';

export const planRoutes = new Hono();

// 플랜 생성
planRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, textbookId, subject, title, totalSessions, targetDays, topics } = parsed.data;

    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    if (!registry.getStudent(studentId)) {
      return c.json({
        success: false,
        error: { message: '학생을 찾을 수 없습니다' },
      }, 404);
    }

    const targetEndDate = new Date();
    targetEndDate.setDate(targetEndDate.getDate() + targetDays);

    const plan = registry.createPlan({
      studentId,
      textbookId,
      subject: subject as Subject,
      title,
      totalSessions,
      targetEndDate,
      topics: topics ?? [],
    });

    if (!plan) {
      return c.json({
        success: false,
        error: { message: '플랜 생성에 실패했습니다' },
      }, 500);
    }

    console.log(`[Coach/Plans] 플랜 생성: ${title} for ${studentId}`);

    return c.json({
      success: true,
      data: {
        plan,
        coachMessage: `📚 "${title}" 학습 플랜이 생성되었어요!\n\n${totalSessions}회 학습을 ${targetDays}일 동안 진행할 예정이에요. 함께 열심히 해봐요! 🔥`,
      },
    });
  } catch (error) {
    console.error('[Coach/Plans] Error:', error);
    return c.json({
      success: false,
      error: { message: '플랜 생성에 실패했습니다' },
    }, 500);
  }
});

// 플랜 상세 조회
planRoutes.get('/:planId', async (c) => {
  const planId = c.req.param('planId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const plan = registry.getPlan(planId);

  if (!plan) {
    return c.json({
      success: false,
      error: { message: '플랜을 찾을 수 없습니다' },
    }, 404);
  }

  return c.json({ success: true, data: plan });
});

// 플랜 진행 업데이트
planRoutes.patch('/:planId/progress', async (c) => {
  const planId = c.req.param('planId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const plan = registry.getPlan(planId);

  if (!plan) {
    return c.json({
      success: false,
      error: { message: '플랜을 찾을 수 없습니다' },
    }, 404);
  }

  const body = await c.req.json();
  const updated = registry.updatePlan(planId, body);

  if (!updated) {
    return c.json({
      success: false,
      error: { message: '플랜 업데이트에 실패했습니다' },
    }, 500);
  }

  const progressPercent = Math.round((updated.completedSessions / updated.totalSessions) * 100);

  return c.json({
    success: true,
    data: {
      plan: updated,
      progressPercent,
      coachMessage: updated.status === 'completed'
        ? `🎊 축하해요! "${updated.title}" 플랜을 완료했어요! 정말 대단해요! 🏆`
        : `👍 잘하고 있어요! ${progressPercent}% 진행 중이에요. 조금만 더 힘내요! 💪`,
    },
  });
});
