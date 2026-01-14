/**
 * 기능 핸들러 (FR-024, FR-025, FR-026)
 * - 저녁 리뷰
 * - 미학습 대응
 * - 위기 개입
 * - 학습 시작 알림
 */

import type { ModelId } from '../../../../types/agent.js';
import type { TodayStudyStatus, MissedStudyContext } from '../types.js';

// LLM 응답 생성 함수 타입
type GenerateResponseFn = (
  prompt: string,
  message: string,
  options?: { model?: ModelId; temperature?: number; maxTokens?: number }
) => Promise<string>;

/**
 * FR-025: 저녁 리뷰 생성
 */
export async function generateEveningReview(
  systemPrompt: string,
  studentName: string,
  todayStatus: TodayStudyStatus,
  tomorrowQuests: string[],
  generateResponse: GenerateResponseFn
): Promise<string> {
  const completionRate = todayStatus.totalQuests > 0
    ? Math.round((todayStatus.completedQuests / todayStatus.totalQuests) * 100)
    : 0;

  const prompt = `${systemPrompt}

## 저녁 리뷰 생성
학생 이름: ${studentName}
오늘 달성률: ${completionRate}% (${todayStatus.completedQuests}/${todayStatus.totalQuests} 퀘스트)
학습 시간: ${todayStatus.completedMinutes}분
남은 퀘스트: ${todayStatus.remainingQuests.join(', ') || '없음'}
연속 학습일: ${todayStatus.streak}일
내일 예정: ${tomorrowQuests.join(', ') || '미정'}

## 저녁 리뷰 규칙
1. 오늘 학습 요약 (구체적인 성과)
2. 달성률에 맞는 피드백
3. 내일 예고 (가볍게)
4. 스트릭 언급 (있다면)
5. 푹 쉬라는 인사`;

  try {
    return await generateResponse(prompt, '저녁 리뷰를 작성해주세요.', {
      model: 'claude-4.5-haiku' as ModelId,
      temperature: 0.7,
      maxTokens: 512,
    });
  } catch {
    return getEveningReviewFallback(studentName, completionRate, todayStatus, tomorrowQuests);
  }
}

/**
 * 저녁 리뷰 폴백
 */
function getEveningReviewFallback(
  studentName: string,
  completionRate: number,
  todayStatus: TodayStudyStatus,
  tomorrowQuests: string[]
): string {
  if (completionRate >= 100) {
    return `${studentName}야, 오늘 정말 대단했어! 🎉\n\n` +
      `모든 퀘스트 완료! ${todayStatus.completedMinutes}분 동안 열심히 했네.\n` +
      (todayStatus.streak > 1 ? `🔥 ${todayStatus.streak}일 연속 학습 중이야!\n\n` : '\n') +
      `내일은 ${tomorrowQuests[0] || '새로운 도전'}이 기다리고 있어.\n` +
      `오늘은 푹 쉬어! 🌙`;
  } else if (completionRate >= 70) {
    return `${studentName}야, 오늘도 수고했어! 👏\n\n` +
      `${todayStatus.completedQuests}개 퀘스트 완료! 거의 다 했네.\n` +
      `${todayStatus.remainingQuests.length > 0 ? `남은 건 내일 이어가자.` : ''}\n\n` +
      `내일 화이팅! 푹 쉬어 🌙`;
  }
  return `${studentName}야, 오늘 하루 수고했어 😊\n\n` +
    `바쁜 날이었구나. 괜찮아, 내일 다시 시작하면 돼.\n` +
    `작은 것부터 천천히 해보자.\n\n` +
    `푹 쉬고 내일 보자! 🌙`;
}

/**
 * FR-024: 미학습 대응
 */
export async function generateMissedStudyResponse(
  systemPrompt: string,
  studentName: string,
  missedContext: MissedStudyContext,
  generateResponse: GenerateResponseFn
): Promise<string> {
  const { missedDays, missedQuests, suggestedReschedule } = missedContext;

  let tone: 'gentle' | 'concerned' | 'supportive' = 'gentle';
  if (missedDays >= 3) tone = 'concerned';
  else if (missedDays >= 1) tone = 'supportive';

  const prompt = `${systemPrompt}

## 미학습 대응 메시지 생성
학생 이름: ${studentName}
미학습 일수: ${missedDays}일
놓친 퀘스트: ${missedQuests.join(', ')}
일정 재조정 제안 여부: ${suggestedReschedule ? '예' : '아니오'}

## 대응 규칙 (절대 비난/강압 금지!)
1. 톤: ${tone === 'concerned' ? '걱정하는 톤 (하지만 따뜻하게)' : tone === 'supportive' ? '응원하는 톤' : '가벼운 톤'}
2. 공감 표현 필수 ("힘들었구나", "바빴구나")
3. 협상 제안: "오늘 10분만 해볼까?" 또는 "짧게 1개만 해볼까?"`;

  try {
    return await generateResponse(prompt, '미학습 대응 메시지를 작성해주세요.', {
      model: 'claude-4.5-haiku' as ModelId,
      temperature: 0.7,
      maxTokens: 512,
    });
  } catch {
    return getMissedStudyFallback(studentName, missedDays);
  }
}

