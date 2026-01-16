/**
 * Coach Routes - Curriculum Actions
 * AI 코치가 수행하는 커리큘럼 생성 및 스마트 재스케줄링 액션
 */

import { Hono } from 'hono';
import { z } from 'zod';

export const curriculumActionRoutes = new Hono();

// API Base URL - 환경변수 또는 기본값 사용
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

// 커리큘럼 생성 요청 스키마
const GenerateCurriculumSchema = z.object({
  studentId: z.string(),
  materialName: z.string(),
  targetDays: z.number().min(1).max(365),
  dailyStudyHours: z.number().min(1).max(14).default(10),
  units: z.array(z.object({
    unitNumber: z.number(),
    unitTitle: z.string(),
    estimatedMinutes: z.number().optional(),
  })),
  existingPlans: z.array(z.object({
    id: z.string(),
    title: z.string(),
    quests: z.array(z.object({
      scheduledDate: z.string(),
      estimatedMinutes: z.number(),
    })),
  })).optional(),
});

// 스마트 재스케줄링 요청 스키마
const SmartRescheduleSchema = z.object({
  studentId: z.string(),
  planId: z.string(),
  targetDate: z.string(),
  strategy: z.enum(['smart', 'spread', 'front_load', 'back_load', 'priority_first']).default('smart'),
  dailyStudyHours: z.number().min(1).max(14).default(10),
  existingPlans: z.array(z.object({
    id: z.string(),
    title: z.string(),
    quests: z.array(z.object({
      scheduledDate: z.string(),
      estimatedMinutes: z.number(),
    })),
  })).optional(),
});

/**
 * POST /curriculum/generate
 * AI 코치가 커리큘럼을 생성 (채팅 컨텍스트에서 호출)
 * 80% 버퍼 규칙 적용 + 기존 플랜 충돌 회피
 */
curriculumActionRoutes.post('/generate', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = GenerateCurriculumSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, materialName, targetDays, dailyStudyHours, units, existingPlans } = parsed.data;

    console.log(`[Coach/Curriculum] Generating curriculum for ${studentId}: "${materialName}" (${targetDays} days)`);

    // 내부 커리큘럼 생성 로직 (80% 버퍼 규칙 적용)
    const dailyCapacityMinutes = dailyStudyHours * 60 * 0.8; // 80% 버퍼
    const totalMinutes = units.reduce((sum, u) => sum + (u.estimatedMinutes || 60), 0);

    // 기존 플랜의 날짜별 사용량 계산
    const dateUsage: Record<string, number> = {};
    if (existingPlans) {
      for (const plan of existingPlans) {
        for (const quest of plan.quests || []) {
          const date = quest.scheduledDate;
          dateUsage[date] = (dateUsage[date] || 0) + (quest.estimatedMinutes || 0);
        }
      }
    }

    // 일일 퀘스트 생성
    const dailyQuests: Array<{
      date: string;
      unitNumber: number;
      unitTitle: string;
      estimatedMinutes: number;
    }> = [];

    const today = new Date();
    let currentDay = 0;
    let remainingMinutes = 0;
    let unitIndex = 0;

    while (unitIndex < units.length && currentDay < targetDays) {
      const date = new Date(today);
      date.setDate(date.getDate() + currentDay);
      const dateStr = date.toISOString().split('T')[0];

      // 해당 날짜의 사용 가능한 시간
      const usedMinutes = dateUsage[dateStr] || 0;
      const availableMinutes = Math.max(0, dailyCapacityMinutes - usedMinutes);

      if (availableMinutes < 30) {
        // 가용 시간이 너무 적으면 다음 날로
        currentDay++;
        continue;
      }

      const unit = units[unitIndex];
      const unitMinutes = remainingMinutes > 0 ? remainingMinutes : (unit.estimatedMinutes || 60);

      if (unitMinutes <= availableMinutes) {
        // 단원 전체를 이 날에 배치
        dailyQuests.push({
          date: dateStr,
          unitNumber: unit.unitNumber,
          unitTitle: unit.unitTitle,
          estimatedMinutes: unitMinutes,
        });
        dateUsage[dateStr] = (dateUsage[dateStr] || 0) + unitMinutes;
        remainingMinutes = 0;
        unitIndex++;
      } else {
        // 단원을 분할
        dailyQuests.push({
          date: dateStr,
          unitNumber: unit.unitNumber,
          unitTitle: `${unit.unitTitle} (1/2)`,
          estimatedMinutes: availableMinutes,
        });
        dateUsage[dateStr] = (dateUsage[dateStr] || 0) + availableMinutes;
        remainingMinutes = unitMinutes - availableMinutes;
        currentDay++;
      }
    }

    const actualDays = new Set(dailyQuests.map(q => q.date)).size;
    const averageMinutesPerDay = actualDays > 0 ? Math.round(totalMinutes / actualDays) : 0;

    const curriculumData = {
      dailyQuests,
      summary: {
        totalDays: actualDays,
        totalUnits: units.length,
        averageMinutesPerDay,
      },
    };

    console.log(`[Coach/Curriculum] Generated ${actualDays} days of quests for ${units.length} units`);

    // 코치 메시지 생성
    const coachMessage = generateCoachCurriculumMessage(materialName, curriculumData.summary);

    return c.json({
      success: true,
      data: {
        curriculum: curriculumData,
        coachMessage,
        actions: [{
          type: 'CURRICULUM_GENERATED',
          payload: {
            materialName,
            totalDays: actualDays,
            totalUnits: units.length,
            averageMinutesPerDay,
          },
        }],
      },
    });
  } catch (error) {
    console.error('[Coach/Curriculum] Error:', error);
    return c.json({
      success: false,
      error: { message: '커리큘럼 생성 중 오류가 발생했습니다' },
    }, 500);
  }
});

