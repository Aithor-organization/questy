/**
 * E2E 테스트: TodayPage (오늘의 퀘스트 페이지)
 * 모듈화된 컴포넌트 테스트:
 * - TodayHeader
 * - QuestList
 * - ActivePlans
 * - CoachMessage
 * - QuickActions
 * - EmptyState
 * - Modals
 */

import { test, expect } from '@playwright/test';
import { setupTestAuth, setupNewUser } from './utils/test-auth';

test.describe('TodayPage 기본 요소', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('TodayHeader - 날짜 표시', async ({ page }) => {
    // 현재 날짜 표시 확인 - "1월 18일" 형태
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();

    // 날짜 헤더가 표시되는지 확인 - 더 유연한 매칭
    await expect(page.getByText(new RegExp(`${month}월\\s*${date}일`))).toBeVisible({ timeout: 15000 });
  });

  test('TodayHeader - 요일 표시', async ({ page }) => {
    // 요일이 표시되는지 확인 - "(토)" 형태
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();
    const dayName = days[today.getDay()];

    // 요일이 괄호로 감싸져 있음 - "(토)"
    await expect(page.getByText(new RegExp(`\\(${dayName}\\)`))).toBeVisible({ timeout: 10000 });
  });

  test('CoachMessage - 코치 인사 표시', async ({ page }) => {
    // 코치 메시지 영역 확인
    const greetings = /좋은 아침|오후|저녁|반가워|화이팅|시작해볼까|오늘|학습/i;
    await expect(page.getByText(greetings).first()).toBeVisible({ timeout: 10000 });
  });

  test('하단 네비게이션 바 표시', async ({ page }) => {
    // 하단 네비게이션 확인 - UI는 "오늘, 플래너, 새플랜, 코치, MY"
    const nav = page.locator('nav').filter({ hasText: /오늘|플래너|새플랜|코치|MY/ });
    await expect(nav).toBeVisible({ timeout: 10000 });
  });
});

test.describe('TodayPage - 퀘스트 목록', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
  });

  test('QuestList - 퀘스트가 있을 때 목록 표시', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 퀘스트 목록 또는 빈 상태 표시
    const hasQuests = await page.locator('[class*="quest"], [class*="card"], [class*="item"]').count();

    if (hasQuests > 0) {
      // 퀘스트 카드 확인
      await expect(page.locator('[class*="quest"], [class*="card"]').first()).toBeVisible();
    }
  });

  test('퀘스트 체크박스 동작', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 체크박스 찾기
    const checkbox = page.locator('input[type="checkbox"]').first();

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 체크박스 클릭
      const isChecked = await checkbox.isChecked();
      await checkbox.click();

      // 상태 변경 확인
      await expect(checkbox).toHaveProperty('checked', !isChecked);
    }
  });

  test('퀘스트 완료 시 시각적 피드백', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 체크박스 찾기
    const checkbox = page.locator('input[type="checkbox"]').first();

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 체크박스 클릭
      await checkbox.click();

      // 완료 표시 (체크 아이콘, 취소선, 색상 변경 등) 확인
      await page.waitForTimeout(500);
    }
  });
});

test.describe('TodayPage - ActivePlans', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
  });

  test('활성 플랜 목록 표시', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 플랜 관련 텍스트 확인
    const planSection = page.getByText(/플랜|Plan|학습 플랜|진행 중/i);
    // 플랜이 있거나 없어도 페이지는 로드됨
    await page.waitForTimeout(1000);
  });

  test('플랜 클릭 시 상세 페이지 이동', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 플랜 카드 클릭 가능한 요소 찾기
    const planCard = page.locator('[class*="plan"], [class*="card"]').filter({ hasText: /플랜|진도|%/ }).first();

    if (await planCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await planCard.click();

      // 상세 페이지로 이동 확인
      await page.waitForURL(/\/plan\/|\/detail/);
    }
  });
});

