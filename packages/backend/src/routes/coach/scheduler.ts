/**
 * Coach Routes - Auto Scheduler
 * 자동 일정 재조정 라우트
 */

import { Hono } from 'hono';
import { getSupervisor, getAutoRescheduler } from './singletons.js';
import { AutoRescheduleSchema } from './types.js';
import { generateOverallRescheduleMessage, getDefaultStudentPattern } from './utils.js';
import type { IncompleteQuest, PlanSettings, StudentPattern } from '@questy/coach-agent';

export const schedulerRoutes = new Hono();

// AI 기반 자동 일정 재조정 (다수 퀘스트)
schedulerRoutes.post('/batch/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const autoRescheduler = getAutoRescheduler();

  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();
    const parsed = AutoRescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { incompleteQuests, planSettings, studentPattern } = parsed.data;
    const pattern: StudentPattern = studentPattern || getDefaultStudentPattern();

    console.log(`[AutoReschedule] Processing ${incompleteQuests.length} incomplete quests for ${studentName}`);

    const results = await autoRescheduler.batchReschedule(
      incompleteQuests as IncompleteQuest[],
      planSettings as PlanSettings,
      pattern
    );

    const summary = {
      totalProcessed: results.length,
      weekendSpillover: results.filter(r => r.strategy === 'WEEKEND_SPILLOVER').length,
      stackedNextDay: results.filter(r => r.strategy === 'STACK_NEXT_DAY').length,
      reducedLoad: results.filter(r => r.strategy === 'REDUCE_LOAD').length,
    };

    console.log(`[AutoReschedule] Results: ${JSON.stringify(summary)}`);

    return c.json({
      success: true,
      data: {
        results,
        summary,
        overallMessage: generateOverallRescheduleMessage(studentName, results),
      },
    });
  } catch (error) {
    console.error('[AutoReschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '자동 일정 재조정에 실패했습니다' },
    }, 500);
  }
});

// 단일 퀘스트 자동 재조정
schedulerRoutes.post('/single/:studentId/:questId', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const autoRescheduler = getAutoRescheduler();

  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();

    const incompleteQuest: IncompleteQuest = {
      questId,
      planId: body.planId,
      planName: body.planName,
      unitTitle: body.unitTitle,
      range: body.range || '',
      day: body.day || 0,
      originalDate: body.originalDate || new Date().toISOString().slice(0, 10),
      estimatedMinutes: body.estimatedMinutes || 30,
      excludeWeekends: body.excludeWeekends ?? true,
    };

    const planSettings: PlanSettings = {
      planId: body.planId,
      planName: body.planName,
      excludeWeekends: body.excludeWeekends ?? true,
      totalDays: body.totalDays || 30,
      remainingDays: body.remainingDays || 15,
      targetEndDate: body.targetEndDate || '',
    };

    const studentPattern: StudentPattern = {
      preferredStudyDays: ['weekday'],
      averageQuestsPerDay: 1,
      completionRate: body.completionRate || 0.7,
      weekendAvailability: body.weekendAvailability ?? true,
      consecutiveMissedDays: body.consecutiveMissedDays || 0,
    };

    console.log(`[AutoReschedule] Processing single quest ${questId} for ${studentName}`);

    const result = await autoRescheduler.evaluateAndReschedule(
      incompleteQuest,
      planSettings,
      studentPattern,
      body.existingQuestsOnNextDay || 0
    );

    console.log(`[AutoReschedule] Strategy: ${result.strategy}, NewDate: ${result.newDate}`);

    return c.json({
      success: true,
      data: {
        result,
        coachMessage: result.coachMessage,
        messageActions: result.messageActions,
      },
    });
  } catch (error) {
    console.error('[AutoReschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '자동 일정 재조정에 실패했습니다' },
    }, 500);
  }
});
