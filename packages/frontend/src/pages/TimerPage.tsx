/**
 * TimerPage
 * 전용 학습 타이머 페이지
 *
 * - 전체 화면 타이머 UI
 * - 경과 시간 실시간 표시
 * - 완료 시 자동 기록 저장
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'
import { useQuestStore } from '../stores/questStore';

type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export function TimerPage() {
  const { planId, questId } = useParams<{ planId: string; questId: string }>();
  const navigate = useNavigate();

  const getQuestById = useQuestStore((state) => state.getQuestById);
  const updateTimerRecord = useQuestStore((state) => state.updateTimerRecord);
  const toggleQuestComplete = useQuestStore((state) => state.toggleQuestComplete);

  const quest = planId && questId ? getQuestById(planId, questId) : undefined;

  const [status, setStatus] = useState<TimerStatus>('IDLE');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // 이전 타이머 기록이 있으면 복원
  useEffect(() => {
    if (quest?.timerRecord && !quest.timerRecord.completed) {
      setElapsedSeconds(quest.timerRecord.elapsedSeconds);
      setStartTime(new Date(quest.timerRecord.startedAt));
      setStatus('PAUSED');
    }
  }, [quest?.timerRecord]);

  // 타이머 업데이트
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'RUNNING') {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // 시작
  const handleStart = useCallback(() => {
    const now = new Date();
    setStartTime(now);
    setStatus('RUNNING');

    if (planId && questId) {
      updateTimerRecord(planId, questId, {
        startedAt: now.toISOString(),
        elapsedSeconds: 0,
        completed: false,
      });
    }
  }, [planId, questId, updateTimerRecord]);

  // 일시정지
  const handlePause = useCallback(() => {
    setStatus('PAUSED');

    if (planId && questId && startTime) {
      updateTimerRecord(planId, questId, {
        startedAt: startTime.toISOString(),
        elapsedSeconds,
        completed: false,
      });
    }
  }, [planId, questId, startTime, elapsedSeconds, updateTimerRecord]);

  // 재개
  const handleResume = useCallback(() => {
    setStatus('RUNNING');
  }, []);

  // 완료
  const handleComplete = useCallback(() => {
    const now = new Date();
    setStatus('COMPLETED');

    if (planId && questId && startTime) {
      updateTimerRecord(planId, questId, {
        startedAt: startTime.toISOString(),
        endedAt: now.toISOString(),
        elapsedSeconds,
        completed: true,
      });

      // 퀘스트도 완료 처리
      toggleQuestComplete(planId, questId);
    }

    // 2초 후 메인으로 돌아가기
    setTimeout(() => {
      navigate('/');
    }, 2000);
  }, [planId, questId, startTime, elapsedSeconds, updateTimerRecord, toggleQuestComplete, navigate]);

  // 나가기 (저장 후)
  const handleExit = useCallback(() => {
    if (status === 'RUNNING' || status === 'PAUSED') {
      if (planId && questId && startTime) {
        updateTimerRecord(planId, questId, {
          startedAt: startTime.toISOString(),
          elapsedSeconds,
          completed: false,
        });
      }
    }
    navigate(-1);
  }, [status, planId, questId, startTime, elapsedSeconds, updateTimerRecord, navigate]);

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
    const baseTime = startTime || new Date();
    const endTime = new Date(baseTime);
    endTime.setMinutes(endTime.getMinutes() + quest.estimatedMinutes);
    return formatClockTime(endTime);
  };

  // 진행률 (예상 시간이 있을 때만 계산)
  const progressPercent = quest && quest.estimatedMinutes > 0
    ? Math.min(100, (elapsedSeconds / (quest.estimatedMinutes * 60)) * 100)
    : 0;

  // 예상 시간 존재 여부
  const hasEstimatedTime = quest && quest.estimatedMinutes > 0;

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
          {status === 'COMPLETED' ? (
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
          ) : status === 'IDLE' ? (
            // 시작 전
            <div className="text-center">
              <p className="text-6xl mb-6">⏱️</p>
              {hasEstimatedTime ? (
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
                ▶ 학습 시작
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
              {status === 'PAUSED' && (
                <div className="postit text-center mb-6">
                  ⏸ 일시정지 중... 준비되면 다시 시작해요!
                </div>
              )}

              {hasEstimatedTime && elapsedSeconds >= quest.estimatedMinutes * 60 && status === 'RUNNING' && (
                <div className="postit text-center mb-6">
                  🎉 예상 시간을 넘겼어요! 조금만 더 힘내세요!
                </div>
              )}

              {/* 컨트롤 버튼 */}
              <div className="flex justify-center gap-4">
                {status === 'RUNNING' ? (
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
        {quest.tip && status !== 'COMPLETED' && (
          <div className="postit mt-8 text-sm">
            <span className="text-[var(--ink-black)]">💡 </span>
            {quest.tip}
          </div>
        )}
      </div>
    </div>
  );
}