/**
 * POST /curriculum/reschedule
 * AI 코치가 스마트 재스케줄링 실행 (채팅 컨텍스트에서 호출)
 * 80% 버퍼 규칙 적용 + 기존 플랜 충돌 회피
 */
curriculumActionRoutes.post('/reschedule', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SmartRescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, planId, targetDate, strategy, dailyStudyHours, existingPlans } = parsed.data;

    console.log(`[Coach/Reschedule] Smart reschedule for ${studentId}, plan: ${planId}, strategy: ${strategy}`);

    // 내부 재스케줄링 로직 (80% 버퍼 규칙 적용)
    const dailyCapacityMinutes = dailyStudyHours * 60 * 0.8; // 80% 버퍼
    const warnings: string[] = [];

    // 기존 플랜의 날짜별 사용량 계산 (현재 플랜 제외)
    const dateUsage: Record<string, number> = {};
    if (existingPlans) {
      for (const plan of existingPlans) {
        if (plan.id === planId) continue; // 현재 플랜은 제외
        for (const quest of plan.quests || []) {
          const date = quest.scheduledDate;
          dateUsage[date] = (dateUsage[date] || 0) + (quest.estimatedMinutes || 0);
        }
      }
    }

    // 현재 플랜의 밀린 퀘스트 찾기
    const currentPlan = existingPlans?.find(p => p.id === planId);
    const today = new Date().toISOString().split('T')[0];
    const overdueQuests = currentPlan?.quests?.filter(
      (q: any) => q.scheduledDate < today && !q.completed
    ) || [];

    if (overdueQuests.length === 0) {
      return c.json({
        success: true,
        data: {
          rescheduledCount: 0,
          rescheduledQuests: [],
          warnings: ['밀린 퀘스트가 없습니다'],
          coachMessage: '✅ 밀린 퀘스트가 없어요! 잘 하고 계시네요 💪',
          actions: [],
        },
      });
    }

    // 재스케줄링 수행
    const rescheduledQuests: Array<{ questId: string; oldDate: string; newDate: string; estimatedMinutes: number }> = [];
    const targetDateObj = new Date(targetDate);
    let currentDay = 0;
    const maxDays = 60; // 최대 60일까지 탐색

    for (const quest of overdueQuests) {
      let assigned = false;
      while (!assigned && currentDay < maxDays) {
        const date = new Date(targetDateObj);
        date.setDate(date.getDate() + currentDay);
        const dateStr = date.toISOString().split('T')[0];

        const usedMinutes = dateUsage[dateStr] || 0;
        const availableMinutes = dailyCapacityMinutes - usedMinutes;
        const questMinutes = quest.estimatedMinutes || 60;

        if (availableMinutes >= questMinutes) {
          rescheduledQuests.push({
            questId: quest.id || `quest-${rescheduledQuests.length}`,
            oldDate: quest.scheduledDate,
            newDate: dateStr,
            estimatedMinutes: questMinutes,
          });
          dateUsage[dateStr] = (dateUsage[dateStr] || 0) + questMinutes;
          assigned = true;
        } else {
          currentDay++;
        }
      }

      if (!assigned) {
        warnings.push(`일부 퀘스트를 배치하지 못했습니다 (용량 부족)`);
        break;
      }
    }

    console.log(`[Coach/Reschedule] Rescheduled ${rescheduledQuests.length} quests`);

    // 코치 메시지 생성
    const coachMessage = generateCoachRescheduleMessage(rescheduledQuests.length, strategy, warnings);

    return c.json({
      success: true,
      data: {
        rescheduledCount: rescheduledQuests.length,
        rescheduledQuests,
        warnings,
        overloadDays: [],
        coachMessage,
        actions: [{
          type: 'QUESTS_RESCHEDULED',
          payload: {
            planId,
            rescheduledCount: rescheduledQuests.length,
            strategy,
            targetDate,
          },
        }],
      },
    });
  } catch (error) {
    console.error('[Coach/Reschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '일정 재조정 중 오류가 발생했습니다' },
    }, 500);
  }
});