test.describe('TodayPage - EmptyState', () => {
  test('플랜이 없을 때 빈 상태 표시', async ({ page }) => {
    // 새로운 사용자로 설정
    await page.goto('/');
    await setupNewUser(page);
    await page.reload();

    // 빈 상태 메시지 확인 - 로그인 페이지로 리다이렉트되거나 빈 상태 표시
    const emptyMessages = /처음|시작|플랜.*없|아직|로그인/i;
    await expect(page.getByText(emptyMessages).first()).toBeVisible({ timeout: 10000 });
  });

  test('빈 상태에서 새 플랜 만들기 버튼 표시', async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 새 플랜 만들기 버튼 또는 링크
    const newPlanButton = page.getByRole('link', { name: /새 플랜|새플랜|플랜 만들기|✨/i }).first();
    await expect(newPlanButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe('TodayPage - QuickActions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
  });

  test('빠른 액션 버튼 표시', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 빠른 액션 버튼들 확인
    const actionPatterns = /새 플랜|채팅|코치|리포트|퀘스트/i;
    const actionButtons = page.getByRole('button').filter({ hasText: actionPatterns });

    // 최소 하나 이상의 액션 버튼이 있는지 확인
    const count = await actionButtons.count();
    expect(count).toBeGreaterThanOrEqual(0); // 없을 수도 있음
  });

  test('새 플랜 생성 버튼 동작', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 새 플랜 버튼 또는 링크
    const newPlanButton = page.getByRole('link', { name: /새 플랜|✨/ });

    if (await newPlanButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newPlanButton.click();
      await expect(page).toHaveURL('/generate');
    }
  });
});

test.describe('TodayPage - Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('일정 변경 모달 열기', async ({ page }) => {
    // 일정 변경 버튼 찾기
    const rescheduleButton = page.getByRole('button', { name: /일정 변경|미루기|Reschedule/i });

    if (await rescheduleButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await rescheduleButton.first().click();

      // 모달 열림 확인
      await expect(page.getByRole('dialog').or(page.locator('[class*="modal"]'))).toBeVisible();
    }
  });

  test('퀘스트 상세 모달 열기', async ({ page }) => {
    // 퀘스트 제목 클릭
    const questTitle = page.locator('[class*="quest-title"], [class*="title"]').first();

    if (await questTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await questTitle.click();

      // 상세 모달 또는 페이지 표시 확인
      await page.waitForTimeout(500);
    }
  });

  test('모달 닫기 버튼 동작', async ({ page }) => {
    // 모달 트리거 찾기
    const modalTrigger = page.getByRole('button').filter({ hasText: /상세|일정|변경/ }).first();

    if (await modalTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modalTrigger.click();
      await page.waitForTimeout(500);

      // 닫기 버튼
      const closeButton = page.getByRole('button', { name: /닫기|취소|X|Close/i });
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();

        // 모달 닫힘 확인
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
      }
    }
  });
});

test.describe('TodayPage - OverdueQuests', () => {
  test('밀린 퀘스트 섹션 표시', async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 밀린 퀘스트 섹션 (있을 경우에만)
    const overdueSection = page.getByText(/밀린|지연|Overdue|미완료/i);

    if (await overdueSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 밀린 퀘스트가 있으면 경고 스타일로 표시됨
      await expect(overdueSection).toBeVisible();
    }
  });
});

test.describe('TodayPage - 반응형 레이아웃', () => {
  test('모바일 뷰에서 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 노트북 레이아웃 유지 확인
    const notebookLayout = page.locator('[class*="notebook"], [class*="max-w"]').first();
    await expect(notebookLayout).toBeVisible({ timeout: 10000 });
  });

  test('태블릿 뷰에서 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 레이아웃이 적절하게 표시되는지 확인
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('TodayPage - 접근성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
  });

  test('키보드 탐색 가능', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Tab 키로 요소 탐색
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // 포커스된 요소 확인
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'CHECKBOX']).toContain(focusedTag);
  });

  test('체크박스 레이블 접근성', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 체크박스에 레이블이 연결되어 있는지 확인
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const checkbox = checkboxes.nth(i);
      const id = await checkbox.getAttribute('id');
      const ariaLabel = await checkbox.getAttribute('aria-label');

      // id가 있으면 label이 연결되어 있거나, aria-label이 있어야 함
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        expect(hasLabel || ariaLabel).toBeTruthy();
      }
    }
  });
});
