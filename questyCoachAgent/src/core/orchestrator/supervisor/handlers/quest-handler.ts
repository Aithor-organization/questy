/**
 * 퀘스트 시스템 핸들러
 */

import type { StudentProfile, Subject } from '../../../../types/agent.js';
import type { TopicMastery } from '../../../../types/memory.js';
import type { TodayQuests } from '../../../../types/quest.js';
import type { QuestGenerator, QuestTracker } from '../../../../quest/index.js';
import type { StudentRegistry } from '../../../../registry/index.js';
import type { MemoryLane } from '../../../../memory/index.js';

/**
 * 오늘의 퀘스트 생성
 */
export async function generateDailyQuests(
  studentId: string,
  defaultSubject: Subject,
  studentRegistry: StudentRegistry,
  memoryLane: MemoryLane,
  questGenerator: QuestGenerator,
  questTracker: QuestTracker
): Promise<TodayQuests | null> {
  const profile = studentRegistry.getStudent(studentId);
  if (!profile) return null;

  const activePlans = studentRegistry.getActivePlans(studentId);
  const reviewTopics = memoryLane.getReviewRecommendations(studentId);

  // 복습 필요 토픽 (TopicMastery 형태로 변환)
  const reviewDueTopics: TopicMastery[] = reviewTopics.map(topicId => ({
    topicId,
    subject: defaultSubject,
    masteryScore: 0.5,
    easinessFactor: 2.5,
    interval: 1,
    repetitions: 1,
    nextReviewDate: new Date(),
    lastReviewDate: new Date(),
    totalAttempts: 1,
    successfulAttempts: 0,
  }));

  const todayQuests = await questGenerator.generateTodayQuests({
    request: {
      studentId,
      date: new Date(),
      activePlans: activePlans.map(p => p.id),
      reviewTopics: reviewTopics,
    },
    studentProfile: profile,
    activePlans,
    reviewDueTopics,
    currentStreak: questTracker.getStreak(studentId),
  });

  questTracker.saveTodayQuests(todayQuests);

  return todayQuests;
}
