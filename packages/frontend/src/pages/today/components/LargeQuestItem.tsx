/**
 * LargeQuestItem
 * 확대된 퀘스트 카드 컴포넌트
 * 기존 QuestCheckItem보다 더 크고 눈에 잘 띄는 UI
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuestWithPlan } from '../../../stores/questStore';
import { getTodayDateString, useQuestStore } from '../../../stores/questStore';

interface LargeQuestItemProps {
  quest: QuestWithPlan;
  isToday: boolean;
  onToggle: () => void;
}

// 인강 여부 판별
function isVideoLectureQuest(quest: QuestWithPlan): boolean {
  const title = quest.unitTitle || '';
  const selfStudyKeywords = ['자습', '문제풀이', '복습', '정리', '연습'];

  for (const keyword of selfStudyKeywords) {
    if (title.includes(keyword)) {
      return false;
    }
  }

  if (quest.isPractice) {
    return false;
  }

  const lectureKeywords = ['강', '인강', '강의', '영상', 'OT', '오리엔테이션'];
  for (const keyword of lectureKeywords) {
    if (title.includes(keyword)) {
      return true;
    }
  }

  if (/\d+강/.test(title)) {
    return true;
  }

  return false;
}

// 문제풀이/자습/교재 퀘스트 여부 판별
function isPracticeQuest(quest: QuestWithPlan): boolean {
  const title = quest.unitTitle || '';
  const range = quest.range || '';
  const practiceKeywords = ['자습', '문제풀이', '문제', '연습', '실전', '교재'];

  if (quest.isPractice) return true;

  for (const keyword of practiceKeywords) {
    if (title.includes(keyword) || range.includes(keyword)) {
      return true;
    }
  }
  return false;
}

// 초를 "44분38초" 또는 "1시간20분20초" 형식으로 포맷
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}시간${minutes}분${seconds}초`;
  }
  if (minutes > 0) {
    return `${minutes}분${seconds}초`;
  }
  return `${seconds}초`;
}

export function LargeQuestItem({ quest, isToday, onToggle }: LargeQuestItemProps) {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteText, setNoteText] = useState(quest.practiceNote || '');
  const updatePracticeNote = useQuestStore((state) => state.updatePracticeNote);

  const todayStr = getTodayDateString();
  const isPast = quest.date < todayStr;

  const showTimer = !isVideoLectureQuest(quest) &&
                    !quest.unitTitle?.includes('복습') &&
                    isToday && !quest.completed;

  const hasTimerRecord = quest.timerRecord && !quest.timerRecord.completed;

  useEffect(() => {
    setNoteText(quest.practiceNote || '');
  }, [quest.practiceNote]);

  const handleNoteSave = () => {
    if (quest.planId && quest.id) {
      updatePracticeNote(quest.planId, quest.id, noteText);
    }
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isToday) return;
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleStartTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/timer/${quest.planId}/${quest.id}`);
  };

  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-all duration-200 ${
        quest.completed
          ? 'bg-[var(--highlight-green)]/50 border border-[var(--sticker-mint)]/30'
          : 'bg-white border border-gray-100 hover:border-[var(--ink-blue)]/30 hover:shadow-sm'
      } ${isAnimating ? 'animate-wobble' : ''}`}
      onClick={handleCardClick}
    >
      {/* 메인 콘텐츠 */}
      <div className="flex items-start gap-3">
        {/* 체크박스 */}
        {isToday ? (
          <button
            onClick={handleToggleComplete}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              quest.completed
                ? 'bg-[var(--sticker-mint)] border-[var(--sticker-mint)] text-white'
                : 'border-gray-300 hover:border-[var(--ink-blue)]'
            }`}
          >
            {quest.completed && <span className="text-sm font-bold">✓</span>}
          </button>
        ) : (
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${
              quest.completed
                ? 'bg-[var(--sticker-mint)] text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {quest.completed ? '✓' : '−'}
          </div>
        )}

        {/* 퀘스트 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium leading-snug line-clamp-2 ${
                  quest.completed ? 'line-through text-[var(--pencil-gray)]' : 'text-[var(--ink-black)]'
                }`}
              >
                <span className="text-[var(--ink-blue)] mr-1">{quest.unitNumber}.</span>
                {quest.unitTitle}
              </p>

              {/* 범위 */}
              {quest.range && (
                <p className="text-xs text-[var(--pencil-gray)] mt-0.5 line-clamp-1">
                  {quest.range}
                </p>
              )}
            </div>

            {/* 시간 + 상태 */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {quest.estimatedMinutes > 0 && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  {quest.estimatedMinutes}분
                </span>
              )}
              {quest.completed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sticker-mint)] text-white">
                  완료
                </span>
              )}
            </div>
          </div>

          {/* 문제풀이 퀘스트: 접힌 상태에서 학습 시작 버튼 */}
          {!isExpanded && showTimer && isPracticeQuest(quest) && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleStartTimer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sticker-mint)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-xs"
              >
                <span>▶</span>
                <span>{hasTimerRecord ? '이어서 학습' : '학습 시작'}</span>
              </button>
              {hasTimerRecord && quest.timerRecord && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  이어서 {formatDuration(quest.timerRecord.elapsedSeconds)}
                </span>
              )}
            </div>
          )}

          {/* 문제풀이 퀘스트: 접힌 상태에서 완료 시간 표시 */}
          {!isExpanded && quest.completed && isPracticeQuest(quest) && quest.timerRecord?.completed && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[var(--sticker-mint)] font-medium">
                ✓ {formatDuration(quest.timerRecord.elapsedSeconds)} 완료
              </span>
            </div>
          )}

          {/* 확장 영역 화살표 */}
          <div className="flex items-center justify-center mt-1.5">
            <span className="text-xs text-[var(--pencil-gray)]">
              {isExpanded ? '▲ 접기' : '상세 ▼'}
            </span>
          </div>
        </div>
      </div>

      {/* 확장 상세 정보 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--line-light)]">
          {/* 토픽 태그들 */}
          {quest.topics && quest.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {quest.topics.map((topic, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    index % 3 === 0 ? 'bg-[var(--highlight-yellow)] text-amber-700' :
                    index % 3 === 1 ? 'bg-[var(--highlight-green)] text-emerald-700' :
                    'bg-[var(--highlight-blue)] text-blue-700'
                  }`}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* 학습 목표 */}
          {quest.objectives && quest.objectives.length > 0 && (
            <div className="mb-3 space-y-1">
              {quest.objectives.map((obj, index) => (
                <div key={index} className="flex items-start gap-1.5 text-xs text-[var(--pencil-gray)]">
                  <span className="text-[var(--sticker-mint)] flex-shrink-0">-</span>
                  <span>{obj}</span>
                </div>
              ))}
            </div>
          )}

          {/* 코치 팁 */}
          {quest.tip && (
            <div className="postit mb-3 text-xs">
              {quest.tip}
            </div>
          )}

          {/* 메모 영역 */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-[var(--ink-blue)] font-medium">메모</span>
            </div>
            {isPast ? (
              noteText ? (
                <div className="w-full p-3 text-xs border border-[var(--line-light)] rounded-lg bg-gray-50 text-[var(--pencil-gray)]">
                  {noteText}
                </div>
              ) : (
                <div className="w-full p-3 text-xs text-[var(--pencil-gray)] italic">
                  작성된 메모가 없습니다
                </div>
              )
            ) : (
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleNoteSave}
                onClick={(e) => e.stopPropagation()}
                placeholder="학습 중 메모를 남겨보세요..."
                className="w-full p-3 text-xs border border-[var(--line-light)] rounded-lg
                  bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none
                  resize-none font-['Pretendard']"
                rows={2}
              />
            )}
          </div>

          {/* 학습 타이머 버튼 */}
          {showTimer && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartTimer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--sticker-mint)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
              >
                <span>{hasTimerRecord ? '학습 계속' : '학습 시작'}</span>
              </button>
              {hasTimerRecord && quest.timerRecord && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  이어서 {formatDuration(quest.timerRecord.elapsedSeconds)}
                </span>
              )}
            </div>
          )}

          {/* 완료된 타이머 기록 */}
          {quest.timerRecord?.completed && (
            <div className="flex items-center gap-1.5 text-sm text-[var(--sticker-mint)] font-medium">
              <span>✓</span>
              <span>
                {formatDuration(quest.timerRecord.elapsedSeconds)} 학습 완료
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
