/**
 * QuestCheckItem
 * 노트북 스타일의 체크리스트 아이템 + 학습 타이머
 *
 * FR-021: 학습 시작 유도
 * - 타이머 시작 시 예상 종료 시간 표시
 */

import { useState } from 'react';
import type { QuestWithPlan } from '../../stores/questStore';
import { QuestTimer } from './QuestTimer';

interface QuestCheckItemProps {
  quest: QuestWithPlan;
  onToggle: () => void;
}

export function QuestCheckItem({ quest, onToggle }: QuestCheckItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = () => {
    setIsAnimating(true);
    onToggle();
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div
      className={`quest-card mb-3 ${quest.completed ? 'completed' : ''} ${isAnimating ? 'animate-wobble' : ''}`}
    >
      {/* 상단: 플랜 태그 + 페이지 */}
      <div className="flex items-center justify-between mb-2">
        <span className="sticker sticker-coral text-xs">
          📚 {quest.planName}
        </span>
        {quest.pages && (
          <span className="text-xs text-[var(--pencil-gray)] font-mono">
            p.{quest.pages}
          </span>
        )}
      </div>

      {/* 메인: 체크박스 + 제목 */}
      <div className="flex items-start gap-3">
        <button
          onClick={handleToggle}
          className={`checkbox-notebook flex-shrink-0 mt-1 ${quest.completed ? 'checked' : ''}`}
        >
          {quest.completed && <span className="checkmark">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <h3
            className={`font-semibold text-[var(--ink-black)] ${
              quest.completed ? 'line-through text-[var(--pencil-gray)]' : ''
            }`}
          >
            <span className="text-[var(--ink-blue)] mr-1">{quest.unitNumber}.</span>
            {quest.unitTitle}
          </h3>
          <p className="text-sm text-[var(--pencil-gray)] mt-1">
            {quest.range}
          </p>
        </div>

        {/* 예상 시간 */}
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-[var(--pencil-gray)]">⏱</span>
          <span className="text-sm font-medium text-[var(--ink-black)] ml-1">
            {quest.estimatedMinutes}분
          </span>
        </div>
      </div>

      {/* 토픽 태그들 */}
      {quest.topics && quest.topics.length > 0 && !quest.completed && (
        <div className="flex flex-wrap gap-1 mt-3 pl-9">
          {quest.topics.slice(0, 4).map((topic, index) => (
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
          {quest.topics.length > 4 && (
            <span className="text-xs text-[var(--pencil-gray)]">
              +{quest.topics.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 학습 목표 */}
      {quest.objectives && quest.objectives.length > 0 && !quest.completed && (
        <div className="mt-3 pl-9 space-y-1">
          {quest.objectives.slice(0, 2).map((obj, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-[var(--pencil-gray)]">
              <span className="text-[var(--sticker-mint)]">→</span>
              <span>{obj}</span>
            </div>
          ))}
        </div>
      )}

      {/* 코치 팁 */}
      {quest.tip && !quest.completed && (
        <div className="postit mt-3 ml-9 text-sm">
          <span className="text-[var(--ink-black)]">💡 </span>
          {quest.tip}
        </div>
      )}

      {/* 학습 타이머 (FR-021) */}
      <QuestTimer
        estimatedMinutes={quest.estimatedMinutes}
        onComplete={handleToggle}
        isCompleted={quest.completed}
      />

      {/* 완료 스탬프 */}
      {quest.completed && (
        <div className="absolute top-2 right-2 sticker sticker-mint animate-stamp">
          ✓ 완료!
        </div>
      )}
    </div>
  );
}
