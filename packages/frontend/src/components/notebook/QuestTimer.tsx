/**
 * QuestTimer
 * 퀘스트 학습 타이머 컴포넌트
 *
 * FR-021: 학습 시작 유도
 * - 타이머 시작 시 예상 종료 시간 표시
 * - 경과 시간 실시간 표시
 * - 일시정지/재개 기능
 */

import { useState, useEffect, useCallback } from 'react';

interface QuestTimerProps {
  estimatedMinutes: number;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  isCompleted?: boolean;
}

type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED';

export function QuestTimer({
  estimatedMinutes,
  onStart,
  onPause,
  onResume,
  onComplete,
  isCompleted = false,
}: QuestTimerProps) {
  const [status, setStatus] = useState<TimerStatus>('IDLE');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

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
    setStartTime(new Date());
    setStatus('RUNNING');
    onStart?.();
  }, [onStart]);

  // 일시정지
  const handlePause = useCallback(() => {
    setStatus('PAUSED');
    onPause?.();
  }, [onPause]);

  // 재개
  const handleResume = useCallback(() => {
    setStatus('RUNNING');
    onResume?.();
  }, [onResume]);

  // 완료
  const handleComplete = useCallback(() => {
    setStatus('IDLE');
    onComplete?.();
  }, [onComplete]);

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 예상 종료 시간
  const getEstimatedEndTime = (): string => {
    if (!startTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + estimatedMinutes);
      return formatClockTime(now);
    }
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + estimatedMinutes);
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
            <span>학습 시작</span>
          </button>
          <span className="text-xs text-[var(--pencil-gray)]">
            지금 시작하면 <span className="font-semibold text-[var(--ink-blue)]">{getEstimatedEndTime()}</span>에 끝나요
          </span>
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
