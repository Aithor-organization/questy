import { Hono } from 'hono';
import { z } from 'zod';
import { analyzeTableOfContents, DetectedStudyPlan } from '../lib/image-analyzer';
import { generateDualPlans } from '../lib/ai-quest-generator';

export const generateRoutes = new Hono();

// 요청 스키마 정의 (여러 이미지 지원)
const ImageSchema = z.object({
  base64: z.string().min(1),
  type: z.enum(['jpg', 'png']),
});

const GenerateRequestSchema = z.object({
  materialName: z.string().min(1, '교재 이름을 입력해주세요').max(100),
  images: z.array(ImageSchema).min(1, '이미지를 1장 이상 업로드해주세요').max(4, '최대 4장까지 업로드 가능합니다'),
  totalDays: z.number().int().positive('목표 기간은 1일 이상이어야 합니다'),
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

    const { materialName, images, totalDays } = parsed.data;

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
    const dualResult = await generateDualPlans(
      uniqueUnits,
      mergedStudyPlan,
      materialName,
      startUnit,
      endUnit,
      totalDays
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
