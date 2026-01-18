/**
 * ManualForm Component
 * 직접 플랜 생성 폼
 */

import { useState } from 'react';

export interface ManualUnit {
  id: string;
  title: string;
  range: string;
  estimatedMinutes: number;
}

interface ManualFormProps {
  materialName: string;
  onMaterialNameChange: (name: string) => void;
  units: ManualUnit[];
  onUnitsChange: (units: ManualUnit[]) => void;
}

export function ManualForm({
  materialName,
  onMaterialNameChange,
  units,
  onUnitsChange,
}: ManualFormProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newRange, setNewRange] = useState('');
  const [newMinutes, setNewMinutes] = useState(30);

  // 단원 추가
  const handleAddUnit = () => {
    if (!newTitle.trim()) return;

    const newUnit: ManualUnit = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      range: newRange.trim(),
      estimatedMinutes: newMinutes,
    };

    onUnitsChange([...units, newUnit]);
    setNewTitle('');
    setNewRange('');
    setNewMinutes(30);
  };

  // 단원 삭제
  const handleRemoveUnit = (id: string) => {
    onUnitsChange(units.filter(u => u.id !== id));
  };

  // 단원 순서 변경 (위로)
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newUnits = [...units];
    [newUnits[index - 1], newUnits[index]] = [newUnits[index], newUnits[index - 1]];
    onUnitsChange(newUnits);
  };

  // 단원 순서 변경 (아래로)
  const handleMoveDown = (index: number) => {
    if (index === units.length - 1) return;
    const newUnits = [...units];
    [newUnits[index], newUnits[index + 1]] = [newUnits[index + 1], newUnits[index]];
    onUnitsChange(newUnits);
  };

  // 총 예상 시간 계산
  const totalMinutes = units.reduce((sum, u) => sum + u.estimatedMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="space-y-6">
      {/* 교재명 입력 */}
      <div>
        <label className="block text-sm font-medium text-[var(--ink-black)] mb-2">
          📚 플랜 이름
        </label>
        <input
          type="text"
          value={materialName}
          onChange={(e) => onMaterialNameChange(e.target.value)}
          placeholder="예: 수학의 정석, 영어 단어장..."
          className="w-full px-4 py-3 border border-[var(--paper-lines)] rounded-xl focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent outline-none"
        />
      </div>

      {/* 추가된 단원 목록 */}
      {units.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--ink-black)]">
              📝 추가된 단원 ({units.length}개)
            </label>
            <span className="text-xs text-[var(--pencil-gray)]">
              총 {totalHours > 0 ? `${totalHours}시간 ` : ''}{remainingMinutes}분
            </span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {units.map((unit, index) => (
              <div
                key={unit.id}
                className="flex items-center gap-2 p-3 bg-[var(--paper-cream)] rounded-lg border border-[var(--paper-lines)]"
              >
                {/* 순서 표시 */}
                <span className="w-6 h-6 flex items-center justify-center bg-[var(--ink-blue)] text-white text-xs rounded-full shrink-0">
                  {index + 1}
                </span>

                {/* 단원 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[var(--ink-black)] truncate">
                    {unit.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--pencil-gray)]">
                    {unit.range && <span>{unit.range}</span>}
                    <span>• {unit.estimatedMinutes}분</span>
                  </div>
                </div>

                {/* 순서 변경 버튼 */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="w-5 h-5 flex items-center justify-center text-[var(--pencil-gray)] hover:text-[var(--ink-black)] disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === units.length - 1}
                    className="w-5 h-5 flex items-center justify-center text-[var(--pencil-gray)] hover:text-[var(--ink-black)] disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => handleRemoveUnit(unit.id)}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 새 단원 추가 폼 */}
      <div className="p-4 bg-white border-2 border-dashed border-[var(--paper-lines)] rounded-xl">
        <label className="block text-sm font-medium text-[var(--ink-black)] mb-3">
          ➕ 새 단원 추가
        </label>

        <div className="space-y-3">
          {/* 단원 제목 */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="단원 제목 (예: 1단원 집합)"
            className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUnit();
              }
            }}
          />

          {/* 범위 & 시간 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRange}
              onChange={(e) => setNewRange(e.target.value)}
              placeholder="범위 (선택)"
              className="flex-1 px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent outline-none text-sm"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newMinutes}
                onChange={(e) => setNewMinutes(Math.max(5, parseInt(e.target.value) || 0))}
                min={5}
                max={180}
                className="w-16 px-2 py-2 border border-[var(--paper-lines)] rounded-lg focus:ring-2 focus:ring-[var(--ink-blue)] focus:border-transparent outline-none text-sm text-center"
              />
              <span className="text-sm text-[var(--pencil-gray)]">분</span>
            </div>
          </div>

          {/* 추가 버튼 */}
          <button
            type="button"
            onClick={handleAddUnit}
            disabled={!newTitle.trim()}
            className="w-full py-2 bg-[var(--ink-blue)] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-blue)]/90 transition-colors"
          >
            단원 추가
          </button>
        </div>
      </div>

      {/* 안내 메시지 */}
      {units.length === 0 && (
        <div className="text-center py-4 text-[var(--pencil-gray)] text-sm">
          위에서 단원을 추가해주세요
        </div>
      )}
    </div>
  );
}
