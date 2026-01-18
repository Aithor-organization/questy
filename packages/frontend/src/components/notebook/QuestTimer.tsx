/**
 * QuestTimer
 * 퀘스트 학습 타이머 컴포넌트
 *
 * FR-021: 학습 시작 유도
 * - 타이머 시작 시 예상 종료 시간 표시
 * - 경과 시간 실시간 표시
 * - 일시정지/재개 기능
 * - 주기적 자동 저장 (30초마다)
 * - 페이지 새로고침 후 타이머 복구
 */

import { useEffect, useCallback, useState } from 'react';
import { useQuestStore } from '../../stores/questStore';

interface QuestTimerProps {
  planId: string;
  questId: string;
  estimatedMinutes: number;
  isCompleted?: boolean;
}

// 자동 저장 간격 (30초)
const AUTO_SAVE_INTERVAL_MS = 30 * 1000;

export function QuestTimer({
  planId,
  questId,
  estimatedMinutes,
  isCompleted = false,
}: QuestTimerProps) {
  const {
    activeTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    completeTimer,
    getElapsedSeconds,
    saveTimerProgress,
    getQuestById,
  } = useQuestStore();

  // 현재 퀘스트의 타이머인지 확인
  const isActiveForThis = activeTimer?.planId === planId && activeTimer?.questId === questId;
  const status = isActiveForThis ? activeTimer.status : 'IDLE';

  // 경과 시간 (1초마다 업데이트를 위한 tick state)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tick, setTick] = useState(0);

  // 타이머 틱 (1초마다 UI 업데이트)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActiveForThis && status === 'RUNNING') {
      interval = setInterval(() => {
        setTick((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActiveForThis, status]);

  // 주기적 자동 저장 (30초마다)
  useEffect(() => {
    let saveInterval: ReturnType<typeof setInterval>;

    if (isActiveForThis && status === 'RUNNING') {
      saveInterval = setInterval(() => {
        saveTimerProgress();
      }, AUTO_SAVE_INTERVAL_MS);
    }

    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [isActiveForThis, status, saveTimerProgress]);

  // 페이지 종료 시 타이머 진행 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isActiveForThis && status === 'RUNNING') {
        saveTimerProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActiveForThis, status, saveTimerProgress]);

  // 페이지 로드 시 기존 타이머 복구
  useEffect(() => {
    if (!isActiveForThis && !isCompleted) {
      const quest = getQuestById(planId, questId);
      // 미완료 timerRecord가 있으면 타이머 상태로 복구 (자동 시작은 안 함)
      if (quest?.timerRecord && !quest.timerRecord.completed && quest.timerRecord.elapsedSeconds > 0) {
        console.log(`[QuestTimer] 복구 가능한 타이머 발견: ${quest.timerRecord.elapsedSeconds}s`);
      }
    }
  }, [planId, questId, isActiveForThis, isCompleted, getQuestById]);

  // 현재 경과 시간 계산
  const elapsedSeconds = isActiveForThis ? getElapsedSeconds() : 0;

  // 시작 (기존 timerRecord가 있으면 이어서)
  const handleStart = useCallback(() => {
    startTimer(planId, questId);
  }, [planId, questId, startTimer]);

  // 일시정지
  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  // 재개
  const handleResume = useCallback(() => {
    resumeTimer();
  }, [resumeTimer]);

  // 완료
  const handleComplete = useCallback(async () => {
    await completeTimer();
  }, [completeTimer]);

  // 시간 포맷팅 (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 예상 종료 시간 계산
  const getEstimatedEndTime = (): string => {
    const remainingSeconds = Math.max(0, estimatedMinutes * 60 - elapsedSeconds);
    const endTime = new Date();
    endTime.setSeconds(endTime.getSeconds() + remainingSeconds);
    return formatClockTime(endTime);
  };

  // 시계 시간 포맷
  const formatClockTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const hour12 = hours % 12 || 12;
    return `${ampm} ${hour12}:${minutes.toString().padStart(2, '0')}`;
  };

  // 진행률
  const progressPercent = Math.min(
    100,
    (elapsedSeconds / (estimatedMinutes * 60)) * 100
  );

  // 완료 상태면 숨김
  if (isCompleted) {
    return null;
  }

  // 기존 진행 중인 타이머가 있는지 확인
  const quest = getQuestById(planId, questId);
  const hasSavedProgress = quest?.timerRecord && !quest.timerRecord.completed && quest.timerRecord.elapsedSeconds > 0;

  return (
    <div className="quest-timer mt-3 pl-9">
      {status === 'IDLE' ? (
        // 시작 전
        <div className="flex items-center gap-3">
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--sticker-mint)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
          >
            <span>▶</span>
            <span>{hasSavedProgress ? '이어서 학습' : '학습 시작'}</span>
          </button>
          {hasSavedProgress ? (
            <span className="text-xs text-[var(--pencil-gray)]">
              <span className="font-semibold text-[var(--ink-blue)]">
                {formatTime(quest.timerRecord!.elapsedSeconds)}
              </span> 진행됨
            </span>
          ) : (
            <span className="text-xs text-[var(--pencil-gray)]">
              지금 시작하면 <span className="font-semibold text-[var(--ink-blue)]">{getEstimatedEndTime()}</span>에 끝나요
            </span>
          )}
        </div>
      ) : (
        // 진행 중 / 일시정지
        <div className="space-y-2">
          {/* 진행 바 */}
          <div className="h-2 bg-[var(--paper-lines)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--sticker-mint)] transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 타이머 정보 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 경과 시간 */}
              <div className="font-mono text-lg font-bold text-[var(--ink-blue)]">
                {formatTime(elapsedSeconds)}
              </div>
              <span className="text-xs text-[var(--pencil-gray)]">
                / {estimatedMinutes}분
              </span>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex items-center gap-2">
              {status === 'RUNNING' ? (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--paper-yellow)] text-[var(--ink-black)] rounded-lg hover:opacity-90 transition-opacity text-sm"
                >
                  <span>⏸</span>
                  <span>일시정지</span>
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--sticker-mint)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
                >
                  <span>▶</span>
                  <span>계속하기</span>
                </button>
              )}

              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--sticker-coral)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
              >
                <span>✓</span>
                <span>완료</span>
              </button>
            </div>
          </div>

          {/* 상태 메시지 */}
          {status === 'PAUSED' && (
            <div className="postit text-sm">
              ⏸ 일시정지 중... 준비되면 다시 시작해요!
            </div>
          )}

          {elapsedSeconds >= estimatedMinutes * 60 && (
            <div className="postit text-sm">
              🎉 예상 시간을 넘겼어요! 거의 다 왔어요!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
