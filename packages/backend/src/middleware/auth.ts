/**
 * Auth Middleware
 * JWT 토큰 검증 및 역할 기반 접근 제어 (RBAC)
 *
 * LP-003 패턴 적용: authenticate, authorize, optionalAuth 분리
 */

import type { Context, Next } from 'hono';
import { supabase } from '../db/supabase.js';

// 사용자 역할 타입
export type UserRole = 'user' | 'admin';

// 인증된 사용자 정보
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * JWT 토큰에서 사용자 정보 추출
 */
async function getUserFromToken(token: string): Promise<AuthUser | null> {
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // admins 테이블에서 관리자 여부 확인
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email || '',
      role: adminRecord ? 'admin' : 'user',
    };
  } catch (err) {
    console.error('[AuthMiddleware] Token verification error:', err);
    return null;
  }
}

/**
 * 인증 미들웨어 - 유효한 토큰 필수
 *
 * 사용 예: app.use('/api/protected/*', authenticate)
 */
export async function authenticate(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (!user) {
    return c.json({ success: false, error: '유효하지 않은 인증입니다' }, 401);
  }

  // Context에 사용자 정보 저장
  c.set('user', user);

  await next();
}

/**
 * 역할 기반 인가 미들웨어 팩토리
 *
 * 사용 예: app.use('/api/admin/*', authenticate, authorize('admin'))
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthUser | undefined;

    if (!user) {
      return c.json({ success: false, error: '인증이 필요합니다' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      console.warn(`[AuthMiddleware] Access denied: ${user.email} (role: ${user.role}) tried to access admin route`);
      return c.json({ success: false, error: '권한이 없습니다' }, 403);
    }

    await next();
  };
}

/**
 * 선택적 인증 미들웨어 - 토큰 있으면 검증, 없어도 통과
 *
 * 사용 예: app.use('/api/public/*', optionalAuth)
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);

    if (user) {
      c.set('user', user);
    }
  }

  await next();
}

/**
 * 관리자 전용 미들웨어 (authenticate + authorize('admin') 결합)
 *
 * 사용 예: app.use('/api/admin/*', adminOnly)
 */
export async function adminOnly(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const user = await getUserFromToken(token);

  if (!user) {
    return c.json({ success: false, error: '유효하지 않은 인증입니다' }, 401);
  }

  if (user.role !== 'admin') {
    console.warn(`[AuthMiddleware] Admin access denied: ${user.email}`);
    return c.json({ success: false, error: '관리자 권한이 필요합니다' }, 403);
  }

  c.set('user', user);

  await next();
}
