/**
 * TimerPage
 * 전용 학습 타이머 페이지
 *
 * - 전체 화면 타이머 UI
 * - 경과 시간 실시간 표시
 * - 주기적 자동 저장 (30초마다)
 * - 페이지 새로고침 후 타이머 복구
 * - 완료 시 자동 기록 저장
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'
import { useQuestStore } from '../stores/questStore';

// 자동 저장 간격 (30초)
const AUTO_SAVE_INTERVAL_MS = 30 * 1000;

export function TimerPage() {
  const { planId, questId } = useParams<{ planId: string; questId: string }>();
  const navigate = useNavigate();

  const {
    activeTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    completeTimer,
    // cancelTimer, // 현재 미사용
    getElapsedSeconds,
    saveTimerProgress,
    getQuestById,
  } = useQuestStore();

  const quest = planId && questId ? getQuestById(planId, questId) : undefined;

  // 현재 퀘스트의 타이머인지 확인
  const isActiveForThis = activeTimer?.planId === planId && activeTimer?.questId === questId;
  const timerStatus = isActiveForThis && activeTimer ? activeTimer.status : 'IDLE';

  // UI 상태 (COMPLETED는 로컬에서만 관리)
  const [isCompleted, setIsCompleted] = useState(false);

  // 타이머 틱 (1초마다 UI 업데이트)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_tick, setTick] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActiveForThis && timerStatus === 'RUNNING') {
      interval = setInterval(() => {
        setTick((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActiveForThis, timerStatus]);

  // 주기적 자동 저장 (30초마다)
  useEffect(() => {
    let saveInterval: ReturnType<typeof setInterval>;

    if (isActiveForThis && timerStatus === 'RUNNING') {
      saveInterval = setInterval(() => {
        saveTimerProgress();
      }, AUTO_SAVE_INTERVAL_MS);
    }

    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [isActiveForThis, timerStatus, saveTimerProgress]);

  // 페이지 종료 시 타이머 진행 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isActiveForThis && timerStatus === 'RUNNING') {
        saveTimerProgress();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isActiveForThis, timerStatus, saveTimerProgress]);

  // 페이지 로드 시 기존 타이머 복구 (activeTimer가 없지만 timerRecord가 있는 경우)
  useEffect(() => {
    if (!isActiveForThis && quest?.timerRecord && !quest.timerRecord.completed && planId && questId) {
      console.log('[TimerPage] 이전 타이머 기록 복구 가능:', quest.timerRecord.elapsedSeconds, 's');
      // 자동 시작하지 않고 UI에 복구 가능함을 표시
    }
  }, [isActiveForThis, quest, planId, questId]);

  // 현재 경과 시간
  const elapsedSeconds = isActiveForThis ? getElapsedSeconds() : 0;

  // 시작 (기존 timerRecord가 있으면 이어서)
  const handleStart = useCallback(() => {
    if (planId && questId) {
      startTimer(planId, questId);
    }
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
    setIsCompleted(true);
    await completeTimer();

    // 2초 후 메인으로 돌아가기
    setTimeout(() => {
      navigate('/');
    }, 2000);
  }, [completeTimer, navigate]);

  // 나가기 (저장 후)
  const handleExit = useCallback(() => {
    if (isActiveForThis && timerStatus === 'RUNNING') {
      // 일시정지하고 저장
      pauseTimer();
    }
    navigate(-1);
  }, [isActiveForThis, timerStatus, pauseTimer, navigate]);

  // 시간 포맷팅 (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 시계 시간 포맷
  const formatClockTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const hour12 = hours % 12 || 12;
    return `${ampm} ${hour12}:${minutes.toString().padStart(2, '0')}`;
  };

  // 예상 종료 시간 (예상 시간이 있을 때만)
  const getEstimatedEndTime = (): string => {
    if (!quest || !quest.estimatedMinutes) return '';
    const remainingSeconds = Math.max(0, quest.estimatedMinutes * 60 - elapsedSeconds);
    const endTime = new Date();
    endTime.setSeconds(endTime.getSeconds() + remainingSeconds);
    return formatClockTime(endTime);
  };

  // 진행률 (예상 시간이 있을 때만 계산)
  const progressPercent = quest && quest.estimatedMinutes > 0
    ? Math.min(100, (elapsedSeconds / (quest.estimatedMinutes * 60)) * 100)
    : 0;

  // 예상 시간 존재 여부
  const hasEstimatedTime = quest && quest.estimatedMinutes > 0;

  // 이전 진행 기록 존재 여부
  const hasSavedProgress = quest?.timerRecord && !quest.timerRecord.completed && quest.timerRecord.elapsedSeconds > 0;

  if (!quest) {
    return (
      <div className="min-h-screen notebook-bg p-4">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-[var(--pencil-gray)]">퀘스트를 찾을 수 없어요</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-[var(--sticker-coral)] text-white rounded-lg"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // UI 상태 결정
  const displayStatus = isCompleted ? 'COMPLETED' : timerStatus;

  return (
    <div className="min-h-screen notebook-bg p-4">
      <div className="min-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleExit}
            className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)] transition-colors"
          >
            ← 나가기
          </button>
          <span className="sticker sticker-coral text-xs">
            📚 {quest.planName}
          </span>
        </div>

        {/* 퀘스트 정보 */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-[var(--ink-black)] mb-2">
            <span className="text-[var(--ink-blue)]">{quest.unitNumber}.</span> {quest.unitTitle}
          </h1>
          {quest.range && (
            <p className="text-sm text-[var(--pencil-gray)]">{quest.range}</p>
          )}
          {quest.pages && (
            <p className="text-sm text-[var(--pencil-gray)] mt-1">p.{quest.pages}</p>
          )}
        </div>

        {/* 타이머 영역 */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {displayStatus === 'COMPLETED' ? (
            // 완료 상태
            <div className="text-center animate-bounce">
              <p className="text-7xl mb-4">🎉</p>
              <p className="text-2xl font-bold text-[var(--sticker-mint)] mb-2">
                학습 완료!
              </p>
              <p className="text-lg text-[var(--pencil-gray)]">
                {formatTime(elapsedSeconds)} 동안 열심히 했어요
              </p>
            </div>
          ) : displayStatus === 'IDLE' ? (
            // 시작 전
            <div className="text-center">
              <p className="text-6xl mb-6">⏱️</p>
              {hasSavedProgress ? (
                <>
                  <p className="text-lg text-[var(--pencil-gray)] mb-2">
                    이전에 <span className="font-bold text-[var(--ink-blue)]">{formatTime(quest.timerRecord!.elapsedSeconds)}</span> 진행했어요
                  </p>
                  <p className="text-sm text-[var(--pencil-gray)] mb-8">
                    이어서 학습을 시작할까요?
                  </p>
                </>
              ) : hasEstimatedTime ? (
                <>
                  <p className="text-lg text-[var(--pencil-gray)] mb-2">
                    예상 학습 시간: <span className="font-bold text-[var(--ink-blue)]">{quest.estimatedMinutes}분</span>
                  </p>
                  <p className="text-sm text-[var(--pencil-gray)] mb-8">
                    지금 시작하면 <span className="font-semibold text-[var(--ink-blue)]">{getEstimatedEndTime()}</span>에 끝나요
                  </p>
                </>
              ) : (
                <p className="text-lg text-[var(--pencil-gray)] mb-8">
                  학습 시간을 자유롭게 측정해보세요
                </p>
              )}
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-[var(--sticker-mint)] text-white rounded-2xl text-xl font-bold shadow-lg hover:opacity-90 transition-opacity"
              >
                ▶ {hasSavedProgress ? '이어서 학습' : '학습 시작'}
              </button>
            </div>
          ) : (
            // 진행 중 / 일시정지
            <div className="w-full max-w-md">
              {/* 큰 타이머 */}
              <div className="text-center mb-8">
                <div className="font-mono text-6xl font-bold text-[var(--ink-blue)] mb-2">
                  {formatTime(elapsedSeconds)}
                </div>
                {hasEstimatedTime && (
                  <p className="text-sm text-[var(--pencil-gray)]">
                    / {quest.estimatedMinutes}분 예상
                  </p>
                )}
              </div>

              {/* 진행 바 (예상 시간이 있을 때만) */}
              {hasEstimatedTime && (
                <div className="mb-8">
                  <div className="h-4 bg-[var(--paper-lines)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        progressPercent >= 100 ? 'bg-[var(--sticker-coral)]' : 'bg-[var(--sticker-mint)]'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-[var(--pencil-gray)] mt-2">
                    {Math.round(progressPercent)}% 진행
                  </p>
                </div>
              )}

              {/* 상태 메시지 */}
              {displayStatus === 'PAUSED' && (
                <div className="postit text-center mb-6">
                  ⏸ 일시정지 중... 준비되면 다시 시작해요!
                </div>
              )}

              {hasEstimatedTime && elapsedSeconds >= quest.estimatedMinutes * 60 && displayStatus === 'RUNNING' && (
                <div className="postit text-center mb-6">
                  🎉 예상 시간을 넘겼어요! 조금만 더 힘내세요!
                </div>
              )}

              {/* 자동 저장 안내 */}
              <p className="text-center text-xs text-[var(--pencil-gray)] mb-6">
                💾 30초마다 자동 저장됩니다
              </p>

              {/* 컨트롤 버튼 */}
              <div className="flex justify-center gap-4">
                {displayStatus === 'RUNNING' ? (
                  <button
                    onClick={handlePause}
                    className="px-6 py-3 bg-[var(--paper-yellow)] text-[var(--ink-black)] rounded-xl font-medium shadow hover:opacity-90 transition-opacity"
                  >
                    ⏸ 일시정지
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="px-6 py-3 bg-[var(--sticker-mint)] text-white rounded-xl font-medium shadow hover:opacity-90 transition-opacity"
                  >
                    ▶ 계속하기
                  </button>
                )}

                <button
                  onClick={handleComplete}
                  className="px-6 py-3 bg-[var(--sticker-coral)] text-white rounded-xl font-medium shadow hover:opacity-90 transition-opacity"
                >
                  ✓ 완료
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 팁 (시작 전이나 진행 중일 때) */}
        {quest.tip && displayStatus !== 'COMPLETED' && (
          <div className="postit mt-8 text-sm">
            <span className="text-[var(--ink-black)]">💡 </span>
            {quest.tip}
          </div>
        )}
      </div>
    </div>
  );
}
