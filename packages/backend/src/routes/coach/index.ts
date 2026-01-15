/**
 * Coach Routes - Main Router
 * 모든 코치 라우트 통합
 *
 * 기존 coach.ts (1996줄)를 ~150줄 내외의 모듈로 분리:
 * - types.ts: Zod 스키마 및 타입 정의
 * - singletons.ts: Supervisor/AutoRescheduler 싱글톤
 * - utils.ts: 유틸리티 함수
 * - students.ts: 학생 관리 라우트
 * - chat.ts: 채팅/입학상담 라우트
 * - plans.ts: 플랜 관리 라우트
 * - quests.ts: 퀘스트/오늘의 학습 라우트
 * - reports.ts: 리포트/메모리/번아웃 체크
 * - delays.ts: 스케줄 밀림 처리
 * - interventions.ts: 리마인더/저녁리뷰/위기개입
 * - scheduler.ts: 자동 일정 재조정
 * - level-test.ts: 레벨 테스트
 * - class-assignment.ts: 반 배정/오리엔테이션
 */

import { Hono } from 'hono';
import { studentRoutes } from './students.js';
import { chatRoutes } from './chat.js';
import { planRoutes } from './plans.js';
import { questRoutes } from './quests.js';
import { reportRoutes } from './reports.js';
import { delayRoutes } from './delays.js';
import { interventionRoutes } from './interventions.js';
import { schedulerRoutes } from './scheduler.js';
import { levelTestRoutes } from './level-test.js';
import { classAssignmentRoutes } from './class-assignment.js';

export const coachRoutes = new Hono();

// ===================== 학생 관리 =====================
// POST /students - 학생 생성
// GET /students/:studentId - 학생 정보 조회
// PATCH /students/:studentId - 학생 프로필 업데이트
coachRoutes.route('/students', studentRoutes);

// ===================== 채팅 =====================
// POST /chat - 코치와 대화
// POST /chat/admission - 입학 상담 채팅 (기존: /admission/chat)
coachRoutes.route('/chat', chatRoutes);

// 기존 경로 호환성 유지
coachRoutes.post('/admission/chat', async (c) => {
  // chatRoutes의 /admission으로 리다이렉트
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/admission/chat', '/chat/admission');
  return chatRoutes.fetch(new Request(url, c.req.raw));
});

// ===================== 플랜 관리 =====================
// POST /plans - 플랜 생성
// GET /plans/:planId - 플랜 상세 조회
// PATCH /plans/:planId/progress - 플랜 진행 업데이트
coachRoutes.route('/plans', planRoutes);

// 학생의 플랜 목록 조회 (기존 경로 유지)
coachRoutes.get('/students/:studentId/plans', async (c) => {
  const studentId = c.req.param('studentId');
  const newUrl = `/quests/plans/${studentId}`;
  return questRoutes.fetch(new Request(new URL(newUrl, c.req.url), c.req.raw));
});

// ===================== 퀘스트/오늘의 학습 =====================
coachRoutes.get('/students/:studentId/today', async (c) => {
  const studentId = c.req.param('studentId');
  return questRoutes.fetch(
    new Request(new URL(`/quests/today/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.post('/students/:studentId/quests/:questId/complete', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  return questRoutes.fetch(
    new Request(
      new URL(`/quests/${questId}/complete/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers }
    )
  );
});

