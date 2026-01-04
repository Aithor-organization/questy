import { chatJson } from '../lib/openrouter';
import {
  CreatePlanRequest,
  DailyQuest,
  StudyPlan,
  generateId,
  getDaysBetween,
  formatDate,
} from '@questybook/shared';

interface GeneratedQuests {
  dailyQuests: Array<{
    dayNumber: number;
    title: string;
    tasks: Array<{
      description: string;
      materialUnit?: number;
      estimatedMinutes: number;
    }>;
  }>;
}

export async function generateStudyPlan(
  request: CreatePlanRequest
): Promise<StudyPlan> {
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const totalDays = getDaysBetween(startDate, endDate);

  // 쉬는 날 제외한 실제 학습일 계산
  const restDays = request.preferences?.restDays || [];
  let studyDays = 0;
  const studyDates: Date[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();

    if (!restDays.includes(dayOfWeek)) {
      studyDays++;
      studyDates.push(date);
    }
  }

  // AI로 퀘스트 생성
  const systemPrompt = `당신은 학습 계획 전문가입니다.
주어진 교재/인강 정보를 바탕으로 효과적인 일일 학습 퀘스트를 생성해주세요.

규칙:
1. 각 퀘스트는 하루에 완료 가능한 분량이어야 합니다
2. 난이도에 따라 분량 조절 (easy: 70%, normal: 100%, hard: 130%)
3. 복습이 포함된 경우 3-4일마다 복습 시간 추가
4. 각 태스크는 구체적이고 실행 가능해야 합니다
5. 예상 소요 시간은 현실적으로 산정

JSON 형식으로 응답해주세요.`;

  const userPrompt = `
교재/인강 정보:
- 제목: ${request.materialTitle}
- 유형: ${request.materialType}
- 총 단원 수: ${request.totalUnits}
${request.unitNames ? `- 단원명: ${request.unitNames.join(', ')}` : ''}

학습 기간:
- 시작일: ${request.startDate}
- 종료일: ${request.endDate}
- 실제 학습일 수: ${studyDays}일

설정:
- 하루 학습 시간: ${request.dailyStudyMinutes}분
- 복습 포함: ${request.preferences?.includeReview ? '예' : '아니오'}
- 난이도: ${request.preferences?.difficulty || 'normal'}

${studyDays}일치 일일 퀘스트를 생성해주세요.

응답 형식:
{
  "dailyQuests": [
    {
      "dayNumber": 1,
      "title": "1일차: [제목]",
      "tasks": [
        {
          "description": "구체적인 학습 내용",
          "materialUnit": 1,
          "estimatedMinutes": 30
        }
      ]
    }
  ]
}`;

  const generated = await chatJson<GeneratedQuests>([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // StudyPlan 객체 생성
  const dailyQuests: DailyQuest[] = generated.dailyQuests.map((quest, index) => {
    const questDate = studyDates[index] || new Date();
    const tasks = quest.tasks.map((task) => ({
      id: generateId(),
      description: task.description,
      materialUnit: task.materialUnit,
      estimatedMinutes: task.estimatedMinutes,
      completed: false,
    }));

    return {
      id: generateId(),
      date: formatDate(questDate),
      dayNumber: quest.dayNumber,
      title: quest.title,
      tasks,
      totalEstimatedMinutes: tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0),
      completed: false,
    };
  });

  const now = new Date().toISOString();

  return {
    id: generateId(),
    title: request.title,
    material: {
      id: generateId(),
      title: request.materialTitle,
      type: request.materialType,
      totalUnits: request.totalUnits,
      unitNames: request.unitNames,
      createdAt: now,
    },
    startDate: request.startDate,
    endDate: request.endDate,
    totalDays: studyDays,
    dailyQuests,
    createdAt: now,
    updatedAt: now,
  };
}
