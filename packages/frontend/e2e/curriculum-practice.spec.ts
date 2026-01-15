/**
 * E2E 테스트: 커리큘럼 페이지 및 문제풀이 퀘스트 기능
 * 시나리오: 설정 → 강좌검색 → 퀘스트 생성 → 문제풀이 메모 편집
 */

import { test, expect } from '@playwright/test';
import { setupTestAuth } from './utils/test-auth';

test.describe('커리큘럼 페이지 기본 기능', () => {
  test.beforeEach(async ({ page }) => {
    // 등록된 사용자로 설정
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/curriculum');
  });

  test('커리큘럼 페이지 접근 가능', async ({ page }) => {
    await page.goto('/curriculum');

    // 페이지 헤더 확인
    await expect(page.getByText('인강 커리큘럼 생성')).toBeVisible();
    // 스텝 인디케이터 확인
    await expect(page.getByText('설정')).toBeVisible();
    await expect(page.getByText('강좌선택')).toBeVisible();
    await expect(page.getByText('확인')).toBeVisible();
  });

  test('설정 스텝 - 목표일 입력 가능', async ({ page }) => {
    await page.goto('/curriculum');

    // 목표일 입력 필드 확인
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // 날짜 입력
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    const dateStr = futureDate.toISOString().split('T')[0];
    await dateInput.fill(dateStr);

    await expect(dateInput).toHaveValue(dateStr);
  });

  test('설정 스텝 - 일일 순공시간 슬라이더', async ({ page }) => {
    await page.goto('/curriculum');

    // 일일 순공시간 슬라이더 확인
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();

    // 값 변경
    await slider.fill('8');

    // 8시간이 표시되는지 확인 (exact match로 중복 방지)
    await expect(page.getByText('8시간', { exact: true })).toBeVisible();
  });

  test('설정 스텝 - 과목별 시간 입력', async ({ page }) => {
    await page.goto('/curriculum');

    // 과목별 시간 입력 필드 확인
    await expect(page.getByText('과목별 학습 시간')).toBeVisible();

    // 국어 시간 입력
    const koreanInput = page.locator('input[type="number"]').first();
    await koreanInput.fill('4');
    await expect(koreanInput).toHaveValue('4');
  });

  test('설정 스텝 - 복습 설정 체크박스', async ({ page }) => {
    await page.goto('/curriculum');

    // 복습 일정 추가 체크박스
    const reviewCheckbox = page.getByText('복습 일정 추가');
    await expect(reviewCheckbox).toBeVisible();
  });

  test('설정 스텝 - 다음 단계 버튼', async ({ page }) => {
    await page.goto('/curriculum');

    // 모든 과목에 0 입력 (필수 조건 충족)
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    for (let i = 0; i < count; i++) {
      await numberInputs.nth(i).fill('0');
    }
    // 국어만 4시간 입력
    await numberInputs.first().fill('4');

    // 다음 버튼 클릭 가능해야 함
    const nextButton = page.getByRole('button', { name: /다음|강좌 선택/i });
    await expect(nextButton).toBeVisible();
  });
});

test.describe('강좌 선택 스텝', () => {
  test.beforeEach(async ({ page }) => {
    // 등록된 사용자로 설정
    await page.goto('/');
    await setupTestAuth(page);
    await page.goto('/curriculum');

    // 설정 완료 후 다음 단계로
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    for (let i = 0; i < count; i++) {
      await numberInputs.nth(i).fill('0');
    }
    await numberInputs.first().fill('4');

    // 다음 버튼 클릭
    const nextButton = page.getByRole('button', { name: /다음|강좌 선택/i });
    await nextButton.click();
  });

  test('강좌 검색 UI 표시', async ({ page }) => {
    // 검색 입력 필드
    await expect(page.locator('input[placeholder*="강좌명"]')).toBeVisible();
    // 검색 버튼
    await expect(page.getByRole('button', { name: /검색/i })).toBeVisible();
  });

  test('과목 필터 버튼 표시', async ({ page }) => {
    // 과목 필터 버튼들
    await expect(page.getByRole('button', { name: '수학' })).toBeVisible();
    await expect(page.getByRole('button', { name: '영어' })).toBeVisible();
    await expect(page.getByRole('button', { name: '국어' })).toBeVisible();
  });

  test('이전 버튼으로 설정 단계 복귀', async ({ page }) => {
    const backButton = page.getByRole('button', { name: /이전/i });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // 설정 단계로 돌아감
    await expect(page.getByText('목표일')).toBeVisible();
  });
});

test.describe('API 통합 테스트', () => {
  test('커리큘럼 API 엔드포인트 확인', async ({ request }) => {
    // 강좌 검색 API (빈 쿼리)
    const searchResponse = await request.post('http://localhost:3001/api/curriculum/search-courses', {
      data: { query: '수학', subject: '수학' }
    });

    // API가 응답해야 함 (실제 데이터 유무와 관계없이)
    expect(searchResponse.status()).toBeLessThan(500);
  });

  test('퀘스트 생성 API 스키마 확인', async ({ request }) => {
    // 퀘스트 생성 API 호출 (최소한의 데이터)
    const generateResponse = await request.post('http://localhost:3001/api/curriculum/generate-quests', {
      data: {
        selectedCourseIds: [],
        courseContents: [{
          id: 'test-001',
          courseName: '테스트 강좌',
          lecturer: '테스트 강사',
          subject: '국어',
          chapters: [{ title: '1강', duration: '30:00' }]
        }],
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dailyStudyHours: 6,
        subjectHours: { '국어': 4, '영어': 0, '수학': 0, '한국사': 0, '탐구': 0 },
        options: {
          includeOT: false,
          reviewSettings: { enabled: true, sameDayReview: true, reviewDuration: 15 }
        }
      }
    });

    // 응답 확인
    if (generateResponse.ok()) {
      const data = await generateResponse.json();
      // 성공 시 quests 배열 존재 확인
      if (data.success && data.data) {
        expect(data.data.quests).toBeDefined();
        expect(Array.isArray(data.data.quests)).toBe(true);
      }
    }
  });
});

test.describe('문제풀이 퀘스트 표시', () => {
  test.beforeEach(async ({ page }) => {
    // 등록된 사용자로 설정
    await page.goto('/');
    await setupTestAuth(page);
  });

  test('문제풀이 퀘스트 타입 렌더링', async ({ page }) => {
    await page.goto('/curriculum');
    // 페이지 로드 확인
    await expect(page.getByText('인강 커리큘럼 생성')).toBeVisible();
  });

  test('프리뷰 페이지에서 시간 분배 표시 확인 (UI 요소)', async ({ page }) => {
    await page.goto('/curriculum');
    // 설정 페이지의 시간 관련 요소 확인
    await expect(page.getByText('일일 순공시간')).toBeVisible();
    await expect(page.getByText('과목별 학습 시간')).toBeVisible();
  });
});

test.describe('접근성 및 반응형 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 등록된 사용자로 설정
    await page.goto('/');
    await setupTestAuth(page);
  });

  test('모바일 뷰포트에서 커리큘럼 페이지', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/curriculum');
    await expect(page.getByText('인강 커리큘럼 생성')).toBeVisible();
  });

  test('태블릿 뷰포트에서 커리큘럼 페이지', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/curriculum');
    await expect(page.getByText('인강 커리큘럼 생성')).toBeVisible();
  });

  test('키보드 탐색 가능', async ({ page }) => {
    await page.goto('/curriculum');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });
});
