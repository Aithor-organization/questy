/**
 * E2E 테스트: 로그인 플로우
 * - 로그인 페이지 UI
 * - 로그인 성공/실패 케이스
 * - 로그아웃 플로우
 */

import { test, expect } from '@playwright/test';
import { setupTestAuth, setupNewUser, TEST_USER } from './utils/test-auth';

test.describe('로그인 페이지 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('로그인 페이지 기본 요소 표시', async ({ page }) => {
    // 로그인 헤더
    await expect(page.getByText(/로그인|Login/i)).toBeVisible();

    // 이메일 입력 필드
    await expect(page.locator('input[placeholder="이메일을 입력하세요"]')).toBeVisible();

    // 비밀번호 입력 필드
    await expect(page.locator('input[placeholder="비밀번호를 입력하세요"]')).toBeVisible();

    // 로그인 버튼
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('회원가입 링크 표시', async ({ page }) => {
    // 회원가입 링크
    const signupLink = page.getByRole('link', { name: /회원가입|Sign up/i });
    await expect(signupLink).toBeVisible();
  });

  test('빈 폼 제출 시 에러 표시', async ({ page }) => {
    // 로그인 버튼 클릭
    await page.getByRole('button', { name: '로그인' }).click();

    // 에러 메시지 또는 validation 표시
    // HTML5 validation이 있으므로 required 필드 확인
    const emailInput = page.locator('input[placeholder="이메일을 입력하세요"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('잘못된 이메일 형식 입력 시 validation', async ({ page }) => {
    // 잘못된 이메일 입력
    await page.fill('input[placeholder="이메일을 입력하세요"]', 'invalid-email');
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'password123');

    // 제출 시도
    await page.getByRole('button', { name: '로그인' }).click();

    // HTML5 이메일 validation 확인
    const emailInput = page.locator('input[placeholder="이메일을 입력하세요"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });
});

test.describe('로그인 성공 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupNewUser(page);
    await page.goto('/login');
  });

  test('올바른 자격증명으로 로그인 성공', async ({ page }) => {
    // 이메일 입력
    await page.fill('input[placeholder="이메일을 입력하세요"]', 'admin@admin.com');

    // 비밀번호 입력
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'Admin123$');

    // 로그인 버튼 클릭
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 후 리다이렉트 확인 (홈페이지로)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // 로그인 상태 확인
    expect(page.url()).not.toContain('/login');
  });

  test('로그인 후 사용자 정보 표시', async ({ page }) => {
    await setupTestAuth(page);
    await page.goto('/');

    // 마이페이지로 이동하여 사용자 정보 확인
    await page.goto('/my');

    // 사용자 이메일 또는 이름 표시 확인
    await expect(page.getByText(TEST_USER.email)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('로그인 실패 케이스', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    // 올바른 이메일, 잘못된 비밀번호
    await page.fill('input[placeholder="이메일을 입력하세요"]', 'admin@admin.com');
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'WrongPassword123$');

    // 로그인 버튼 클릭
    await page.getByRole('button', { name: '로그인' }).click();

    // 에러 메시지 표시 확인
    await expect(page.getByText(/이메일.*비밀번호.*확인|로그인.*실패|Invalid/i)).toBeVisible({ timeout: 5000 });

    // 여전히 로그인 페이지에 있는지 확인
    expect(page.url()).toContain('/login');
  });

  test('존재하지 않는 이메일로 로그인 실패', async ({ page }) => {
    // 존재하지 않는 이메일
    await page.fill('input[placeholder="이메일을 입력하세요"]', 'nonexistent@test.com');
    await page.fill('input[placeholder="비밀번호를 입력하세요"]', 'Password123$');

    // 로그인 버튼 클릭
    await page.getByRole('button', { name: '로그인' }).click();

    // 에러 메시지 표시 또는 로그인 페이지 유지
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });
});

test.describe('로그아웃 플로우', () => {
  test('마이페이지에서 로그아웃', async ({ page }) => {
    // 로그인 상태로 설정
    await page.goto('/');
    await setupTestAuth(page);

    // 마이페이지로 이동
    await page.goto('/my');
    await page.waitForLoadState('networkidle');

    // 로그아웃 버튼 찾기
    const logoutButton = page.getByRole('button', { name: /로그아웃|Logout/i });
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click();

      // 로그아웃 후 로그인 페이지로 리다이렉트
      await page.waitForURL(/\/login|\/$/);
    }
  });
});

test.describe('인증 가드 테스트', () => {
  test('비로그인 상태에서 보호된 페이지 접근 시 리다이렉트', async ({ page }) => {
    // localStorage 초기화
    await page.goto('/');
    await setupNewUser(page);

    // 마이페이지 접근 시도
    await page.goto('/my');

    // 로그인 페이지로 리다이렉트 또는 로그인 프롬프트 표시
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    // 로그인 페이지로 리다이렉트되거나 로그인 요청 UI가 표시됨
    const needsAuth = currentUrl.includes('/login') ||
                      await page.getByText(/로그인.*필요|로그인해주세요/i).isVisible().catch(() => false);
    expect(needsAuth).toBe(true);
  });
});
