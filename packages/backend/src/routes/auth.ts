/**
 * Authentication Routes
 * 회원가입 및 로그인 API
 */

import { Hono } from 'hono';
import { z } from 'zod';
import * as db from '../db/index.js';

export const authRoutes = new Hono();

// 회원가입 스키마
const registerSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  name: z.string().min(1, '이름을 입력해주세요'),
});

// 로그인 스키마
const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

// 비밀번호 해싱 (Bun 내장 API)
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 19456,
    timeCost: 2,
  });
}

// 비밀번호 검증
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

// ID 생성
function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 회원가입
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();

    // 입력 검증
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: validation.error.errors[0].message,
      }, 400);
    }

    const { email, password, name } = validation.data;

    // 이메일 중복 체크
    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return c.json({
        success: false,
        error: '이미 사용 중인 이메일입니다',
      }, 400);
    }

    // 비밀번호 해싱
    const passwordHash = await hashPassword(password);

    // 학생 프로필 생성
    const studentId = `student-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const student = db.createStudent({
      id: studentId,
      name,
    });

    // 사용자 생성
    const userId = generateId();
    const user = db.createUser({
      id: userId,
      email,
      passwordHash,
      name,
      studentId: student.id,
    });

    console.log(`[Auth] 새 사용자 등록: ${email}`);

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          studentId: user.studentId,
        },
      },
    });
  } catch (error) {
    console.error('[Auth] 회원가입 오류:', error);
    return c.json({
      success: false,
      error: '회원가입 처리 중 오류가 발생했습니다',
    }, 500);
  }
});

// 로그인
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();

    // 입력 검증
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        success: false,
        error: validation.error.errors[0].message,
      }, 400);
    }

    const { email, password } = validation.data;

    // 사용자 조회
    const user = db.getUserByEmail(email);
    if (!user) {
      return c.json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다',
      }, 401);
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다',
      }, 401);
    }

    // 마지막 로그인 시간 업데이트
    db.updateUserLastLogin(user.id);

    console.log(`[Auth] 로그인 성공: ${email}`);

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          studentId: user.studentId,
        },
      },
    });
  } catch (error) {
    console.error('[Auth] 로그인 오류:', error);
    return c.json({
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다',
    }, 500);
  }
});

// 현재 사용자 정보 조회
authRoutes.get('/me/:userId', (c) => {
  const userId = c.req.param('userId');

  const user = db.getUserById(userId);
  if (!user) {
    return c.json({
      success: false,
      error: '사용자를 찾을 수 없습니다',
    }, 404);
  }

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        studentId: user.studentId,
      },
    },
  });
});