// ===================== 리포트/메모리 =====================
coachRoutes.get('/students/:studentId/report/weekly', async (c) => {
  const studentId = c.req.param('studentId');
  return reportRoutes.fetch(
    new Request(new URL(`/reports/weekly/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.get('/students/:studentId/memories', async (c) => {
  const studentId = c.req.param('studentId');
  return reportRoutes.fetch(
    new Request(new URL(`/reports/memories/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.get('/students/:studentId/burnout-check', async (c) => {
  const studentId = c.req.param('studentId');
  return reportRoutes.fetch(
    new Request(new URL(`/reports/burnout-check/${studentId}`, c.req.url), c.req.raw)
  );
});

// ===================== 스케줄 밀림 =====================
coachRoutes.get('/students/:studentId/delays', async (c) => {
  const studentId = c.req.param('studentId');
  return delayRoutes.fetch(
    new Request(new URL(`/delays/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.get('/students/:studentId/notifications', async (c) => {
  const studentId = c.req.param('studentId');
  return delayRoutes.fetch(
    new Request(new URL(`/delays/notifications/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.post('/students/:studentId/notifications/:notificationId/dismiss', async (c) => {
  const studentId = c.req.param('studentId');
  const notificationId = c.req.param('notificationId');
  return delayRoutes.fetch(
    new Request(
      new URL(`/delays/notifications/${studentId}/${notificationId}/dismiss`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

coachRoutes.post('/students/:studentId/delays/reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  return delayRoutes.fetch(
    new Request(
      new URL(`/delays/reschedule/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

// ===================== 인터벤션 =====================
coachRoutes.post('/students/:studentId/evening-review', async (c) => {
  const studentId = c.req.param('studentId');
  return interventionRoutes.fetch(
    new Request(
      new URL(`/interventions/evening-review/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers }
    )
  );
});

coachRoutes.get('/students/:studentId/missed-study', async (c) => {
  const studentId = c.req.param('studentId');
  return interventionRoutes.fetch(
    new Request(new URL(`/interventions/missed-study/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.post('/students/:studentId/reminder', async (c) => {
  const studentId = c.req.param('studentId');
  return interventionRoutes.fetch(
    new Request(
      new URL(`/interventions/reminder/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

coachRoutes.post('/students/:studentId/crisis-intervention', async (c) => {
  const studentId = c.req.param('studentId');
  return interventionRoutes.fetch(
    new Request(
      new URL(`/interventions/crisis/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers }
    )
  );
});

// ===================== 자동 일정 재조정 =====================
coachRoutes.post('/students/:studentId/auto-reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  return schedulerRoutes.fetch(
    new Request(
      new URL(`/scheduler/batch/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

coachRoutes.post('/students/:studentId/quests/:questId/auto-reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  return schedulerRoutes.fetch(
    new Request(
      new URL(`/scheduler/single/${studentId}/${questId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

// ===================== 레벨 테스트 =====================
coachRoutes.post('/students/:studentId/level-test/start', async (c) => {
  const studentId = c.req.param('studentId');
  return levelTestRoutes.fetch(
    new Request(
      new URL(`/level-test/start/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

coachRoutes.post('/students/:studentId/level-test/submit', async (c) => {
  const studentId = c.req.param('studentId');
  return levelTestRoutes.fetch(
    new Request(
      new URL(`/level-test/submit/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

// ===================== 반 배정/오리엔테이션 =====================
coachRoutes.get('/students/:studentId/class-options', async (c) => {
  const studentId = c.req.param('studentId');
  const subject = c.req.query('subject');
  const url = new URL(`/class/options/${studentId}`, c.req.url);
  if (subject) url.searchParams.set('subject', subject);
  return classAssignmentRoutes.fetch(new Request(url, c.req.raw));
});

coachRoutes.post('/students/:studentId/class-assign', async (c) => {
  const studentId = c.req.param('studentId');
  return classAssignmentRoutes.fetch(
    new Request(
      new URL(`/class/assign/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});

coachRoutes.post('/students/:studentId/orientation/start', async (c) => {
  const studentId = c.req.param('studentId');
  return classAssignmentRoutes.fetch(
    new Request(
      new URL(`/class/orientation/start/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers }
    )
  );
});

coachRoutes.get('/students/:studentId/orientation', async (c) => {
  const studentId = c.req.param('studentId');
  return classAssignmentRoutes.fetch(
    new Request(new URL(`/class/orientation/${studentId}`, c.req.url), c.req.raw)
  );
});

coachRoutes.post('/students/:studentId/orientation/complete-step', async (c) => {
  const studentId = c.req.param('studentId');
  return classAssignmentRoutes.fetch(
    new Request(
      new URL(`/class/orientation/complete-step/${studentId}`, c.req.url),
      { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }
    )
  );
});
