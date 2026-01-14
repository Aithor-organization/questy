/**
 * useCoachScheduler
 * 자동 코치 메시지 스케줄러
 * - 밤 10시: 퀘스트 미완료 시 리마인더
 * - 자정: 퀘스트 완료 여부에 따른 메시지
 */

import { useEffect, useRef } from 'react';
import { useChatStore, DEFAULT_ROOM_ID } from '../stores/chatStore';
import { useQuestStore, getTodayDateString } from '../stores/questStore';

// 스케줄 키 생성 (날짜별 중복 방지)
const getScheduleKey = (type: 'reminder' | 'daily-summary', date: string) =>
  `coach-schedule-${type}-${date}`;

// 메시지 전송 여부 확인
const wasMessageSent = (type: 'reminder' | 'daily-summary', date: string): boolean => {
  const key = getScheduleKey(type, date);
  return localStorage.getItem(key) === 'sent';
};

// 메시지 전송 완료 표시
const markMessageSent = (type: 'reminder' | 'daily-summary', date: string): void => {
  const key = getScheduleKey(type, date);
  localStorage.setItem(key, 'sent');
};

// 오래된 스케줄 키 정리 (7일 이상 된 것)
const cleanupOldScheduleKeys = () => {
  const keysToRemove: string[] = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('coach-schedule-')) {
      const dateMatch = key.match(/\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        const keyDate = new Date(dateMatch[0]);
        if (keyDate < sevenDaysAgo) {
          keysToRemove.push(key);
        }
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
};

export function useCoachScheduler() {
  const addMessage = useChatStore((state) => state.addMessage);
  const getTodayQuests = useQuestStore((state) => state.getTodayQuests);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 시작 시 오래된 키 정리
    cleanupOldScheduleKeys();

    const checkAndSendMessages = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = getTodayDateString();

      // 오늘의 퀘스트 가져오기
      const todayQuests = getTodayQuests();
      const totalQuests = todayQuests.length;
      const completedQuests = todayQuests.filter(q => q.completed).length;
      const allCompleted = totalQuests > 0 && completedQuests === totalQuests;
      const hasQuests = totalQuests > 0;

      // 밤 10시 (22:00) 리마인더
      if (currentHour === 22 && currentMinute < 5) {
        if (!wasMessageSent('reminder', todayStr) && hasQuests && !allCompleted) {
          const remainingCount = totalQuests - completedQuests;
          const message = generateReminderMessage(remainingCount, totalQuests);

          addMessage(DEFAULT_ROOM_ID, {
            role: 'assistant',
            content: message,
            agentRole: 'coach',
          });

          markMessageSent('reminder', todayStr);
          console.log('[CoachScheduler] 10PM reminder sent');
        }
      }

      // 자정 (00:00) 일일 요약
      if (currentHour === 0 && currentMinute < 5) {
        // 어제 날짜로 체크 (자정이 지났으므로)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (!wasMessageSent('daily-summary', yesterdayStr)) {
          // 어제의 퀘스트 상태 확인
          const yesterdayQuests = useQuestStore.getState().getQuestsByDate(yesterdayStr);
          const yesterdayTotal = yesterdayQuests.length;
          const yesterdayCompleted = yesterdayQuests.filter(q => q.completed).length;
          const yesterdayAllCompleted = yesterdayTotal > 0 && yesterdayCompleted === yesterdayTotal;

          if (yesterdayTotal > 0) {
            const message = generateDailySummaryMessage(
              yesterdayAllCompleted,
              yesterdayCompleted,
              yesterdayTotal
            );

            addMessage(DEFAULT_ROOM_ID, {
              role: 'assistant',
              content: message,
              agentRole: 'coach',
            });

            markMessageSent('daily-summary', yesterdayStr);
            console.log('[CoachScheduler] Midnight summary sent');
          }
        }
      }
    };

    // 즉시 체크 (앱 시작 시)
    checkAndSendMessages();

    // 1분마다 체크
    intervalRef.current = setInterval(checkAndSendMessages, 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [addMessage, getTodayQuests]);
}

// 10시 리마인더 메시지 생성
function generateReminderMessage(remaining: number, total: number): string {
  const encouragements = [
    `아직 ${remaining}개의 퀘스트가 남아있어요! 🌙`,
    `오늘 ${remaining}개 퀘스트가 미완료예요!`,
    `${remaining}개 퀘스트가 기다리고 있어요! ✨`,
  ];

  const tips = [
    '자기 전에 조금만 더 힘내볼까요?',
    '10분만 투자해도 큰 차이가 생겨요!',
    '작은 진전도 쌓이면 큰 성과가 돼요.',
    '오늘 할 수 있는 만큼만 해봐요!',
  ];

  const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return `⏰ **밤 10시 알림**\n\n${randomEncouragement}\n\n${randomTip}\n\n📊 오늘 진행률: ${total - remaining}/${total} 완료`;
}

// 자정 일일 요약 메시지 생성
function generateDailySummaryMessage(
  allCompleted: boolean,
  completed: number,
  total: number
): string {
  if (allCompleted) {
    const congratulations = [
      '🎉 **완벽한 하루!**\n\n오늘 모든 퀘스트를 완료했어요!\n공부하느라 정말 수고 많았어요. 푹 쉬고 내일 또 화이팅! 💪',
      '✨ **대단해요!**\n\n오늘 목표를 모두 달성했네요!\n꾸준히 하는 모습이 정말 멋져요. 오늘 하루도 수고했어요! 🌟',
      '🏆 **퀘스트 올클리어!**\n\n완벽하게 해냈어요!\n이런 하루가 쌓이면 분명 좋은 결과가 있을 거예요. 굿나잇! 🌙',
    ];
    return congratulations[Math.floor(Math.random() * congratulations.length)];
  } else {
    const completionRate = Math.round((completed / total) * 100);

    if (completed === 0) {
      return `📝 **오늘 하루 정리**\n\n오늘은 퀘스트를 진행하지 못했네요.\n괜찮아요, 내일 다시 시작하면 돼요! 🌱\n\n무리하지 말고 푹 쉬세요.`;
    } else if (completionRate >= 70) {
      return `📝 **오늘 하루 정리**\n\n${completed}/${total} 완료 (${completionRate}%)\n\n거의 다 했어요! 오늘도 열심히 했네요. 🙌\n남은 건 내일 이어서 해요. 푹 쉬세요!`;
    } else {
      return `📝 **오늘 하루 정리**\n\n${completed}/${total} 완료 (${completionRate}%)\n\n조금 아쉽지만, 한 것도 있으니 괜찮아요.\n내일은 조금 더 할 수 있을 거예요! 화이팅 💪`;
    }
  }
}
