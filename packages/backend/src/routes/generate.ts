import { Hono } from 'hono';
import { z } from 'zod';
import { analyzeTableOfContents, DetectedStudyPlan, AnalyzedUnit } from '../lib/image-analyzer';
import { generateDualPlans, generateQuestsWithAI, AIGeneratedQuest } from '../lib/ai-quest-generator';
import { reviewPlanWithAI } from '../lib/ai-plan-reviewer';

export const generateRoutes = new Hono();

// 요청 스키마 정의 (여러 이미지 지원)
const ImageSchema = z.object({
  base64: z.string().min(1),
  type: z.enum(['jpg', 'png']),
});

// 교재 메타데이터 스키마 (수능 학습용)
const BookMetadataSchema = z.object({
  subject: z.string().optional(), // 과목: 수학, 국어, 영어 등
  targetGrade: z.string().optional(), // 대상: 고1, 고2, 고3, N수생
  bookType: z.string().optional(), // 유형: 개념서, 유형서, 기출문제집
  category: z.string().optional(), // Yes24 카테고리
  description: z.string().optional(), // 간략 설명
});

const GenerateRequestSchema = z.object({
  materialName: z.string().min(1, '교재 이름을 입력해주세요').max(100),
  images: z.array(ImageSchema).min(1, '이미지를 1장 이상 업로드해주세요').max(4, '최대 4장까지 업로드 가능합니다'),
  totalDays: z.number().int().positive('목표 기간은 1일 이상이어야 합니다'),
  bookMetadata: BookMetadataSchema.optional(), // 교재 메타데이터 (선택적)
  excludeWeekends: z.boolean().optional(), // 주말 미포함 옵션
  startDate: z.string().optional(), // 시작 날짜 (YYYY-MM-DD)
});

generateRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // 요청 검증
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: firstError?.message || '잘못된 요청입니다',
        },
      }, 400);
    }

    const { materialName, images, totalDays, bookMetadata, excludeWeekends, startDate } = parsed.data;

    // 1. 모든 이미지 분석 (병렬 처리)
    console.log(`[Generate] Analyzing ${images.length} images for: ${materialName}`);

    const analysisResults = await Promise.all(
      images.map((img) => analyzeTableOfContents(img.base64, img.type, materialName))
    );

    // 모든 분석 결과 병합 및 중복 제거
    const allUnits = analysisResults.flatMap((r) => r.units);
    const uniqueUnits = allUnits.reduce((acc, unit) => {
      const exists = acc.find((u) => u.unitNumber === unit.unitNumber);
      if (!exists) {
        acc.push(unit);
      }
      return acc;
    }, [] as typeof allUnits);

    // 단원 번호 순으로 정렬
    uniqueUnits.sort((a, b) => a.unitNumber - b.unitNumber);

    // 학습계획표 병합 (가장 많은 일정을 가진 것 선택)
    const detectedStudyPlans = analysisResults
      .map((r) => r.studyPlan)
      .filter((sp) => sp.hasSchedule);

    const mergedStudyPlan: DetectedStudyPlan = detectedStudyPlans.length > 0
      ? detectedStudyPlans.reduce((best, current) =>
        current.scheduleItems.length > best.scheduleItems.length ? current : best
      )
      : { hasSchedule: false, totalDays: 0, scheduleItems: [], source: '' };

    if (uniqueUnits.length === 0) {
      return c.json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: '이미지에서 단원 정보를 추출할 수 없습니다. 목차가 명확하게 보이는 이미지를 사용해주세요.',
        },
      }, 400);
    }

    console.log(`[Generate] Analyzed ${uniqueUnits.length} unique units from ${images.length} images`);
    if (mergedStudyPlan.hasSchedule) {
      console.log(`[Generate] Detected study plan: ${mergedStudyPlan.source} (${mergedStudyPlan.totalDays} days)`);
    }

    // 분석된 단원에서 시작/끝 단원 자동 계산
    const unitNumbers = uniqueUnits.map((u) => u.unitNumber);
    const startUnit = Math.min(...unitNumbers);
    const endUnit = Math.max(...unitNumbers);

    // 2. 듀얼 플랜 생성 (학습계획표가 있으면 2개, 없으면 1개)
    console.log(`[Generate] Generating plans with AI... (Unit ${startUnit}~${endUnit})`);
    if (bookMetadata) {
      console.log(`[Generate] Book metadata: ${bookMetadata.subject || '-'} / ${bookMetadata.targetGrade || '-'} / ${bookMetadata.bookType || '-'}`);
    }
    const dualResult = await generateDualPlans(
      uniqueUnits,
      mergedStudyPlan,
      materialName,
      startUnit,
      endUnit,
      totalDays,
      bookMetadata,
      excludeWeekends,
      startDate
    );

    if (dualResult.plans.length === 0 || dualResult.plans.every((p) => p.dailyQuests.length === 0)) {
      return c.json({
        success: false,
        error: {
          code: 'QUEST_GENERATION_FAILED',
          message: dualResult.message || '퀘스트 생성에 실패했습니다.',
        },
      }, 400);
    }

    console.log(`[Generate] Generated ${dualResult.plans.length} plan(s)`);
    dualResult.plans.forEach((plan) => {
      console.log(`  - ${plan.planName}: ${plan.dailyQuests.length} days`);
    });

    return c.json({
      success: true,
      data: {
        materialName,
        analyzedUnits: uniqueUnits,
        hasOriginalPlan: dualResult.hasOriginalPlan,
        detectedStudyPlan: mergedStudyPlan.hasSchedule ? {
          source: mergedStudyPlan.source,
          totalDays: mergedStudyPlan.totalDays,
        } : null,
        plans: dualResult.plans,
        recommendations: dualResult.recommendations,
        aiMessage: dualResult.message,
      },
    });
  } catch (error) {
    console.error('[Generate] Error:', error);

    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';

    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    }, 500);
  }
});

