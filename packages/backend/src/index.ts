import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import 'dotenv/config';

import { questRoutes } from './routes/quest';
import { planRoutes } from './routes/plan';
import { generateRoutes } from './routes/generate';
import booksRoutes from './routes/books';

const app = new Hono();

// 미들웨어
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] INCOMING: ${c.req.method} ${c.req.url}`);
  await next();
});
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin, // 개발/데모용으로 모든 Origin 허용
  credentials: true,
}));

// 헬스 체크
app.get('/', (c) => c.json({ status: 'ok', service: 'questybook-api' }));
app.get('/health', (c) => c.json({ status: 'healthy' }));

// 라우트
app.route('/api/quests', questRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/generate', generateRoutes);
app.route('/api/books', booksRoutes);

// 서버 시작
const port = Number(process.env.PORT) || 3001;

console.log(`🚀 QuestyBook API 서버 시작: http://localhost:${port}`);

serve({ fetch: app.fetch, port });
