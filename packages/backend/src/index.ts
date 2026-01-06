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
import { authRoutes } from './routes/auth';

const app = new Hono();

// 미들웨어
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// 헬스 체크
app.get('/', (c) => c.json({ status: 'ok', service: 'questybook-api' }));
app.get('/health', (c) => c.json({ status: 'healthy' }));

// 라우트
app.route('/api/auth', authRoutes);
app.route('/api/quests', questRoutes);
app.route('/api/plans', planRoutes);
app.route('/api/generate', generateRoutes);
app.route('/api/books', booksRoutes);
app.route('/api/coach', coachRoutes);
app.route('/api/progress', progressRoutes);

// 서버 시작
const port = Number(process.env.PORT) || 3001;

console.log(`🚀 QuestyBook API 서버 시작: http://localhost:${port}`);

serve({ fetch: app.fetch, port });