// 플랜 재생성 스키마 (이미지 분석 없이 새 일수로 재생성)
const RegenerateRequestSchema = z.object({
  materialName: z.string().min(1),
  analyzedUnits: z.array(z.object({
    unitNumber: z.number(),
    unitTitle: z.string(),
    subSections: z.array(z.string()),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })),
  targetDays: z.number().int().positive(),
});

// 플랜 재생성 엔드포인트 (이미지 분석 없이 빠르게)
generateRoutes.post('/regenerate', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = RegenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: '잘못된 요청입니다' },
      }, 400);
    }

    const { materialName, analyzedUnits, targetDays } = parsed.data;

    console.log(`[Regenerate] Generating ${targetDays}-day plan for: ${materialName}`);

    const unitNumbers = analyzedUnits.map((u) => u.unitNumber);
    const startUnit = Math.min(...unitNumbers);
    const endUnit = Math.max(...unitNumbers);

    const result = await generateQuestsWithAI(
      analyzedUnits as AnalyzedUnit[],
      materialName,
      startUnit,
      endUnit,
      targetDays
    );

    console.log(`[Regenerate] Generated ${result.dailyQuests.length} quests`);

    return c.json({
      success: true,
      data: {
        plan: {
          planType: 'custom' as const,
          planName: `${targetDays}일 맞춤 플랜`,
          description: `${materialName}을 ${targetDays}일 동안 학습하는 AI 추천 계획입니다`,
          dailyQuests: result.dailyQuests,
          totalDays: result.dailyQuests.length,
          totalEstimatedHours: result.totalEstimatedHours,
        },
        recommendations: result.recommendations,
        aiMessage: result.message,
      },
    });
  } catch (error) {
    console.error('[Regenerate] Error:', error);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '플랜 재생성에 실패했습니다' },
    }, 500);
  }
});

// 플랜 리뷰 스키마
const ReviewRequestSchema = z.object({
  materialName: z.string().min(1),
  planName: z.string().min(1),
  dailyQuests: z.array(z.object({
    day: z.number(),
    date: z.string().optional(), // 프론트엔드에서 전송하는 날짜 필드
    unitNumber: z.number(),
    unitTitle: z.string(),
    range: z.string(),
    estimatedMinutes: z.number(),
    tip: z.string().optional(),
    topics: z.array(z.string()).optional(),
    pages: z.string().optional(),
    objectives: z.array(z.string()).optional(),
  })),
  totalDays: z.number(),
  totalEstimatedHours: z.number(),
});

// 플랜 리뷰 엔드포인트
generateRoutes.post('/review', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ReviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[Review] Validation failed:', JSON.stringify(parsed.error.issues, null, 2));
      console.error('[Review] Received body keys:', Object.keys(body));
      console.error('[Review] dailyQuests length:', body.dailyQuests?.length ?? 'undefined');
      console.error('[Review] First quest:', JSON.stringify(body.dailyQuests?.[0], null, 2));

      const firstError = parsed.error.issues[0];
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: firstError?.message || '잘못된 요청입니다',
          details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        },
      }, 400);
    }

    const { materialName, planName, dailyQuests, totalDays, totalEstimatedHours } = parsed.data;

    console.log(`[Review] Reviewing plan: ${planName} for ${materialName}`);

    const review = await reviewPlanWithAI({
      materialName,
      planName,
      dailyQuests: dailyQuests as AIGeneratedQuest[],
      totalDays,
      totalEstimatedHours,
    });

    console.log(`[Review] Generated review with ${review.strengths.length} strengths, ${review.improvements.length} improvements`);

    return c.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('[Review] Error:', error);
    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '플랜 리뷰에 실패했습니다' },
    }, 500);
  }
});
