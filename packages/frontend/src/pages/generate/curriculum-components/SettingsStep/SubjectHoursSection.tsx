/**
 * SubjectHoursSection
 * 과목별 학습 시간/비중 설정 섹션
 */

import { useState } from 'react';
import type { SubjectRatio, SubjectHours, SubjectDays } from '../../../../types/curriculum';
import { DAY_LABELS } from './types';

interface SubjectHoursSectionProps {
  subjectRatio: SubjectRatio;
  subjectHours: SubjectHours;
  subjectDays: SubjectDays;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  onSubjectHoursChange: (hours: SubjectHours) => void;
  onSubjectDaysChange: (days: SubjectDays) => void;
}

export function SubjectHoursSection({
  subjectRatio,
  subjectHours,
  subjectDays,
  onSubjectRatioChange,
  onSubjectHoursChange,
  onSubjectDaysChange,
}: SubjectHoursSectionProps) {
  const [inputMode, setInputMode] = useState<'hours' | 'ratio'>('hours');

  const totalHours = Object.values(subjectHours).reduce((sum, h) => sum + (h || 0), 0);
  const hasAtLeastOneSubject = Object.values(subjectHours).some(h => h !== null && h > 0);
  const totalRatio = Object.values(subjectRatio).reduce((a, b) => a + b, 0);
  const isValidRatio = totalRatio === 100;

  const toggleDay = (subject: keyof SubjectDays, day: number) => {
    const currentDays = subjectDays[subject];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    onSubjectDaysChange({ ...subjectDays, [subject]: newDays });
  };

  return (
    <div className="notebook-card p-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-medium">📊 과목별 학습 시간</label>
        <div className="flex gap-2">
          <button
            onClick={() => setInputMode('hours')}
            className={`px-2 py-1 text-xs rounded ${inputMode === 'hours' ? 'bg-[var(--ink-blue)] text-white' : 'bg-gray-100'}`}
          >
            시간
          </button>
          <button
            onClick={() => setInputMode('ratio')}
            className={`px-2 py-1 text-xs rounded ${inputMode === 'ratio' ? 'bg-[var(--ink-blue)] text-white' : 'bg-gray-100'}`}
          >
            비중(%)
          </button>
        </div>
      </div>

      {/* 시간 모드 */}
      {inputMode === 'hours' ? (
        <HoursInput
          subjectHours={subjectHours}
          subjectDays={subjectDays}
          totalHours={totalHours}
          hasAtLeastOneSubject={hasAtLeastOneSubject}
          onSubjectHoursChange={onSubjectHoursChange}
          toggleDay={toggleDay}
        />
      ) : (
        <RatioInput
          subjectRatio={subjectRatio}
          subjectDays={subjectDays}
          totalRatio={totalRatio}
          isValidRatio={isValidRatio}
          onSubjectRatioChange={onSubjectRatioChange}
          toggleDay={toggleDay}
        />
      )}
    </div>
  );
}

function HoursInput({
  subjectHours,
  subjectDays,
  totalHours,
  hasAtLeastOneSubject,
  onSubjectHoursChange,
  toggleDay,
}: {
  subjectHours: SubjectHours;
  subjectDays: SubjectDays;
  totalHours: number;
  hasAtLeastOneSubject: boolean;
  onSubjectHoursChange: (hours: SubjectHours) => void;
  toggleDay: (subject: keyof SubjectDays, day: number) => void;
}) {
  return (
    <>
      {Object.entries(subjectHours).map(([subject, hours]) => (
        <SubjectRow
          key={subject}
          subject={subject}
          value={hours}
          subjectDays={subjectDays}
          inputType="number"
          onValueChange={(value) => {
            onSubjectHoursChange({
              ...subjectHours,
              [subject as keyof SubjectHours]: value === '' ? null : Number(value),
            });
          }}
          toggleDay={toggleDay}
        />
      ))}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
        <span className="text-sm text-gray-600">합계</span>
        <span className="text-sm font-bold text-[var(--ink-blue)]">{totalHours}시간</span>
      </div>
      {!hasAtLeastOneSubject && (
        <p className="text-xs text-yellow-600 mt-2">⚠️ 최소 1개 과목의 학습 시간을 입력해주세요</p>
      )}
      {hasAtLeastOneSubject && (
        <p className="text-xs text-gray-500 mt-2">💡 비워둔 과목은 커리큘럼에 포함되지 않습니다.</p>
      )}
    </>
  );
}

function RatioInput({
  subjectRatio,
  subjectDays,
  totalRatio,
  isValidRatio,
  onSubjectRatioChange,
  toggleDay,
}: {
  subjectRatio: SubjectRatio;
  subjectDays: SubjectDays;
  totalRatio: number;
  isValidRatio: boolean;
  onSubjectRatioChange: (ratio: SubjectRatio) => void;
  toggleDay: (subject: keyof SubjectDays, day: number) => void;
}) {
  return (
    <>
      {Object.entries(subjectRatio).map(([subject, ratio]) => (
        <SubjectRow
          key={subject}
          subject={subject}
          value={ratio}
          subjectDays={subjectDays}
          inputType="range"
          onValueChange={(value) => {
            onSubjectRatioChange({
              ...subjectRatio,
              [subject as keyof SubjectRatio]: Number(value),
            });
          }}
          toggleDay={toggleDay}
        />
      ))}
      {!isValidRatio && (
        <p className="text-xs text-red-500 mt-2">
          ⚠️ 과목별 비중의 합이 100%가 되어야 합니다 (현재: {totalRatio}%)
        </p>
      )}
    </>
  );
}

function SubjectRow({
  subject,
  value,
  subjectDays,
  inputType,
  onValueChange,
  toggleDay,
}: {
  subject: string;
  value: number | null;
  subjectDays: SubjectDays;
  inputType: 'number' | 'range';
  onValueChange: (value: string) => void;
  toggleDay: (subject: keyof SubjectDays, day: number) => void;
}) {
  return (
    <div className="mb-4 pb-3 border-b border-dashed border-gray-200 last:border-b-0 last:pb-0 last:mb-3">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-14 text-sm font-medium">{subject}</span>
        {inputType === 'number' ? (
          <>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={value ?? ''}
              placeholder="미입력"
              onChange={(e) => onValueChange(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-[var(--paper-lines)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ink-blue)]"
            />
            <span className="w-12 text-right text-sm text-gray-500">시간</span>
          </>
        ) : (
          <>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={value ?? 0}
              onChange={(e) => onValueChange(e.target.value)}
              className="flex-1 accent-[var(--ink-blue)]"
            />
            <span className="w-12 text-right text-sm font-medium">{value}%</span>
          </>
        )}
      </div>
      {/* 요일 선택 버튼 */}
      <DaySelector
        subject={subject as keyof SubjectDays}
        subjectDays={subjectDays}
        toggleDay={toggleDay}
      />
    </div>
  );
}

function DaySelector({
  subject,
  subjectDays,
  toggleDay,
}: {
  subject: keyof SubjectDays;
  subjectDays: SubjectDays;
  toggleDay: (subject: keyof SubjectDays, day: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 ml-14">
      <span className="text-xs text-gray-400 mr-1">요일:</span>
      {DAY_LABELS.map((label, dayIndex) => {
        const isSelected = subjectDays[subject].includes(dayIndex);
        return (
          <button
            key={dayIndex}
            type="button"
            onClick={() => toggleDay(subject, dayIndex)}
            className={`w-6 h-6 text-xs rounded-full transition-colors ${
              isSelected
                ? 'bg-[var(--ink-blue)] text-white'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