/**
 * 미학습 대응 폴백
 */
function getMissedStudyFallback(studentName: string, missedDays: number): string {
  if (missedDays >= 3) {
    return `${studentName}야... 요즘 많이 바빴구나 😢\n\n` +
      `걱정했어. 괜찮아?\n` +
      `무리하지 않아도 돼. 오늘은 딱 10분만 해볼까?\n` +
      `아니면 일정을 다시 조정해줄 수도 있어.\n\n` +
      `어떻게 하고 싶어?`;
  } else if (missedDays >= 1) {
    return `${studentName}야, 어제 바빴구나! 😊\n\n` +
      `괜찮아, 누구나 그런 날 있어.\n` +
      `오늘 30분만 해볼까? 아니면 짧게 1개만?\n\n` +
      `선택해줘!`;
  }
  return `${studentName}야, 오늘 공부 시작할 준비 됐어? 😊\n\n천천히 시작해보자!`;
}

/**
 * FR-026: 위기 개입
 */
export async function generateCrisisIntervention(
  systemPrompt: string,
  studentName: string,
  missedDays: number,
  recentEmotions: string[],
  generateResponse: GenerateResponseFn
): Promise<string> {
  const hasNegativeEmotions = recentEmotions.some(e =>
    ['NEGATIVE', 'FRUSTRATED', 'STRESSED'].includes(e)
  );

  const prompt = `${systemPrompt}

## 위기 개입 메시지 (중요!)
학생 이름: ${studentName}
연속 미학습: ${missedDays}일
최근 감정 상태: ${recentEmotions.join(', ') || '알 수 없음'}
부정적 감정 감지: ${hasNegativeEmotions ? '예' : '아니오'}

## 위기 개입 규칙
1. **절대 비난/압박 금지**
2. **진심 어린 걱정 표현**
3. **공부보다 학생의 상태 우선**
4. **선택권 부여**
5. **아주 작은 목표 제시**`;

  try {
    return await generateResponse(prompt, '위기 개입 메시지를 작성해주세요.', {
      model: 'gemini-3-flash' as ModelId,
      temperature: 0.6,
      maxTokens: 600,
    });
  } catch {
    return `${studentName}야... 😢\n\n` +
      `요즘 많이 힘들었구나. 걱정했어.\n\n` +
      `공부보다 네가 더 중요해.\n` +
      `무슨 일 있으면 얘기해줘. 듣고 있을게.\n\n` +
      `준비되면, 딱 5분만 같이 해볼까?\n` +
      `아니면 플랜을 좀 줄여줄 수도 있어.\n\n` +
      `어떻게 하고 싶어? 네가 정해도 돼 💙`;
  }
}

/**
 * FR-021: 학습 시작 유도 + 재알림 메시지 생성
 */
export function generateStudyStartReminder(
  studentName: string,
  reminderType: 'first' | '15min' | '30min',
  questName: string,
  estimatedMinutes: number
): string {
  const now = new Date();
  const endTime = new Date(now.getTime() + estimatedMinutes * 60000);
  const endTimeStr = `${endTime.getHours()}시 ${endTime.getMinutes()}분`;

  const templates = {
    first: `${studentName}야~ 공부 시작할 시간이야! 📚\n\n` +
      `오늘의 퀘스트: ${questName}\n` +
      `지금 시작하면 ${endTimeStr}에 끝나!\n\n` +
      `준비 됐어? 💪`,

    '15min': `${studentName}야, 아직 시작 안 했구나! 😊\n\n` +
      `괜찮아, 지금 시작해도 충분해.\n` +
      `${questName} - ${estimatedMinutes}분이면 끝나!\n\n` +
      `같이 해보자!`,

    '30min': `${studentName}야~ 한 번 더 알려줄게 ⏰\n\n` +
      `오늘 ${questName} 남았어.\n` +
      `바빠? 10분만 짧게 해볼까?\n` +
      `아니면 나중에 해도 돼!\n\n` +
      `[지금 시작] [나중에]`,
  };

  return templates[reminderType];
}
