/**
 * 오리엔테이션 기능 (FR-053)
 */

import type { OrientationStep, OrientationProgress } from '../types.js';

type GenerateResponseFn = (prompt: string, message: string) => Promise<string>;

/**
 * 오리엔테이션 시작
 */
export function startOrientation(studentId: string): OrientationProgress {
  const steps: OrientationStep[] = [
    {
      id: 'welcome',
      title: '환영합니다! 👋',
      description: '퀘스티 학습 코치에 오신 것을 환영해요! AI가 학습을 도와드릴게요.',
      action: '다음으로 넘어가기',
      completed: false,
    },
    {
      id: 'profile',
      title: '프로필 확인 📋',
      description: '입력하신 정보를 확인하고, 필요하면 수정할 수 있어요.',
      action: '프로필 확인하기',
      completed: false,
    },
    {
      id: 'plan',
      title: '학습 플랜 이해하기 📅',
      description: '매일 퀘스트를 완료하며 학습 목표를 달성해요. AI가 맞춤 플랜을 만들어드려요.',
      action: '플래너 살펴보기',
      completed: false,
    },
    {
      id: 'quest',
      title: '퀘스트 시스템 🎯',
      description: '매일 완료할 퀘스트가 주어져요. 완료하면 XP를 얻고 성장할 수 있어요!',
      action: '첫 퀘스트 확인하기',
      completed: false,
    },
    {
      id: 'coach',
      title: 'AI 코치 만나기 🤖',
      description: '언제든 코치에게 질문하세요. 학습 조언, 설명, 격려를 받을 수 있어요.',
      action: '코치와 인사하기',
      completed: false,
    },
    {
      id: 'complete',
      title: '준비 완료! 🚀',
      description: '이제 학습을 시작할 준비가 됐어요! 함께 목표를 달성해봐요!',
      action: '학습 시작하기',
      completed: false,
    },
  ];

  return {
    studentId,
    steps,
    currentStep: 0,
    completedSteps: 0,
    totalSteps: steps.length,
    startedAt: new Date(),
  };
}

/**
 * 오리엔테이션 단계 완료
 */
export function completeOrientationStep(
  progress: OrientationProgress,
  stepId: string
): OrientationProgress {
  const stepIndex = progress.steps.findIndex(s => s.id === stepId);

  if (stepIndex === -1) {
    return progress;
  }

  const step = progress.steps[stepIndex];
  if (step && !step.completed) {
    step.completed = true;
    progress.completedSteps++;
  }

  // 다음 단계로 이동
  if (stepIndex === progress.currentStep && progress.currentStep < progress.totalSteps - 1) {
    progress.currentStep++;
  }

  // 모든 단계 완료 시
  if (progress.completedSteps === progress.totalSteps) {
    progress.completedAt = new Date();
  }

  return progress;
}

/**
 * 오리엔테이션 메시지 생성 (LLM 사용)
 */
export async function generateOrientationStepMessage(
  progress: OrientationProgress,
  stepIndex: number | undefined,
  generateResponse: GenerateResponseFn
): Promise<string> {
  const index = stepIndex ?? progress.currentStep;
  const step = progress.steps[index];

  if (!step) {
    return '오리엔테이션이 완료되었어요! 🎉';
  }

  const progressBar = progress.steps
    .map((s, i) => (i < index ? '●' : i === index ? '◐' : '○'))
    .join(' ');

  // LLM으로 개인화된 오리엔테이션 메시지 생성
  try {
    const prompt = `당신은 학습 상담 전문가 AI입니다.

## 오리엔테이션 진행 상황
- 현재 단계: ${index + 1}/${progress.totalSteps}
- 단계 제목: ${step.title}
- 단계 설명: ${step.description}
- 다음 액션: ${step.action}
- 완료 여부: ${step.completed ? '완료됨' : '진행 중'}
- 진행률: ${progressBar}

## 응답 지침
1. 현재 단계를 친근하게 안내
2. 다음에 할 일을 명확하게 설명
3. 격려와 동기부여 포함
4. 마크다운 형식, 이모지 사용
5. 2-3문단으로 간결하게`;

    const response = await generateResponse(prompt, '다음 단계가 뭐예요?');
    return response;
  } catch (error) {
    console.warn('[ADMISSION] LLM failed for orientation step, using template:', error);
    // 템플릿 폴백
    return `📖 **오리엔테이션** (${index + 1}/${progress.totalSteps})

${progressBar}

## ${step.title}

${step.description}

👉 **${step.action}**

${step.completed ? '✅ 완료됨' : ''}`;
  }
}

/**
 * 오리엔테이션 완료 메시지 (LLM 사용)
 */
export async function generateOrientationCompleteMessage(
  studentName: string,
  generateResponse: GenerateResponseFn
): Promise<string> {
  // LLM으로 개인화된 완료 메시지 생성
  try {
    const prompt = `당신은 학습 상담 전문가 AI입니다.

## 상황
- 학생 이름: ${studentName}
- 상태: 오리엔테이션 완료

## 응답 지침
1. 오리엔테이션 완료 축하
2. 퀘스티의 주요 기능 간단히 안내
3. 다음 단계 제안 (오늘의 퀘스트, 학습 계획, 코치 상담)
4. 강력한 동기부여 메시지
5. 마크다운 형식, 이모지 사용
6. 3-4문단으로 간결하게`;

    const response = await generateResponse(prompt, '오리엔테이션을 마쳤어요!');
    return response;
  } catch (error) {
    console.warn('[ADMISSION] LLM failed for orientation complete, using template:', error);
    // 템플릿 폴백
    return `🎉 **오리엔테이션 완료!**

${studentName}님, 축하해요! 이제 퀘스티의 모든 기능을 사용할 준비가 됐어요!

📚 **시작하기**
• "오늘 뭐 공부해?" - 오늘의 퀘스트 확인
• "계획 세워줘" - 새로운 학습 플랜 생성
• "도움이 필요해" - 언제든 코치에게 질문

함께 목표를 향해 달려가요! 💪🔥`;
  }
}
