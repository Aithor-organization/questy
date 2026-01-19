// Questy Backend Server
// Build: 2026-01-18-v4 - Fix TypeScript error in coach-agent
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import { questRoutes } from './routes/quest';
import { planRoutes } from './routes/plan';
import { generateRoutes } from './routes/generate';
import booksRoutes from './routes/books';
import { coachRoutes } from './routes/coach';
import { progressRoutes } from './routes/progress';
// auth는 Supabase Auth로 이전됨 (프론트엔드에서 직접 처리)
import { curriculumRoutes } from './routes/curriculum';
import { adminRoutes } from './routes/admin';
import { adminUsersRoutes } from './routes/admin-users';
import { inquiryRoutes } from './routes/inquiries';
import { cronRoutes } from './routes/cron';

const app = new Hono();

// 미들웨어
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] INCOMING: ${c.req.method} ${c.req.url}`);
  await next();
});
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: false, // origin: '*' 사용 시 credentials: false 필요
}));

// 헬스 체크
app.get('/', (c) => c.json({ status: 'ok', service: 'questy-api' }));
app.get('/health', (c) => c.json({ status: 'healthy' }));

// 라우트 (auth는 Supabase Auth 사용)
app.route('/api/quests', questRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/generate', generateRoutes);
app.route('/api/books', booksRoutes);
app.route('/api/coach', coachRoutes);
app.route('/api/progress', progressRoutes);
app.route('/api/curriculum', curriculumRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin', adminUsersRoutes);
app.route('/api/inquiries', inquiryRoutes);
app.route('/api/cron', cronRoutes);

// 서버 시작
const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Questy API 서버 시작: http://localhost:${port}`);

serve({ fetch: app.fetch, port });