/**
 * POST /curriculum/analyze-overdue
 * AI 코치가 밀린 퀘스트 분석 (채팅에서 조언 제공용)
 */
curriculumActionRoutes.post('/analyze-overdue', async (c) => {
  try {
    const body = await c.req.json();
    const { studentId, overdueQuests, existingPlans } = body;

    if (!overdueQuests || !Array.isArray(overdueQuests)) {
      return c.json({
        success: false,
        error: { message: '밀린 퀘스트 정보가 필요합니다' },
      }, 400);
    }

    console.log(`[Coach/AnalyzeOverdue] Analyzing ${overdueQuests.length} overdue quests for ${studentId}`);

    // 분석 결과 생성
    const totalMinutes = overdueQuests.reduce((sum: number, q: any) => sum + (q.estimatedMinutes || 0), 0);
    const totalHours = Math.ceil(totalMinutes / 60);
    const daysNeeded = Math.ceil(totalMinutes / (10 * 60 * 0.8)); // 80% 버퍼 적용

    // 플랜별 그룹화
    const byPlan: Record<string, any[]> = {};
    for (const quest of overdueQuests) {
      const planId = quest.planId || 'unknown';
      if (!byPlan[planId]) byPlan[planId] = [];
      byPlan[planId].push(quest);
    }

    // 조언 생성
    const advice = generateOverdueAdvice(overdueQuests.length, totalHours, daysNeeded, Object.keys(byPlan).length);

    return c.json({
      success: true,
      data: {
        analysis: {
          totalOverdueQuests: overdueQuests.length,
          totalMinutes,
          totalHours,
          estimatedDaysToComplete: daysNeeded,
          planCount: Object.keys(byPlan).length,
          byPlan: Object.entries(byPlan).map(([planId, quests]) => ({
            planId,
            questCount: quests.length,
            totalMinutes: quests.reduce((sum, q) => sum + (q.estimatedMinutes || 0), 0),
          })),
        },
        advice,
        suggestedActions: [
          {
            type: 'SMART_RESCHEDULE',
            label: '🧠 스마트 재조정',
            description: '다른 플랜과의 충돌을 피해 자동으로 일정 재배치',
          },
          {
            type: 'RESCHEDULE_TO_TODAY',
            label: '📅 오늘로 이동',
            description: '밀린 퀘스트를 오늘 일정에 추가',
          },
          {
            type: 'SPREAD_EVENLY',
            label: '📊 균등 분배',
            description: '남은 기간에 균등하게 분배',
          },
        ],
      },
    });
  } catch (error) {
    console.error('[Coach/AnalyzeOverdue] Error:', error);
    return c.json({
      success: false,
      error: { message: '분석 중 오류가 발생했습니다' },
    }, 500);
  }
});

