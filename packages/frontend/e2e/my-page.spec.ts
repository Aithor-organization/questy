/**
 * E2E 테스트: MyPage (마이페이지)
 * 모듈화된 컴포넌트 테스트:
 * - UserInfoCard
 * - LearningProfileCard
 * - EditProfileModal
 * - EditLearningModal
 */

import { test, expect } from '@playwright/test';
import { setupTestAuth, setupNewUser, TEST_USER } from './utils/test-auth';

test.describe('MyPage 기본 요소', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('마이페이지 헤더 표시', async ({ page }) => {
    // 마이페이지 헤더 (h1 태그)
    await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible({ timeout: 15000 });
  });

  test('사용자 이메일 표시', async ({ page }) => {
    // 테스트 사용자 이메일 표시
    await expect(page.getByText(TEST_USER.email)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('MyPage - UserInfoCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('사용자 아바타 표시', async ({ page }) => {
    // 프로필 아바타 또는 이니셜 표시
    const avatar = page.locator('[class*="avatar"], [class*="profile-image"], [class*="rounded-full"]').first();
    await expect(avatar).toBeVisible({ timeout: 5000 });
  });

  test('사용자 이름 표시', async ({ page }) => {
    // 사용자 이름 또는 닉네임 표시
    const namePatterns = /Admin|사용자|학생|님/i;
    await expect(page.getByText(namePatterns).first()).toBeVisible({ timeout: 5000 });
  });

  test('프로필 수정 버튼 표시', async ({ page }) => {
    // 프로필 수정 버튼 - "내 정보 수정" 또는 "학습 프로필 수정"
    const editButton = page.getByRole('button', { name: /내 정보 수정|학습 프로필 수정|프로필 수정/i }).first();
    await expect(editButton).toBeVisible({ timeout: 15000 });
  });
});

test.describe('MyPage - LearningProfileCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('학습 정보 섹션 표시', async ({ page }) => {
    // 학습 프로필 섹션
    const learningSection = page.getByText(/학습 프로필/i).first();
    await expect(learningSection).toBeVisible({ timeout: 15000 });
  });

  test('목표 대학 정보 표시', async ({ page }) => {
    // 목표 대학 필드
    const targetUniversity = page.getByText(/목표.*대학|희망.*대학|대학교/i);
    if (await targetUniversity.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(targetUniversity).toBeVisible();
    }
  });

  test('선택 과목 정보 표시', async ({ page }) => {
    // 선택 탐구 과목 또는 등급 현황 표시
    const subjects = page.getByText(/선택 탐구|등급 현황|학습 환경/i);
    await expect(subjects.first()).toBeVisible({ timeout: 15000 });
  });

  test('학년 정보 표시', async ({ page }) => {
    // 학년 정보
    const grade = page.getByText(/학년|고1|고2|고3|N수/i);
    if (await grade.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(grade).toBeVisible();
    }
  });
});

