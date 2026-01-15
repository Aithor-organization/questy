/**
 * Coach Routes - Level Test
 * 레벨 테스트 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { LevelTestStartSchema, LevelTestSubmitSchema } from './types.js';

export const levelTestRoutes = new Hono();

// 레벨 테스트 시작
levelTestRoutes.post('/start/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = LevelTestStartSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { subject, questionCount } = parsed.data;

    const questions = admissionAgent.generateLevelTest(subject as any, questionCount);

    const questionsWithoutAnswers = questions.map(q => ({
      id: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      topic: q.topic,
    }));

    return c.json({
      success: true,
      data: {
        testId: `test-${Date.now()}`,
        subject,
        questions: questionsWithoutAnswers,
        totalQuestions: questions.length,
        _internal: { questions },
      },
    });
  } catch (error) {
    console.error('[Coach/LevelTest] Error:', error);
    return c.json({
      success: false,
      error: { message: '레벨 테스트 생성에 실패했습니다' },
    }, 500);
  }
});

// 레벨 테스트 제출 및 채점
levelTestRoutes.post('/submit/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = LevelTestSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { subject, questions, answers } = parsed.data;

    const result = admissionAgent.evaluateLevelTest(
      studentId,
      subject as any,
      questions as any,
      answers
    );

    const resultMessage = admissionAgent.generateLevelTestResultMessage(result);

    return c.json({
      success: true,
      data: {
        result,
        resultMessage,
        recommendedClass: result.recommendedClass,
      },
    });
  } catch (error) {
    console.error('[Coach/LevelTest] Error:', error);
    return c.json({
      success: false,
      error: { message: '레벨 테스트 채점에 실패했습니다' },
    }, 500);
  }
});
