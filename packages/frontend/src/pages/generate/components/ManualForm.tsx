/**
 * ManualForm Component
 * 직접 퀘스트 생성 폼 - To-do list 스타일
 * 드래그앤드롭으로 순서 변경 가능
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ManualUnit {
  id: string;
  title: string;
  description: string; // 설명 (선택)
}

interface ManualFormProps {
  materialName: string;
  onMaterialNameChange: (name: string) => void;
  units: ManualUnit[];
  onUnitsChange: (units: ManualUnit[]) => void;
  isRepeatMode?: boolean;
  onRepeatModeChange?: (isRepeat: boolean) => void;
  repeatTargetDate?: string;
  onRepeatTargetDateChange?: (date: string) => void;
}

// 드래그 가능한 퀘스트 아이템 컴포넌트
function SortableQuestItem({
  unit,
  index,
  onRemove,
}: {
  unit: ManualUnit;
  index: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 bg-white rounded-lg border border-[var(--paper-lines)] ${
        isDragging ? 'shadow-lg opacity-90 z-10' : ''
      }`}
    >
      {/* 드래그 핸들 */}
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center text-[var(--pencil-gray)] hover:text-[var(--ink-black)] cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {/* 체크박스 스타일 번호 */}
      <span className="w-6 h-6 flex items-center justify-center border-2 border-[var(--sticker-mint)] text-[var(--sticker-mint)] text-xs font-bold rounded shrink-0">
        {index + 1}
      </span>

      {/* 퀘스트 정보 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[var(--ink-black)] truncate">
          {unit.title}
        </div>
        {unit.description && (
          <div className="text-xs text-[var(--pencil-gray)] truncate">
            {unit.description}
          </div>
        )}
      </div>

      {/* 삭제 버튼 */}
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 1l12 12M1 13L13 1" />
        </svg>
      </button>
    </div>
  );
}

export function ManualForm({
  materialName,
  onMaterialNameChange,
  units,
  onUnitsChange,
  isRepeatMode = false,
  onRepeatModeChange,
  repeatTargetDate = '',
  onRepeatTargetDateChange,
}: ManualFormProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // 최대 목표 날짜 (1년 후)
  const maxTargetDate = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  })();

  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0];

  // 드래그앤드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 종료 시 순서 변경
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = units.findIndex((u) => u.id === active.id);
      const newIndex = units.findIndex((u) => u.id === over.id);
      onUnitsChange(arrayMove(units, oldIndex, newIndex));
    }
  };

  // 퀘스트 추가
  const handleAddQuest = () => {
    if (!newTitle.trim()) return;

    const newQuest: ManualUnit = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      description: newDescription.trim(),
    };

    onUnitsChange([...units, newQuest]);
    setNewTitle('');
    setNewDescription('');
  };

  // 퀘스트 삭제
  const handleRemoveQuest = (id: string) => {
    onUnitsChange(units.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* 반복 퀘스트 토글 */}
      {onRepeatModeChange && (
        <div className="p-4 bg-[var(--highlight-blue)] rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--ink-black)]">🔁 반복 퀘스트</span>
              <p className="text-xs text-[var(--pencil-gray)] mt-0.5">
                매일 같은 퀘스트를 목표 날짜까지 반복
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRepeatModeChange(!isRepeatMode)}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isRepeatMode ? 'bg-[var(--sticker-mint)]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isRepeatMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 반복 모드일 때 목표 날짜 선택 */}
          {isRepeatMode && onRepeatTargetDateChange && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <label className="block text-sm text-[var(--ink-black)] mb-2">
                🎯 목표 날짜 (최대 1년)
              </label>
              <input
                type="date"
                value={repeatTargetDate}
                onChange={(e) => onRepeatTargetDateChange(e.target.value)}
                min={today}
                max={maxTargetDate}
                className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--sticker-mint)] focus:border-transparent outline-none"
              />
              {repeatTargetDate && (
                <p className="mt-1 text-xs text-[var(--sticker-mint)]">
                  ✨ {new Date(repeatTargetDate).toLocaleDateString('ko-KR')}까지 매일 퀘스트가 반복됩니다
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 플랜 이름 입력 */}
      <div>
        <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
          📋 플랜 이름
        </label>
        <input
          type="text"
          value={materialName}
          onChange={(e) => onMaterialNameChange(e.target.value)}
          placeholder="예: 영어 단어 암기, 수학 문제 풀이..."
          className="w-full px-4 py-3 border border-[var(--paper-lines)] rounded-xl focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent outline-none"
        />
      </div>

      {/* 추가된 퀘스트 목록 */}
      {units.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-[var(--ink-black)]">
              ✅ 추가된 퀘스트 ({units.length}개)
            </label>
            <span className="text-xs text-[var(--pencil-gray)]">
              드래그하여 순서 변경
            </span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={units.map((u) => u.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                {units.map((unit, index) => (
                  <SortableQuestItem
                    key={unit.id}
                    unit={unit}
                    index={index}
                    onRemove={() => handleRemoveQuest(unit.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* 새 퀘스트 추가 폼 */}
      <div className="p-4 bg-[var(--paper-cream)] border-2 border-dashed border-[var(--paper-lines)] rounded-xl">
        <label className="block text-sm font-medium text-[var(--ink-black)] mb-3">
          ➕ 새 퀘스트 추가
        </label>

        <div className="space-y-3">
          {/* 퀘스트 제목 */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="퀘스트 제목 (예: 1단원 복습하기)"
            className="w-full px-3 py-2.5 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--sticker-mint)] focus:border-transparent outline-none text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddQuest();
              }
            }}
          />

          {/* 설명 (선택) */}
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="w-full px-3 py-2.5 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--sticker-mint)] focus:border-transparent outline-none text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddQuest();
              }
            }}
          />

          {/* 추가 버튼 */}
          <button
            type="button"
            onClick={handleAddQuest}
            disabled={!newTitle.trim()}
            className="w-full py-2.5 bg-[var(--sticker-mint)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
          >
            퀘스트 추가
          </button>
        </div>
      </div>

      {/* 안내 메시지 */}
      {units.length === 0 && (
        <div className="text-center py-6 text-[var(--pencil-gray)] text-sm">
          <div className="text-2xl mb-2">📝</div>
          위에서 할 일을 추가해주세요
        </div>
      )}
    </div>
  );
}
