/**
 * Coach Routes - Class Assignment & Orientation
 * 반 배정 및 오리엔테이션 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { ClassAssignSchema, OrientationStepSchema } from './types.js';

export const classAssignmentRoutes = new Hono();

// 오리엔테이션 상태 저장 (임시)
const orientationProgressMap = new Map<string, any>();

// 반 옵션 조회
classAssignmentRoutes.get('/options/:studentId', async (c) => {
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

  const subject = (c.req.query('subject') ?? 'GENERAL') as any;
  const classOptions = admissionAgent.getClassOptions(subject);

  return c.json({
    success: true,
    data: {
      classOptions,
      studentName: student.name,
    },
  });
});

// 반 배정
classAssignmentRoutes.post('/assign/:studentId', async (c) => {
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
    const parsed = ClassAssignSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { classId, levelTestResult } = parsed.data;

    const assignment = admissionAgent.assignClass(
      studentId,
      classId,
      levelTestResult as any
    );

    const classOptions = admissionAgent.getClassOptions('GENERAL');
    const assignmentMessage = admissionAgent.generateClassAssignmentMessage(assignment, classOptions);

    return c.json({
      success: true,
      data: {
        assignment,
        assignmentMessage,
      },
    });
  } catch (error) {
    console.error('[Coach/ClassAssign] Error:', error);
    return c.json({
      success: false,
      error: { message: '반 배정에 실패했습니다' },
    }, 500);
  }
});

// 오리엔테이션 시작
classAssignmentRoutes.post('/orientation/start/:studentId', async (c) => {
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

  const progress = admissionAgent.startOrientation(studentId);
  orientationProgressMap.set(studentId, progress);

  const stepMessage = admissionAgent.generateOrientationStepMessage(progress);

  return c.json({
    success: true,
    data: {
      progress,
      stepMessage,
    },
  });
});

// 오리엔테이션 현재 상태 조회
classAssignmentRoutes.get('/orientation/:studentId', async (c) => {
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

  const progress = orientationProgressMap.get(studentId);

  if (!progress) {
    return c.json({
      success: true,
      data: {
        hasProgress: false,
        message: '오리엔테이션을 시작하지 않았어요. 시작해볼까요?',
      },
    });
  }

  const stepMessage = admissionAgent.generateOrientationStepMessage(progress);

  return c.json({
    success: true,
    data: {
      hasProgress: true,
      progress,
      stepMessage,
      isComplete: progress.completedAt != null,
    },
  });
});

// 오리엔테이션 단계 완료
classAssignmentRoutes.post('/orientation/complete-step/:studentId', async (c) => {
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

  const progress = orientationProgressMap.get(studentId);

  if (!progress) {
    return c.json({
      success: false,
      error: { message: '오리엔테이션을 먼저 시작해주세요' },
    }, 400);
  }

  try {
    const body = await c.req.json();
    const parsed = OrientationStepSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { stepId } = parsed.data;

    const updatedProgress = admissionAgent.completeOrientationStep(progress, stepId);
    orientationProgressMap.set(studentId, updatedProgress);

    const isComplete = updatedProgress.completedAt != null;

    const stepMessage = isComplete
      ? admissionAgent.generateOrientationCompleteMessage(student.name)
      : admissionAgent.generateOrientationStepMessage(updatedProgress);

    return c.json({
      success: true,
      data: {
        progress: updatedProgress,
        stepMessage,
        isComplete,
      },
    });
  } catch (error) {
    console.error('[Coach/Orientation] Error:', error);
    return c.json({
      success: false,
      error: { message: '오리엔테이션 단계 완료에 실패했습니다' },
    }, 500);
  }
});
