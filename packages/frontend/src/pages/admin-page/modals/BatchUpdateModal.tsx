/**
 * Admin Page - Batch Update Modal
 * 배치 업데이트 모달
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import type { BatchUpdateProgress } from '../types';

interface BatchUpdateModalProps {
  onClose: () => void;
  progress: BatchUpdateProgress;
  onStartBatchUpdate: (options: {
    skipCompleted: boolean;
    onlyOutdated: boolean;
    maxCourses: number;
  }) => Promise<void>;
}

export function BatchUpdateModal({
  onClose,
  progress,
  onStartBatchUpdate,
}: BatchUpdateModalProps) {
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [onlyOutdated, setOnlyOutdated] = useState(false);
  const [maxCourses, setMaxCourses] = useState(50);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 로그 자동 스크롤
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.logs]);

  const handleStart = () => {
    onStartBatchUpdate({ skipCompleted, onlyOutdated, maxCourses });
  };

  const progressPercent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {progress.status === 'complete' ? '업데이트 완료' : '전체 강좌 업데이트'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
            title={progress.status === 'running' ? '백그라운드에서 계속 진행됩니다' : '닫기'}
          >
            <X size={20} />
          </button>
        </div>

        {/* 설정 화면 (idle 상태) */}
        {progress.status === 'idle' && (
          <IdleContent
            skipCompleted={skipCompleted}
            setSkipCompleted={setSkipCompleted}
            onlyOutdated={onlyOutdated}
            setOnlyOutdated={setOnlyOutdated}
            maxCourses={maxCourses}
            setMaxCourses={setMaxCourses}
            onStart={handleStart}
          />
        )}

        {/* 진행 화면 (running 상태) */}
        {progress.status === 'running' && (
          <RunningContent
            progress={progress}
            progressPercent={progressPercent}
            logsEndRef={logsEndRef}
            onClose={onClose}
          />
        )}

        {/* 완료 화면 */}
        {progress.status === 'complete' && (
          <CompleteContent progress={progress} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// Idle 상태 컨텐츠
function IdleContent({
  skipCompleted,
  setSkipCompleted,
  onlyOutdated,
  setOnlyOutdated,
  maxCourses,
  setMaxCourses,
  onStart,
}: {
  skipCompleted: boolean;
  setSkipCompleted: (v: boolean) => void;
  onlyOutdated: boolean;
  setOnlyOutdated: (v: boolean) => void;
  maxCourses: number;
  setMaxCourses: (v: number) => void;
  onStart: () => void;
}) {
  return (
    <>
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          모든 강좌의 커리큘럼을 최신 상태로 업데이트합니다.
          배치 처리로 안전하게 진행됩니다.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipCompleted}
              onChange={(e) => setSkipCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700">완강된 강좌 건너뛰기</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOutdated}
              onChange={(e) => setOnlyOutdated(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">7일 이상 업데이트 안 된 강좌만</span>
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">최대 처리 개수:</label>
            <select
              value={maxCourses}
              onChange={(e) => setMaxCourses(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value={10}>10개</option>
              <option value={25}>25개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
              <option value={200}>200개 (주의)</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
      >
        <PlayCircle size={20} />
        업데이트 시작
      </button>
    </>
  );
}

// Running 상태 컨텐츠
function RunningContent({
  progress,
  progressPercent,
  logsEndRef,
  onClose,
}: {
  progress: BatchUpdateProgress;
  progressPercent: number;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* 진행률 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>진행률</span>
          <span>{progress.completed} / {progress.total} ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-purple-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 현재 처리 중인 강좌 */}
      {progress.currentCourse && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              {progress.currentCourse.name || '처리 중...'}
            </span>
          </div>
        </div>
      )}

      {/* 통계 */}
      <StatsGrid
        updated={progress.updated}
        failed={progress.failed}
        skipped={progress.skipped}
      />

      {/* 로그 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-3 min-h-[150px] max-h-[200px]">
        <div className="space-y-1 text-xs">
          {progress.logs.map((log, idx) => (
            <LogItem key={idx} log={log} />
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* 백그라운드 진행 버튼 */}
      <button
        onClick={onClose}
        className="mt-4 w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
      >
        백그라운드에서 계속 (창 닫기)
      </button>
    </div>
  );
}

// Complete 상태 컨텐츠
function CompleteContent({
  progress,
  onClose,
}: {
  progress: BatchUpdateProgress;
  onClose: () => void;
}) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">업데이트 완료</h3>

      {/* 최종 통계 */}
      <StatsGrid
        updated={progress.updated}
        failed={progress.failed}
        skipped={progress.skipped}
        large
      />

      <button
        onClick={onClose}
        className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
      >
        닫기
      </button>
    </div>
  );
}

// 통계 그리드
function StatsGrid({
  updated,
  failed,
  skipped,
  large = false,
}: {
  updated: number;
  failed: number;
  skipped: number;
  large?: boolean;
}) {
  const padding = large ? 'p-3' : 'p-2';
  const textSize = large ? 'text-2xl' : 'text-lg';

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <div className={`bg-green-50 ${padding} rounded-lg text-center`}>
        <div className={`${textSize} font-bold text-green-600`}>{updated}</div>
        <div className="text-xs text-green-700">성공</div>
      </div>
      <div className={`bg-red-50 ${padding} rounded-lg text-center`}>
        <div className={`${textSize} font-bold text-red-600`}>{failed}</div>
        <div className="text-xs text-red-700">실패</div>
      </div>
      <div className={`bg-gray-50 ${padding} rounded-lg text-center`}>
        <div className={`${textSize} font-bold text-gray-600`}>{skipped}</div>
        <div className="text-xs text-gray-700">{large ? '스킵 (완강)' : '스킵'}</div>
      </div>
    </div>
  );
}

// 로그 아이템
function LogItem({ log }: { log: BatchUpdateProgress['logs'][0] }) {
  return (
    <div className="flex items-center gap-2">
      {log.success ? (
        <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
      ) : (
        <XCircle size={12} className="text-red-500 flex-shrink-0" />
      )}
      <span className={log.success ? 'text-gray-700' : 'text-red-600'}>
        {log.name}
        {log.success && log.diff !== undefined && (
          <span className="text-green-600 ml-1">
            {log.diff > 0 ? `+${log.diff}` : log.diff === 0 ? '변동없음' : log.diff}
          </span>
        )}
        {!log.success && log.error && (
          <span className="text-red-500 ml-1">- {log.error}</span>
        )}
      </span>
    </div>
  );
}