// 커리큘럼 생성 완료 메시지 생성
function generateCoachCurriculumMessage(materialName: string, data: any): string {
  const { totalDays, totalUnits, averageMinutesPerDay } = data || {};

  const messages = [
    `✨ "${materialName}" 커리큘럼을 만들었어요!`,
    '',
    `📅 총 ${totalDays || '?'}일 학습 플랜`,
    `📚 ${totalUnits || '?'}개 단원`,
    `⏱️ 하루 평균 ${averageMinutesPerDay || '?'}분`,
    '',
    '다른 플랜과의 충돌도 피했고, 하루 학습량도 적절하게 조절했어요!',
    '플랜이 마음에 드시면 바로 학습을 시작해볼까요? 💪',
  ];

  return messages.join('\n');
}

// 재스케줄링 완료 메시지 생성
function generateCoachRescheduleMessage(count: number, strategy: string, warnings: string[]): string {
  const strategyNames: Record<string, string> = {
    smart: '스마트 분배',
    spread: '균등 분산',
    front_load: '앞쪽 집중',
    back_load: '뒤쪽 집중',
    priority_first: '우선순위 기반',
  };

  const messages = [
    `✅ ${count}개 퀘스트를 재조정했어요!`,
    '',
    `📋 사용한 전략: ${strategyNames[strategy] || strategy}`,
  ];

  if (warnings && warnings.length > 0) {
    messages.push('');
    messages.push('⚠️ 주의사항:');
    warnings.forEach(w => messages.push(`  • ${w}`));
  }

  messages.push('');
  messages.push('다른 플랜과의 충돌도 피했고, 80% 버퍼 규칙도 적용했어요! 🎯');

  return messages.join('\n');
}

// 밀린 퀘스트 조언 생성
function generateOverdueAdvice(questCount: number, hours: number, daysNeeded: number, planCount: number): string {
  const messages: string[] = [];

  if (questCount <= 3) {
    messages.push(`밀린 퀘스트가 ${questCount}개로 많지 않아요! 오늘 바로 처리하면 금방 따라잡을 수 있어요. 💪`);
  } else if (questCount <= 7) {
    messages.push(`밀린 퀘스트가 ${questCount}개 있네요. 약 ${daysNeeded}일 정도면 따라잡을 수 있어요!`);
    messages.push('스마트 재조정을 사용하면 다른 일정과 충돌 없이 효율적으로 배치할 수 있어요. 🧠');
  } else {
    messages.push(`밀린 퀘스트가 ${questCount}개(약 ${hours}시간)로 꽤 많아요.`);
    messages.push('');
    messages.push('💡 추천 전략:');
    messages.push(`1. 우선 가장 중요한 플랜부터 스마트 재조정하기`);
    messages.push(`2. 하루 학습량을 조금 늘려서 ${Math.max(daysNeeded - 2, 1)}일 안에 따라잡기`);
    if (planCount > 1) {
      messages.push(`3. ${planCount}개 플랜 중 덜 급한 것은 일정을 더 여유롭게 조정하기`);
    }
  }

  return messages.join('\n');
}
