/**
 * Coach Routes - Schedule Delay Handling
 * 스케줄 밀림 처리 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';

export const delayRoutes = new Hono();

// 학생의 스케줄 밀림 분석
delayRoutes.get('/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
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
    const todayQuests = questTracker.getTodayQuests(studentId);

    if (!todayQuests) {
      return c.json({
        success: true,
        data: {
          hasDelays: false,
          analysis: null,
          message: '분석할 퀘스트가 없습니다',
        },
      });
    }

    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    return c.json({
      success: true,
      data: {
        hasDelays: analysis.expiredQuests.length > 0 || analysis.crisisLevel !== 'NONE',
        analysis,
        message: analysis.crisisLevel === 'CRISIS'
          ? `😢 ${student.name}님, ${analysis.consecutiveMissedDays}일 동안 학습을 쉬셨네요. 같이 이야기해볼까요?`
          : analysis.expiredQuests.length > 0
            ? `📋 ${analysis.expiredQuests.length}개의 밀린 퀘스트가 있어요. 조정해드릴까요?`
            : '✅ 모든 퀘스트가 잘 진행되고 있어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/Delays] Error:', error);
    return c.json({
      success: false,
      error: { message: '스케줄 분석에 실패했습니다' },
    }, 500);
  }
});

// 밀림 알림 목록 조회
delayRoutes.get('/notifications/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
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

  const pendingNotifications = delayHandler.getPendingNotifications(studentId);
  const todayQuests = questTracker.getTodayQuests(studentId);

  if (todayQuests && pendingNotifications.length === 0) {
    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    if (analysis.expiredQuests.length > 0 || analysis.crisisLevel !== 'NONE') {
      const notification = delayHandler.generateDelayNotification(studentId, analysis);

      if (notification) {
        return c.json({
          success: true,
          data: {
            hasNotifications: true,
            notifications: [notification],
            crisisLevel: analysis.crisisLevel,
          },
        });
      }
    }
  }

  return c.json({
    success: true,
    data: {
      hasNotifications: pendingNotifications.length > 0,
      notifications: pendingNotifications,
    },
  });
});

// 알림 해제
delayRoutes.post('/notifications/:studentId/:notificationId/dismiss', async (c) => {
  const studentId = c.req.param('studentId');
  const notificationId = c.req.param('notificationId');
  const supervisor = getSupervisor();
  const delayHandler = supervisor.getScheduleDelayHandler();

  try {
    const body = await c.req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action || 'dismissed';

    delayHandler.dismissNotification(studentId, notificationId);

    return c.json({
      success: true,
      data: {
        notificationId,
        action,
        message: action === 'reschedule'
          ? '📅 일정을 재조정해드릴게요!'
          : action === 'start_now'
            ? '💪 좋아요! 지금 바로 시작해봐요!'
            : '확인했어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/Notifications] Error:', error);
    return c.json({
      success: false,
      error: { message: '알림 처리에 실패했습니다' },
    }, 500);
  }
});

// 스케줄 재조정 요청
delayRoutes.post('/reschedule/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
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
    const todayQuests = questTracker.getTodayQuests(studentId);

    if (!todayQuests) {
      return c.json({
        success: false,
        error: { message: '재조정할 퀘스트가 없습니다' },
      }, 400);
    }

    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    if (!analysis.rescheduleSuggestion) {
      return c.json({
        success: true,
        data: {
          needsReschedule: false,
          message: '현재 재조정이 필요한 일정이 없어요! 👍',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        needsReschedule: true,
        suggestion: analysis.rescheduleSuggestion,
        expiredQuests: analysis.expiredQuests,
        message: `📋 ${analysis.expiredQuests.length}개의 밀린 퀘스트를 ${analysis.rescheduleSuggestion.suggestedQuests.length}개의 새로운 일정으로 재조정할 수 있어요.`,
        coachAdvice: analysis.crisisLevel === 'CRISIS'
          ? '무리하지 말고 천천히 시작해봐요. 작은 것부터 하나씩! 💕'
          : analysis.crisisLevel === 'CONCERN'
            ? '조금 힘들었나요? 오늘은 가볍게 시작해봐요! 😊'
            : '다시 시작하는 것 자체가 대단해요! 💪',
      },
    });
  } catch (error) {
    console.error('[Coach/Reschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '스케줄 재조정에 실패했습니다' },
    }, 500);
  }
});
