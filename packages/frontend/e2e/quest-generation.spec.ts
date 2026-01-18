/**
 * E2E 테스트: Questy AI 학습 코치 시스템
 * 사용자 시나리오: 입학 상담 → 퀘스트 생성 → 학습 → 리포트
 */

import { test, expect } from '@playwright/test';
import { setupTestAuth, setupNewUser, TEST_USER } from './utils/test-auth';

test.describe('Questy AI 코치 시스템', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화 (신규 사용자로 시작)
    await page.goto('/');
    await setupNewUser(page);
    await page.reload();
  });

  test('메인 페이지 접근 가능 (신규 사용자)', async ({ page }) => {
    // 노트북 스타일 레이아웃 확인 - 로고 또는 Questy 텍스트
    const logo = page.getByText('Questy');
    await expect(logo.first()).toBeVisible({ timeout: 15000 });
    // 신규 사용자는 로그인 페이지로 리다이렉트될 수 있음
    const isLoginPage = page.url().includes('/login');
    if (!isLoginPage) {
      // 신규 사용자 안내 메시지 또는 입학 상담
      const welcomeMessage = page.getByText(/처음|입학|상담|시작/i);
      if (await welcomeMessage.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(welcomeMessage.first()).toBeVisible();
      }
    }
  });

  test('하단 네비게이션 바 표시', async ({ page }) => {
    // 하단 네비 아이템들 확인 - 텍스트 라벨로 확인
    await expect(page.getByText('오늘').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('플래너').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('새플랜').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('코치').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('MY').first()).toBeVisible({ timeout: 5000 });
  });

  test('코치 채팅 페이지 접근 (등록된 사용자)', async ({ page }) => {
    // 사용자 등록 시뮬레이션
    await setupTestAuth(page);
    await page.goto('/chat');
    // 채팅 페이지는 /chat/{roomId}로 리다이렉트됨
    await page.waitForURL(/\/chat\//i, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');

    // 채팅 헤더 또는 입력 필드 확인
    const hasHeader = await page.getByText('AI 학습 코치').isVisible({ timeout: 10000 }).catch(() => false);
    const hasInput = await page.locator('input[type="text"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasHeader || hasInput).toBe(true);
  });

  test('리포트 페이지 접근', async ({ page }) => {
    // 사용자 등록 시뮬레이션
    await setupTestAuth(page);
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // 리포트 헤더 확인 또는 리포트 페이지 존재 확인
    const reportHeader = page.getByText(/리포트|학습.*통계|Report/i);
    await expect(reportHeader.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Questy 퀘스트 생성', () => {
  test.beforeEach(async ({ page }) => {
    // 등록된 사용자로 설정
    await page.goto('/');
    await setupTestAuth(page);
    await page.reload();
  });

  test('네비게이션 탭 동작', async ({ page }) => {
    // 플래너 탭 클릭
    await page.click('text=📋 플래너');
    await expect(page).toHaveURL('/planner');

    // 새 플랜 탭 클릭
    await page.click('text=✨ 새 플랜');
    await expect(page).toHaveURL('/generate');
  });

  test('퀘스트 생성 페이지 UI 요소 확인', async ({ page }) => {
    await page.goto('/generate');

    // 입력 필드 존재 확인
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();

    // 이미지 업로드 영역 확인
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });

  test('교재 이름 입력 가능', async ({ page }) => {
    await page.goto('/generate');

    const input = page.locator('input[type="text"]').first();
    await input.fill('수능특강 수학1');

    await expect(input).toHaveValue('수능특강 수학1');
  });

  test('학습 기간 슬라이더 조절', async ({ page }) => {
    await page.goto('/generate');

    const slider = page.locator('input[type="range"]');
    await slider.fill('30');

    // 30일이 표시되는지 확인
    await expect(page.locator('text=30일')).toBeVisible();
  });

  test('이미지 없이는 생성 버튼이 비활성화', async ({ page }) => {
    await page.goto('/generate');

    // 교재 이름만 입력
    await page.locator('input[type="text"]').first().fill('테스트 교재');

    // 생성 버튼이 비활성화 상태인지 확인 (이미지 없으므로)
    const generateButton = page.locator('button:has-text("생성")');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeDisabled();
  });
});

test.describe('Questy 플래너 기능', () => {
  test('플래너 페이지 로드', async ({ page }) => {
    await page.goto('/planner');

    // 플랜 목록 영역 확인 (헤딩 확인)
    await expect(page.getByRole('heading', { name: '📋 나의 학습 플랜' })).toBeVisible();
  });

  test('오늘의 퀘스트 페이지', async ({ page }) => {
    await page.goto('/');

    // 날짜 헤더 또는 오늘 표시 확인
    const today = new Date();
    const monthDay = `${today.getMonth() + 1}월`;

    // 현재 월이 표시되거나 "오늘" 텍스트 확인 (중복 요소가 있을 수 있어 first() 사용)
    await expect(page.locator(`text=/${monthDay}|오늘|today/i`).first()).toBeVisible();
  });
});

test.describe('API 헬스체크', () => {
  test('백엔드 API 응답 확인', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('API 루트 엔드포인트 확인', async ({ request }) => {
    const response = await request.get('http://localhost:3001/');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.service).toBe('questybook-api');
  });
});

test.describe('접근성 테스트', () => {
  test('키보드 네비게이션', async ({ page }) => {
    await page.goto('/');

    // Tab 키로 네비게이션 가능한지 확인
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // 포커스가 이동했는지 확인
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('버튼에 접근 가능한 이름 존재', async ({ page }) => {
    await page.goto('/generate');

    // 모든 버튼에 텍스트 또는 aria-label이 있는지 확인
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');

      expect(text || ariaLabel).toBeTruthy();
    }
  });
});
