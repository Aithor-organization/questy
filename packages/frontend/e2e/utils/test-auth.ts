/**
 * E2E 테스트용 인증 유틸리티
 * Supabase Auth 환경에서 실제 로그인 플로우 사용
 */

import { Page } from '@playwright/test';

// 테스트 사용자 설정
export interface TestUser {
  id: string;
  email: string;
  name: string;
  studentId: string;
}

// 실제 테스트 계정 (Supabase에 등록된 계정)
export const TEST_USER: TestUser = {
  id: 'admin-user-id',
  email: 'admin@admin.com',
  name: 'Admin',
  studentId: 'admin-001',
};

// 실제 로그인 자격증명
const TEST_CREDENTIALS = {
  email: 'admin@admin.com',
  password: 'Admin123$',
};

/**
 * 실제 로그인 플로우를 통한 인증
 * Supabase Auth 세션 생성
 */
export async function setupTestAuth(page: Page): Promise<void> {
  // 현재 URL 확인 - 이미 로그인 상태인지 체크
  const currentUrl = page.url();

  // 로그인 페이지가 아니면 로그인 페이지로 이동
  if (!currentUrl.includes('/login')) {
    await page.goto('/login');
  }

  // 이미 로그인되어 있으면 (로그인 폼이 없으면) 건너뛰기
  const emailInput = page.locator('input[placeholder="이메일을 입력하세요"]');
  const isLoginPage = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);

  if (!isLoginPage) {
    // 이미 로그인됨 - 홈으로 이동
    await page.goto('/');
    return;
  }

  // 로그인 폼 입력
  await emailInput.fill(TEST_CREDENTIALS.email);
  await page.fill('input[placeholder="비밀번호를 입력하세요"]', TEST_CREDENTIALS.password);

  // 로그인 버튼 클릭
  await page.click('button:has-text("로그인")');

  // 로그인 완료 대기 (홈페이지로 리다이렉트 또는 현재 페이지 유지)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
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
 * (현재 테스트 계정이 관리자 계정이므로 동일하게 동작)
 */
export async function setupAdminAuth(page: Page): Promise<void> {
  await setupTestAuth(page);
}
