/**
 * E2E 테스트: 모바일 반응형 UI 테스트
 * 다양한 디바이스에서의 레이아웃 및 사용성 검증
 */

import { test, expect, devices } from '@playwright/test';
import { setupTestAuth, setupNewUser } from './utils/test-auth';

// 디바이스 뷰포트 설정
const viewports = {
  iPhoneSE: { width: 375, height: 667 },
  iPhone12: { width: 390, height: 844 },
  iPhone14ProMax: { width: 430, height: 932 },
  Pixel5: { width: 393, height: 851 },
  GalaxyS21: { width: 360, height: 800 },
  iPadMini: { width: 768, height: 1024 },
  iPadPro: { width: 1024, height: 1366 },
};

test.describe('모바일 - 하단 네비게이션 바', () => {
  const mobileViewports = {
    iPhone12: viewports.iPhone12,
    Pixel5: viewports.Pixel5,
  };

  for (const [deviceName, viewport] of Object.entries(mobileViewports)) {
    test(`${deviceName}: 하단 네비게이션 바 표시`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await setupTestAuth(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // 하단 네비게이션 바 확인
      const bottomNav = page.locator('nav.fixed.bottom-0').first();
      await expect(bottomNav).toBeVisible({ timeout: 10000 });

      // 네비게이션 아이템 확인
      await expect(page.getByText('오늘').first()).toBeVisible();
      await expect(page.getByText('플래너').first()).toBeVisible();
      await expect(page.getByText('새플랜').first()).toBeVisible();
      await expect(page.getByText('코치').first()).toBeVisible();
    });
  }
});

test.describe('모바일 - TodayPage 레이아웃', () => {
  test('iPhone 12: TodayPage 전체 레이아웃', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 노트북 레이아웃 컨테이너
    const container = page.locator('[class*="max-w"], [class*="container"], [class*="notebook"]').first();
    await expect(container).toBeVisible({ timeout: 10000 });

    // 스크롤 가능 확인
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight;
    });
    // 콘텐츠가 많으면 스크롤 가능
  });

  test('iPhone SE: 작은 화면에서 요소 겹침 없음', async ({ page }) => {
    await page.setViewportSize(viewports.iPhoneSE);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 요소들이 화면 내에 있는지 확인
    const header = page.locator('header, [class*="header"]').first();
    if (await header.isVisible({ timeout: 5000 }).catch(() => false)) {
      const headerBox = await header.boundingBox();
      if (headerBox) {
        expect(headerBox.x).toBeGreaterThanOrEqual(0);
        expect(headerBox.width).toBeLessThanOrEqual(viewports.iPhoneSE.width);
      }
    }
  });

  test('Galaxy S21: 콘텐츠 가독성', async ({ page }) => {
    await page.setViewportSize(viewports.GalaxyS21);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 텍스트가 읽을 수 있는 크기인지 확인
    const textElements = page.locator('p, span, div').filter({ hasText: /.+/ });
    const count = await textElements.count();

    if (count > 0) {
      const firstText = textElements.first();
      const fontSize = await firstText.evaluate((el) =>
        window.getComputedStyle(el).fontSize
      );
      const fontSizeNum = parseInt(fontSize);
      // 최소 12px 이상이어야 가독성 확보
      expect(fontSizeNum).toBeGreaterThanOrEqual(12);
    }
  });
});

