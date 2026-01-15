/**
 * E2E 테스트용 인증 유틸리티
 * Supabase Auth 환경에서 테스트 사용자 설정
 */

import { Page } from '@playwright/test';

// 테스트 사용자 설정
export interface TestUser {
  id: string;
  email: string;
  name: string;
  studentId: string;
}

export const TEST_USER: TestUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: '테스트학생',
  studentId: 'test-student-001',
};

/**
 * 테스트 사용자로 인증 상태 설정
 * Zustand persist 형식 + Supabase 호환
 */
export async function setupTestAuth(page: Page, user: TestUser = TEST_USER): Promise<void> {
  await page.evaluate((userData) => {
    // 1. Zustand auth store 형식 (questybook-auth)
    const authState = {
      state: {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          studentId: userData.studentId,
          isAdmin: userData.email === 'admin@questybook.com',
        },
        session: null, // 실제 세션은 없지만 mock 모드에서 동작
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      version: 0,
    };
    localStorage.setItem('questybook-auth', JSON.stringify(authState));

    // 2. 레거시 localStorage 키 (일부 컴포넌트에서 직접 참조)
    localStorage.setItem('questybook_student_id', userData.studentId);
    localStorage.setItem('questybook_student_name', userData.name);
  }, user);
}

/**
 * 신규 사용자 상태로 초기화 (미인증)
 */
export async function setupNewUser(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('questybook-auth');
    localStorage.removeItem('questybook_student_id');
    localStorage.removeItem('questybook_student_name');
  });
}

/**
 * 관리자 사용자로 인증 상태 설정
 */
export async function setupAdminAuth(page: Page): Promise<void> {
  const adminUser: TestUser = {
    id: 'admin-user-id',
    email: 'admin@questybook.com',
    name: '관리자',
    studentId: 'admin-student-001',
  };
  await setupTestAuth(page, adminUser);
}
