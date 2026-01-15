/**
 * Coach Routes - Interventions & Reviews
 * 리마인더, 저녁리뷰, 미학습, 위기개입 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { ReminderSchema } from './types.js';

export const interventionRoutes = new Hono();

// 저녁 리뷰 (FR-025)
interventionRoutes.post('/evening-review/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const questTracker = supervisor.getQuestTracker();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const todayQuests = questTracker.getTodayQuests(studentId);
    const completedQuests = todayQuests?.mainQuests?.filter(q => q.completed) ?? [];
    const remainingQuests = todayQuests?.mainQuests?.filter(q => !q.completed) ?? [];
    const streak = questTracker.getStreak(studentId);

    const tomorrowQuests = remainingQuests.length > 0
      ? remainingQuests.slice(0, 3).map(q => q.title)
      : ['새로운 퀘스트가 준비될 예정이에요!'];

    const todayStatus = {
      completedQuests: completedQuests.length,
      totalQuests: todayQuests?.mainQuests?.length ?? 0,
      completedMinutes: completedQuests.reduce((acc, q) => acc + (q.estimatedMinutes ?? 30), 0),
      remainingQuests: remainingQuests.map(q => q.title),
      streak,
    };

    const reviewMessage = await coachAgent.generateEveningReview(
      student.name,
      todayStatus,
      tomorrowQuests
    );

    return c.json({
      success: true,
      data: {
        reviewMessage,
        todayStatus,
        tomorrowPreview: tomorrowQuests,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/EveningReview] Error:', error);
    return c.json({
      success: false,
      error: { message: '저녁 리뷰 생성에 실패했습니다' },
    }, 500);
  }
});

// 미학습 대응 (FR-024)
interventionRoutes.get('/missed-study/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const todayQuests = questTracker.getTodayQuests(studentId);
    const analysis = todayQuests
      ? delayHandler.analyzeDelays(studentId, todayQuests)
      : null;

    const missedDays = analysis?.consecutiveMissedDays ?? 0;

    if (missedDays === 0) {
      return c.json({
        success: true,
        data: {
          hasMissedStudy: false,
          message: '잘하고 있어요! 밀린 학습이 없어요 👍',
        },
      });
    }

    const missedContext = {
      missedDays,
      lastStudyDate: analysis?.lastCompletedDate ?? null,
      missedQuests: analysis?.expiredQuests.map(q => q.title) ?? [],
      suggestedReschedule: missedDays >= 2,
    };

    const responseMessage = await coachAgent.generateMissedStudyResponse(
      student.name,
      missedContext
    );

    return c.json({
      success: true,
      data: {
        hasMissedStudy: true,
        missedContext,
        responseMessage,
        suggestedActions: missedDays >= 3
          ? ['일정 재조정', '가벼운 복습부터 시작', '코치와 상담']
          : ['오늘 바로 시작하기', '일정 재조정'],
      },
    });
  } catch (error) {
    console.error('[Coach/MissedStudy] Error:', error);
    return c.json({
      success: false,
      error: { message: '미학습 분석에 실패했습니다' },
    }, 500);
  }
});

// 학습 시작 리마인더 (FR-021)
interventionRoutes.post('/reminder/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();
    const parsed = ReminderSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { questName, estimatedMinutes, reminderType } = parsed.data;

    const reminderMessage = await coachAgent.generateStudyStartReminder(
      studentName,
      reminderType,
      questName,
      estimatedMinutes
    );

    return c.json({
      success: true,
      data: {
        reminderMessage,
        reminderType,
        questName,
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/Reminder] Error:', error);
    return c.json({
      success: false,
      error: { message: '리마인더 생성에 실패했습니다' },
    }, 500);
  }
});

// 위기 개입 (FR-026)
interventionRoutes.post('/crisis/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();
  const memoryLane = supervisor.getMemoryLane();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const todayQuests = questTracker.getTodayQuests(studentId);
    const analysis = todayQuests
      ? delayHandler.analyzeDelays(studentId, todayQuests)
      : null;

    const missedDays = analysis?.consecutiveMissedDays ?? 0;

    const memories = memoryLane.getAllMemories(studentId);
    const recentEmotions = memories
      .filter(m => m.type === 'STRUGGLE' || m.type === 'EMOTION')
      .slice(0, 5)
      .map(m => m.content);

    if (missedDays < 3 && recentEmotions.length === 0) {
      return c.json({
        success: true,
        data: {
          needsIntervention: false,
          message: '현재 위기 개입이 필요하지 않아요. 잘하고 있어요! 👍',
        },
      });
    }

    const interventionMessage = await coachAgent.generateCrisisIntervention(
      student.name,
      missedDays,
      recentEmotions
    );

    return c.json({
      success: true,
      data: {
        needsIntervention: true,
        crisisLevel: analysis?.crisisLevel ?? 'CONCERN',
        missedDays,
        recentEmotions,
        interventionMessage,
        suggestedActions: [
          '가벼운 복습부터 시작',
          '목표 재설정',
          '학습 시간 조정',
          '1:1 상담 요청',
        ],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/CrisisIntervention] Error:', error);
    return c.json({
      success: false,
      error: { message: '위기 개입 메시지 생성에 실패했습니다' },
    }, 500);
  }
});
