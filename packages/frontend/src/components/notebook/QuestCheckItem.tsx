/**
 * QuestCheckItem
 * 확장형 퀘스트 카드 컴포넌트
 *
 * - 기본: 제목 + 시간만 표시 (컴팩트)
 * - 클릭 시: 상세 정보 확장 (팁, 메모, 토픽 등)
 * - 자습/교재 퀘스트: 타이머 페이지로 이동 버튼
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuestWithPlan } from '../../stores/questStore';
import { getTodayDateString, useQuestStore } from '../../stores/questStore';

interface QuestCheckItemProps {
  quest: QuestWithPlan;
  onToggle: () => void;
}

// 날짜를 한국어 형식으로 포맷
function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

// 인강(영상 강의) 퀘스트 여부 판별
function isVideoLectureQuest(quest: QuestWithPlan): boolean {
  const title = quest.unitTitle || '';
  const range = quest.range || '';

  // 인강 관련 키워드
  const lectureKeywords = ['강', '인강', '강의', '영상', 'OT', '오리엔테이션'];

  // 자습/문제풀이/복습 키워드 (이건 인강이 아님)
  const selfStudyKeywords = ['자습', '문제풀이', '복습', '정리', '연습'];

  // 자습/복습 키워드가 있으면 인강이 아님
  for (const keyword of selfStudyKeywords) {
    if (title.includes(keyword) || range.includes(keyword)) {
      return false;
    }
  }

  // isPractice 플래그가 있으면 인강이 아님
  if (quest.isPractice) {
    return false;
  }

  // 강의 키워드가 있으면 인강
  for (const keyword of lectureKeywords) {
    if (title.includes(keyword)) {
      return true;
    }
  }

  // "1강", "2강" 등의 패턴
  if (/\d+강/.test(title)) {
    return true;
  }

  return false;
}

export function QuestCheckItem({ quest, onToggle }: QuestCheckItemProps) {
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteText, setNoteText] = useState(quest.practiceNote || '');
  const updatePracticeNote = useQuestStore((state) => state.updatePracticeNote);

  const todayStr = getTodayDateString();
  const isToday = quest.date === todayStr;
  const isPast = quest.date < todayStr;

  // 타이머 표시 여부: 인강/복습이 아닌 퀘스트만 (자습, 문제풀이, 교재)
  const showTimer = !isVideoLectureQuest(quest) &&
                    !quest.unitTitle?.includes('복습') &&
                    isToday && !quest.completed;

  // 이전 타이머 기록 존재 여부
  const hasTimerRecord = quest.timerRecord && !quest.timerRecord.completed;

  // quest.practiceNote가 변경되면 로컬 상태도 업데이트
  useEffect(() => {
    setNoteText(quest.practiceNote || '');
  }, [quest.practiceNote]);

  // 메모 저장 핸들러
  const handleNoteSave = () => {
    if (quest.planId && quest.id) {
      updatePracticeNote(quest.planId, quest.id, noteText);
    }
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 확장 방지
    if (!isToday) return;
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleCardClick = () => {
    if (hasDetails) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleStartTimer = (e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 확장/축소 방지
    navigate(`/timer/${quest.planId}/${quest.id}`);
  };

  // 상세 정보 존재 여부 (확장 가능 여부)
  // - 완료된 퀘스트, 과거 퀘스트도 확장 가능 (읽기 전용 모드)
  const hasDetails =
    quest.tip ||
    (quest.topics && quest.topics.length > 0) ||
    (quest.objectives && quest.objectives.length > 0) ||
    showTimer ||
    quest.timerRecord?.completed ||  // 완료된 타이머 기록 표시
    quest.practiceNote ||  // 메모가 있으면 표시
    isPast ||  // 과거 퀘스트는 항상 확장 가능 (기록 확인용)
    quest.completed;  // 완료된 퀘스트도 항상 확장 가능

  return (
    <div
      className={`quest-card mb-2 ${quest.completed ? 'completed' : ''} ${isAnimating ? 'animate-wobble' : ''} ${hasDetails ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      {/* === 기본 상태: 한 줄 요약 === */}
      <div className="flex items-center gap-3">
        {/* 체크박스 또는 상태 아이콘 */}
        {isToday ? (
          <button
            onClick={handleToggleComplete}
            className={`checkbox-notebook flex-shrink-0 ${quest.completed ? 'checked' : ''}`}
          >
            {quest.completed && <span className="checkmark">✓</span>}
          </button>
        ) : (
          // 과거 퀘스트: 읽기 전용 상태 아이콘
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${
              quest.completed
                ? 'bg-[var(--sticker-mint)] text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
            title={quest.completed ? '완료됨' : '미완료'}
          >
            {quest.completed ? '✓' : '−'}
          </div>
        )}

        {/* 제목 */}
        <div className="flex-1 min-w-0">
          <span
            className={`font-medium line-clamp-2 ${
              quest.completed ? 'line-through text-[var(--pencil-gray)]' : 'text-[var(--ink-black)]'
            }`}
          >
            <span className="text-[var(--ink-blue)] mr-1">{quest.unitNumber}.</span>
            {quest.unitTitle}
          </span>
        </div>

        {/* 시간 */}
        {quest.estimatedMinutes > 0 && (
          <span className="flex-shrink-0 text-sm text-[var(--pencil-gray)]">
            ⏱ {quest.estimatedMinutes}분
          </span>
        )}

        {/* 확장 화살표 (상세 정보 있을 때만) */}
        {hasDetails && (
          <span
            className={`text-[var(--pencil-gray)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            ▼
          </span>
        )}

        {/* 완료 뱃지 */}
        {quest.completed && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sticker-mint)] text-white">
            완료
          </span>
        )}
      </div>

      {/* === 확장 상태: 상세 정보 === */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--line-light)]">
          {/* 메타 정보 (날짜, 플랜, 페이지) */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              isToday ? 'bg-[var(--sticker-mint)] text-white' :
              isPast ? 'bg-gray-200 text-gray-500' :
              'bg-[var(--highlight-blue)] text-[var(--ink-blue)]'
            }`}>
              📅 {isToday ? '오늘' : formatDateKorean(quest.date)}
            </span>
            <span className="sticker sticker-coral text-xs">
              📚 {quest.planName}
            </span>
            {quest.pages && (
              <span className="text-xs text-[var(--pencil-gray)] font-mono">
                p.{quest.pages}
              </span>
            )}
          </div>

          {/* 범위 */}
          {quest.range && (
            <p className="text-sm text-[var(--pencil-gray)] mb-3">
              {quest.range}
            </p>
          )}

          {/* 토픽 태그들 */}
          {quest.topics && quest.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {quest.topics.map((topic, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-0.5 rounded ${
                    index % 3 === 0 ? 'highlight-yellow' :
                    index % 3 === 1 ? 'highlight-green' : 'highlight-blue'
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
                <div key={index} className="flex items-start gap-2 text-xs text-[var(--pencil-gray)]">
                  <span className="text-[var(--sticker-mint)] flex-shrink-0">→</span>
                  <span className="line-clamp-2">{obj}</span>
                </div>
              ))}
            </div>
          )}

          {/* 코치 팁 */}
          {quest.tip && (
            <div className="postit mb-3 text-sm">
              <span className="text-[var(--ink-black)]">💡 </span>
              {quest.tip}
            </div>
          )}

          {/* 메모 영역 */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--ink-blue)]">📝 메모</span>
              {noteText && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  ({noteText.length}자)
                </span>
              )}
              {isPast && noteText && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  (읽기 전용)
                </span>
              )}
            </div>
            {isPast ? (
              // 과거 퀘스트: 읽기 전용 메모 표시
              noteText ? (
                <div className="w-full p-3 text-sm border border-[var(--line-light)] rounded-lg bg-gray-50 text-[var(--pencil-gray)]">
                  {noteText}
                </div>
              ) : (
                <div className="w-full p-3 text-sm text-[var(--pencil-gray)] italic">
                  작성된 메모가 없습니다
                </div>
              )
            ) : (
              // 오늘/미래 퀘스트: 편집 가능한 메모
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleNoteSave}
                onClick={(e) => e.stopPropagation()}
                placeholder="학습 중 메모를 남겨보세요..."
                className="w-full p-3 text-sm border border-[var(--line-light)] rounded-lg
                  bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none
                  resize-none font-['Pretendard']"
                rows={3}
              />
            )}
          </div>

          {/* 학습 타이머 버튼 (자습/교재 퀘스트만) */}
          {showTimer && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartTimer}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--sticker-mint)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
              >
                <span>▶</span>
                <span>{hasTimerRecord ? '학습 계속하기' : '학습 시작'}</span>
              </button>
              {hasTimerRecord && quest.timerRecord && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  이어서 {Math.floor(quest.timerRecord.elapsedSeconds / 60)}분 진행 중
                </span>
              )}
              {!hasTimerRecord && quest.estimatedMinutes > 0 && (
                <span className="text-xs text-[var(--pencil-gray)]">
                  예상 {quest.estimatedMinutes}분
                </span>
              )}
            </div>
          )}

          {/* 완료된 타이머 기록 표시 */}
          {quest.timerRecord?.completed && (
            <div className="flex items-center gap-2 text-sm text-[var(--sticker-mint)]">
              <span>✓</span>
              <span>
                {Math.floor(quest.timerRecord.elapsedSeconds / 60)}분 학습 완료
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