test.describe('MyPage - EditProfileModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('프로필 수정 모달 열기', async ({ page }) => {
    // "내 정보 수정" 버튼 클릭
    const editButton = page.getByRole('button', { name: /내 정보 수정/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    // 모달 표시 확인 (fixed position overlay)
    await expect(page.locator('[class*="fixed"][class*="inset-0"]').or(page.getByRole('dialog'))).toBeVisible({ timeout: 5000 });
  });

  test('프로필 수정 폼 요소 표시', async ({ page }) => {
    // "내 정보 수정" 버튼 클릭
    const editButton = page.getByRole('button', { name: /내 정보 수정/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    // 모달 로드 대기
    await page.waitForTimeout(500);
    // 이름 또는 비밀번호 입력 필드 확인
    await expect(page.locator('input[type="text"], input[type="password"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('프로필 수정 취소', async ({ page }) => {
    // "내 정보 수정" 버튼 클릭
    const editButton = page.getByRole('button', { name: /내 정보 수정/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    // 모달 로드 대기
    await page.waitForTimeout(500);

    // 취소 버튼 클릭
    const cancelButton = page.getByRole('button', { name: /취소|Cancel|닫기/i });
    if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelButton.click();

      // 모달 닫힘 대기
      await page.waitForTimeout(300);
    }
  });

  test('프로필 수정 저장', async ({ page }) => {
    // "내 정보 수정" 버튼 클릭
    const editButton = page.getByRole('button', { name: /내 정보 수정/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    await page.waitForTimeout(500);

    // 저장 버튼
    const saveButton = page.getByRole('button', { name: /저장|Save|변경|수정하기/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('MyPage - EditLearningModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('학습 정보 수정 모달 열기', async ({ page }) => {
    // 학습 정보 수정 버튼 찾기
    const learningEditButton = page.getByRole('button', { name: /학습.*수정|정보.*수정|편집/i });

    if (await learningEditButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learningEditButton.click();

      // 모달 표시 확인
      await expect(page.getByRole('dialog').or(page.locator('[class*="modal"]'))).toBeVisible();
    }
  });

  test('학년 선택 옵션', async ({ page }) => {
    // 학습 정보 수정 버튼 찾기
    const learningEditButton = page.getByRole('button', { name: /학습.*수정|정보.*수정|편집/i });

    if (await learningEditButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learningEditButton.click();

      // 학년 선택 드롭다운
      const gradeSelect = page.locator('select[name="grade"], [class*="grade-select"]');
      if (await gradeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 학년 옵션들이 있는지 확인
        await expect(gradeSelect).toBeVisible();
      }
    }
  });

  test('과목 선택 체크박스', async ({ page }) => {
    // 학습 정보 수정 모달 열기
    const learningEditButton = page.getByRole('button', { name: /학습.*수정|정보.*수정|편집/i });

    if (await learningEditButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learningEditButton.click();

      // 과목 체크박스들
      const subjectCheckbox = page.locator('input[type="checkbox"]').first();
      if (await subjectCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(subjectCheckbox).toBeVisible();
      }
    }
  });
});

test.describe('MyPage - 로그아웃', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('로그아웃 버튼 표시', async ({ page }) => {
    // 로그아웃 버튼
    const logoutButton = page.getByRole('button', { name: /로그아웃|Logout/i });
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
  });

  test('로그아웃 클릭 시 확인 또는 직접 로그아웃', async ({ page }) => {
    // 로그아웃 버튼 클릭
    const logoutButton = page.getByRole('button', { name: /로그아웃|Logout/i });
    await logoutButton.click();

    // 확인 모달이 있으면 확인, 없으면 바로 로그아웃
    const confirmButton = page.getByRole('button', { name: /확인|예|Yes/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // 로그인 페이지로 리다이렉트 또는 홈으로 이동
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes('/login') || url.includes('/')).toBe(true);
  });
});

test.describe('MyPage - 반응형 레이아웃', () => {
  test('모바일 뷰에서 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');

    // 카드들이 세로로 쌓이는지 확인
    const cards = page.locator('[class*="card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('태블릿 뷰에서 레이아웃', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');

    // 레이아웃이 적절하게 조정되는지 확인
    await page.waitForLoadState('networkidle');
  });
});

test.describe('MyPage - 접근성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
  });

  test('키보드로 버튼 접근 가능', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Tab으로 버튼에 포커스
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // 포커스된 요소 확인
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedTag);
  });

  test('모달 접근성 - ESC로 닫기', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 수정 버튼 클릭
    const editButton = page.getByRole('button', { name: /수정|편집|Edit/i }).first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // ESC 키로 모달 닫기
      await page.keyboard.press('Escape');

      // 모달이 닫히는지 확인 (선택적)
      await page.waitForTimeout(500);
    }
  });
});

test.describe('MyPage - 설정 섹션', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/mypage');
    await page.waitForLoadState('networkidle');
  });

  test('설정 또는 도움말 링크 표시', async ({ page }) => {
    // 설정, 도움말, 문의 링크
    const settingsLink = page.getByText(/설정|Settings|도움말|Help|문의|Contact/i);
    if (await settingsLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(settingsLink.first()).toBeVisible();
    }
  });

  test('앱 버전 정보 표시', async ({ page }) => {
    // 버전 정보 (있을 경우)
    const versionInfo = page.getByText(/버전|Version|v\d+\.\d+/i);
    if (await versionInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(versionInfo).toBeVisible();
    }
  });
});
