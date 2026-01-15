/**
 * Coach Routes - Utility Functions
 * 유틸리티 함수 모음
 */

import type { StudentPattern, RescheduleResult } from '@questy/coach-agent';

/**
 * 메시지에서 정보 추출 (이름, 학년 등)
 */
export function extractInfoFromMessage(
  message: string,
  stage: string
): Record<string, string | string[]> {
  const extracted: Record<string, string | string[]> = {};

  if (stage === 'name') {
    const namePatterns = [
      /나는\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /제?\s*이름은?\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /(.+?)(?:입니다|이에요|예요|에요)$/,
      /^(.+?)라고\s*(?:해요|합니다|해)/,
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        name = name.replace(/^(안녕|반가워|반갑습니다|안녕하세요)[,\s]*/gi, '').trim();
        if (name.length > 0 && name.length <= 10) {
          extracted.name = name;
          break;
        }
      }
    }

    if (!extracted.name) {
      const words = message.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(w => w.length > 0);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length >= 2 && lastWord.length <= 10) {
        extracted.name = lastWord;
      }
    }
  }

  if (stage === 'grade') {
    if (/고3|고등학교\s*3/.test(message)) extracted.grade = '고3';
    else if (/고2|고등학교\s*2/.test(message)) extracted.grade = '고2';
    else if (/고1|고등학교\s*1/.test(message)) extracted.grade = '고1';
    else if (/중3|중학교\s*3/.test(message)) extracted.grade = '중3';
    else if (/중2|중학교\s*2/.test(message)) extracted.grade = '중2';
    else if (/중1|중학교\s*1/.test(message)) extracted.grade = '중1';
    else if (/N수|재수|삼수/.test(message)) extracted.grade = 'N수생';
  }

  return extracted;
}

/**
 * 랜덤 코치 팁 반환
 */
export function getRandomCoachTip(): string {
  const tips = [
    '💡 25분 집중 + 5분 휴식의 포모도로 기법을 사용해보세요!',
    '💡 어려운 문제는 쉬운 것부터 풀어보면 자신감이 생겨요!',
    '💡 오늘 배운 내용을 내일 복습하면 기억에 오래 남아요!',
    '💡 목표를 작게 나누면 달성하기 쉬워져요!',
    '💡 충분한 수면은 학습 효과를 2배로 높여줘요!',
    '💡 틀린 문제는 성장의 기회예요! 꼭 다시 풀어보세요!',
    '💡 집중이 안 될 땐 잠깐 산책을 해보세요!',
    '💡 배운 내용을 누군가에게 설명하면 이해가 깊어져요!',
  ];
  return tips[Math.floor(Math.random() * tips.length)]!;
}

/**
 * 업적 목록 생성
 */
export function getAchievements(
  streak: number,
  completedQuests: number
): Array<{ id: string; title: string; icon: string; earnedAt: string }> {
  const achievements = [];

  if (streak >= 3) {
    achievements.push({
      id: 'streak-3',
      title: '3일 연속 학습',
      icon: '🔥',
      earnedAt: new Date().toISOString(),
    });
  }

  if (streak >= 7) {
    achievements.push({
      id: 'streak-7',
      title: '일주일 연속 학습',
      icon: '🏆',
      earnedAt: new Date().toISOString(),
    });
  }

  if (completedQuests >= 10) {
    achievements.push({
      id: 'quests-10',
      title: '퀘스트 10개 완료',
      icon: '⭐',
      earnedAt: new Date().toISOString(),
    });
  }

  if (completedQuests >= 1) {
    achievements.push({
      id: 'first-quest',
      title: '첫 퀘스트 완료',
      icon: '🎯',
      earnedAt: new Date().toISOString(),
    });
  }

  return achievements;
}

/**
 * 코치 피드백 메시지 생성
 */
export function generateCoachFeedback(
  studentName: string,
  streak: number,
  progress: { overallProgress: number; totalPlans: number; activePlans: number }
): string {
  if (streak >= 7) {
    return `${studentName}님, 일주일 연속 학습 대단해요! 🎉\n\n이 페이스를 유지하면 목표 달성은 시간문제예요. 정말 자랑스러워요! 💪`;
  }

  if (streak >= 3) {
    return `${studentName}님, ${streak}일 연속 학습 중이에요! 🔥\n\n꾸준함이 실력이 되는 거예요. 이대로 계속 가봐요!`;
  }

  if (progress.activePlans > 0) {
    return `${studentName}님, ${progress.activePlans}개 플랜을 진행 중이시네요! 📚\n\n조금씩이라도 매일 하는 게 중요해요. 함께라면 할 수 있어요! 💪`;
  }

  return `${studentName}님, 새로운 학습 플랜을 시작해볼까요? ✨\n\n작은 목표부터 차근차근 달성해봐요. 제가 옆에서 도와드릴게요! 😊`;
}

/**
 * 전체 재조정 메시지 생성
 */
export function generateOverallRescheduleMessage(
  studentName: string,
  results: RescheduleResult[]
): string {
  if (results.length === 0) {
    return `${studentName}님, 재조정할 퀘스트가 없어요! 👍`;
  }

  const weekendCount = results.filter(r => r.strategy === 'WEEKEND_SPILLOVER').length;
  const stackCount = results.filter(r => r.strategy === 'STACK_NEXT_DAY').length;
  const reduceCount = results.filter(r => r.strategy === 'REDUCE_LOAD').length;

  let message = `📅 ${studentName}님, ${results.length}개의 미완료 퀘스트를 재조정했어요!\n\n`;

  if (weekendCount > 0) {
    message += `🗓️ ${weekendCount}개는 주말에 배치했어요.\n`;
  }
  if (stackCount > 0) {
    message += `📚 ${stackCount}개는 내일로 추가했어요.\n`;
  }
  if (reduceCount > 0) {
    message += `😊 ${reduceCount}개는 분량을 줄였어요.\n`;
  }

  message += `\n무리하지 않게 조정했으니 걱정 마세요! 💪`;

  return message;
}

/**
 * 기본 학생 패턴 생성
 */
export function getDefaultStudentPattern(): StudentPattern {
  return {
    preferredStudyDays: ['weekday'],
    averageQuestsPerDay: 1,
    completionRate: 0.7,
    weekendAvailability: true,
    consecutiveMissedDays: 0,
  };
}
