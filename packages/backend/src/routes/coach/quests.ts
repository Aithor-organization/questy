/**
 * Coach Routes - Quest Management
 * 퀘스트/오늘의 학습 관련 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { getRandomCoachTip } from './utils.js';

export const questRoutes = new Hono();

// 오늘의 퀘스트 조회
questRoutes.get('/today/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const todayQuests = await supervisor.generateDailyQuests(studentId);
    const today = new Date();

    if (!todayQuests) {
      return c.json({
        success: true,
        data: {
          studentName: student.name,
          date: today.toISOString().slice(0, 10),
          dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
          dailyMessage: `안녕하세요 ${student.name}님! 오늘도 함께 성장해요! 🌱`,
          coachTip: getRandomCoachTip(),
          mainQuests: [],
          reviewQuests: [],
          bonusQuests: [],
          summary: {
            totalQuests: 0,
            estimatedTotalMinutes: 0,
            totalXpAvailable: 0,
          },
        },
      });
    }

    return c.json({
      success: true,
      data: {
        studentName: student.name,
        date: today.toISOString().slice(0, 10),
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
        dailyMessage: todayQuests.dailyMessage,
        coachTip: todayQuests.coachTip,
        mainQuests: todayQuests.mainQuests,
        reviewQuests: todayQuests.reviewQuests,
        bonusQuests: todayQuests.bonusQuests,
        summary: todayQuests.summary,
      },
    });
  } catch (error) {
    console.error('[Coach/Today] Error generating quests:', error);

    const today = new Date();
    return c.json({
      success: true,
      data: {
        studentName: student.name,
        date: today.toISOString().slice(0, 10),
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
        dailyMessage: `안녕하세요 ${student.name}님! 오늘도 함께 성장해요! 🌱`,
        coachTip: getRandomCoachTip(),
        mainQuests: [],
        reviewQuests: [],
        bonusQuests: [],
        summary: {
          totalQuests: 0,
          estimatedTotalMinutes: 0,
          totalXpAvailable: 0,
        },
      },
    });
  }
});

// 퀘스트 완료 기록
questRoutes.post('/:questId/complete/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    delayHandler.recordCompletion(studentId, questId);
    const result = questTracker.completeQuest(studentId, questId);

    if (!result) {
      return c.json({
        success: false,
        error: { message: '퀘스트를 찾을 수 없거나 이미 완료되었습니다' },
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        questId,
        completed: true,
        result,
        message: '🎉 퀘스트를 완료했어요! 잘했어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/QuestComplete] Error:', error);
    return c.json({
      success: false,
      error: { message: '퀘스트 완료 처리에 실패했습니다' },
    }, 500);
  }
});

// 학생의 플랜 목록 조회
questRoutes.get('/plans/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  if (!registry.getStudent(studentId)) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const activePlans = registry.getActivePlans(studentId);
  const allPlans = registry.getStudentPlans(studentId);

  return c.json({
    success: true,
    data: {
      active: activePlans,
      paused: allPlans.filter(p => p.status === 'paused'),
      completed: allPlans.filter(p => p.status === 'completed'),
    },
  });
});
