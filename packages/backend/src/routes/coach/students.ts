/**
 * Coach Routes - Student Management
 * 학생 관리 라우트
 */

import { Hono } from 'hono';
import { getSupervisor } from './singletons.js';
import { CreateStudentSchema } from './types.js';
import * as db from '../../db/index.js';
import { getUserProfileForCoach } from '../../db/index.js';
import type { Subject } from '@questy/coach-agent';

export const studentRoutes = new Hono();

// 학생 생성/등록 (입학)
studentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreateStudentSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { name, grade, subjects, goals } = parsed.data;

    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    const student = registry.createStudent({
      name,
      grade,
      enrolledSubjects: (subjects ?? ['GENERAL']) as Subject[],
      goals: goals ?? [],
    });

    // DB에도 저장
    db.createStudent({
      id: student.id,
      name: student.name,
      grade: student.grade,
      subjects: JSON.stringify(subjects ?? ['GENERAL']),
      goals: JSON.stringify(goals ?? []),
    });

    console.log(`[Coach] 학생 등록: ${student.name} (${student.id})`);

    return c.json({
      success: true,
      data: {
        student,
        welcomeMessage: `🎉 ${name}님, QuestyBook에 오신 것을 환영해요!\n\n저는 당신의 학습을 도와줄 AI 코치예요. 함께 목표를 향해 달려가요! 💪`,
      },
    });
  } catch (error) {
    console.error('[Coach/Students] Error:', error);
    return c.json({
      success: false,
      error: { message: '학생 등록에 실패했습니다' },
    }, 500);
  }
});

// 학생 정보 조회
studentRoutes.get('/:studentId', async (c) => {
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

  return c.json({ success: true, data: student });
});

// 학생 프로필 업데이트
studentRoutes.patch('/:studentId', async (c) => {
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

  const body = await c.req.json();

  const updated = registry.updateStudent(studentId, {
    ...body,
    lastActiveAt: new Date(),
  });

  return c.json({ success: true, data: updated });
});

// 학생 상세 프로필 조회 (코치용) - Supabase user_profiles 포함
studentRoutes.get('/:studentId/profile', async (c) => {
  const studentId = c.req.param('studentId');

  try {
    const profile = await getUserProfileForCoach(studentId);

    if (!profile) {
      return c.json({
        success: false,
        error: { message: '학생 프로필을 찾을 수 없습니다' },
      }, 404);
    }

    return c.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[Coach/Students] Profile fetch error:', error);
    return c.json({
      success: false,
      error: { message: '프로필 조회 중 오류가 발생했습니다' },
    }, 500);
  }
});
