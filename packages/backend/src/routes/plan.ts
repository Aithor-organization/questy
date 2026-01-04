import { Hono } from 'hono';
import { CreatePlanRequestSchema, StudyPlan } from '@questybook/shared';
import { generateStudyPlan } from '../services/quest-generator';

export const planRoutes = new Hono();

// 임시 저장소 (추후 DB로 교체)
const plans: Map<string, StudyPlan> = new Map();

// 학습 계획 생성
planRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePlanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: '잘못된 요청 형식입니다',
        details: parsed.error.issues,
      }, 400);
    }

    const plan = await generateStudyPlan(parsed.data);
    plans.set(plan.id, plan);

    return c.json({ success: true, data: plan });
  } catch (error) {
    console.error('계획 생성 오류:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '계획 생성 실패',
    }, 500);
  }
});

// 모든 계획 조회
planRoutes.get('/', (c) => {
  const allPlans = Array.from(plans.values());
  return c.json({ success: true, data: allPlans });
});

// 특정 계획 조회
planRoutes.get('/:id', (c) => {
  const plan = plans.get(c.req.param('id'));

  if (!plan) {
    return c.json({ success: false, error: '계획을 찾을 수 없습니다' }, 404);
  }

  return c.json({ success: true, data: plan });
});

// 계획 삭제
planRoutes.delete('/:id', (c) => {
  const id = c.req.param('id');

  if (!plans.has(id)) {
    return c.json({ success: false, error: '계획을 찾을 수 없습니다' }, 404);
  }

  plans.delete(id);
  return c.json({ success: true });
});