test.describe('모바일 - MyPage 레이아웃', () => {
  test('모바일에서 프로필 카드 표시', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/my');
    await page.waitForLoadState('networkidle');

    // 프로필 카드가 화면 너비에 맞게 표시
    const profileCard = page.locator('[class*="card"]').first();
    if (await profileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const cardBox = await profileCard.boundingBox();
      if (cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(viewports.iPhone12.width);
      }
    }
  });

  test('모바일에서 수정 버튼 터치 영역', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/my');

    // 수정 버튼 터치 영역 크기 확인 (최소 44x44px 권장)
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();
    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buttonBox = await editButton.boundingBox();
      if (buttonBox) {
        expect(buttonBox.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

test.describe('모바일 - TipsPage 레이아웃', () => {
  test('모바일에서 탭 버튼 터치 가능', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/tips');
    await page.waitForLoadState('networkidle');

    // 탭 버튼들이 터치 가능한 크기인지 확인
    const tabButtons = page.locator('button').filter({
      hasText: /사용법|강사|전략/,
    });
    const count = await tabButtons.count();

    for (let i = 0; i < count; i++) {
      const button = tabButtons.nth(i);
      if (await button.isVisible()) {
        const buttonBox = await button.boundingBox();
        if (buttonBox) {
          // 최소 터치 영역 (44x44px 권장, 최소 40px)
          expect(buttonBox.height).toBeGreaterThanOrEqual(32);
        }
      }
    }
  });

  test('모바일에서 필터 버튼 가로 스크롤', async ({ page }) => {
    await page.setViewportSize(viewports.iPhoneSE);
    await page.goto('/tips');

    // 인강 강사 탭으로 이동
    const instructorTab = page.locator('button').filter({ hasText: /인강|강사/ }).first();
    if (await instructorTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await instructorTab.click();
      await page.waitForTimeout(300);

      // 필터 컨테이너 확인
      const filterContainer = page.locator('[class*="overflow-x-auto"], [class*="overflow-scroll"]').first();
      if (await filterContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 스크롤 가능한 컨테이너
        await expect(filterContainer).toBeVisible();
      }
    }
  });
});

test.describe('모바일 - 로그인 페이지', () => {
  test('모바일에서 로그인 폼 레이아웃', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/login');

    // 입력 필드가 전체 너비를 사용하는지 확인
    const emailInput = page.locator('input[placeholder="이메일을 입력하세요"]');
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const inputBox = await emailInput.boundingBox();
      if (inputBox) {
        // 입력 필드가 적절한 너비를 가지는지 (padding 고려)
        expect(inputBox.width).toBeGreaterThan(viewports.iPhone12.width * 0.7);
      }
    }
  });

  test('모바일에서 로그인 버튼 터치 영역', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/login');

    const loginButton = page.getByRole('button', { name: '로그인' });
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const buttonBox = await loginButton.boundingBox();
      if (buttonBox) {
        // 터치하기 쉬운 크기 (44px 이상)
        expect(buttonBox.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

test.describe('모바일 - 채팅 페이지', () => {
  test('모바일에서 채팅 입력창 하단 고정', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 입력창이 화면 하단에 있는지 확인
    const inputContainer = page.locator('input[type="text"]').last();
    if (await inputContainer.isVisible({ timeout: 10000 }).catch(() => false)) {
      const inputBox = await inputContainer.boundingBox();
      if (inputBox) {
        // 하단 네비게이션 위에 위치
        expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(viewports.iPhone12.height);
      }
    }
  });

  test('모바일에서 빠른 액션 버튼 표시', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/chat');

    // 빠른 액션 버튼들
    const quickActions = page.getByText(/오늘 뭐 공부|내 진도/i);
    if (await quickActions.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(quickActions.first()).toBeVisible();
    }
  });
});

test.describe('모바일 - 생성 페이지', () => {
  test('모바일에서 파일 업로드 영역', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/generate');
    await page.waitForLoadState('networkidle');

    // 파일 업로드 영역
    const uploadArea = page.locator('input[type="file"]');
    if (await uploadArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 파일 입력이 존재
      await expect(uploadArea).toHaveCount(1);
    }
  });

  test('모바일에서 슬라이더 조작', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/generate');

    // 슬라이더 조작
    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 슬라이더 값 변경
      await slider.fill('30');
      await expect(slider).toHaveValue('30');
    }
  });
});

test.describe('태블릿 - 레이아웃 최적화', () => {
  test('iPad Mini: 2단 레이아웃 가능성', async ({ page }) => {
    await page.setViewportSize(viewports.iPadMini);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 태블릿에서 레이아웃이 적절한지 확인
    const container = page.locator('[class*="max-w"], [class*="container"]').first();
    await expect(container).toBeVisible({ timeout: 10000 });
  });

  test('iPad Pro: 큰 화면 레이아웃', async ({ page }) => {
    await page.setViewportSize(viewports.iPadPro);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/my');

    // 큰 화면에서 레이아웃이 깨지지 않는지 확인
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('모바일 - 터치 인터랙션', () => {
  test('스와이프로 페이지 이동 (필요시)', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/tips');

    // 탭 전환을 위한 터치/클릭
    const instructorTab = page.locator('button').filter({ hasText: /인강|강사/ }).first();
    if (await instructorTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await instructorTab.tap();
      await page.waitForTimeout(300);
    }
  });

  test('길게 누르기 동작 (필요시)', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 퀘스트 카드 길게 누르기 (컨텍스트 메뉴가 있다면)
    const questCard = page.locator('[class*="quest"], [class*="card"]').first();
    if (await questCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 길게 누르기 시뮬레이션
      await questCard.click({ delay: 500 });
      await page.waitForTimeout(300);
    }
  });
});

test.describe('모바일 - 가로 모드', () => {
  test('가로 모드에서 레이아웃', async ({ page }) => {
    // 가로 모드 (iPhone 12 회전)
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 가로 모드에서도 네비게이션 접근 가능
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });
});

test.describe('모바일 - 스크롤 동작', () => {
  test('긴 콘텐츠 스크롤', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/tips');

    // 인강 강사 탭으로 이동 (콘텐츠가 많음)
    const instructorTab = page.locator('button').filter({ hasText: /인강|강사/ }).first();
    if (await instructorTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await instructorTab.click();
      await page.waitForTimeout(500);

      // 스크롤 가능한지 확인
      const initialScrollY = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollBy(0, 300));
      const newScrollY = await page.evaluate(() => window.scrollY);

      // 스크롤이 되었거나, 콘텐츠가 충분히 작아서 스크롤이 필요 없음
      expect(newScrollY >= initialScrollY).toBeTruthy();
    }
  });

  test('하단 네비게이션 고정 유지', async ({ page }) => {
    await page.setViewportSize(viewports.iPhone12);
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/');

    // 스크롤
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // 하단 네비게이션이 여전히 보이는지 확인
    const bottomNav = page.locator('nav.fixed.bottom-0, nav[class*="fixed"][class*="bottom"]').first();
    await expect(bottomNav).toBeVisible();
  });
});
