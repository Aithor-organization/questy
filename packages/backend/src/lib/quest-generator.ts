import { AnalyzedUnit } from './image-analyzer';
import { formatDate } from '@questybook/shared';

// 일일 퀘스트 정보
export interface DailyQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
}

// 난이도별 예상 학습 시간 (분)
const DIFFICULTY_MINUTES: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 30,
  medium: 45,
  hard: 60,
};

/**
 * 분석된 단원을 기반으로 일일 퀘스트를 생성합니다
 */
export function generateDailyQuests(
  analyzedUnits: AnalyzedUnit[],
  startUnit: number,
  endUnit: number,
  totalDays: number
): DailyQuest[] {
  // 범위 내 단원만 필터링
  const targetUnits = analyzedUnits.filter(
    (unit) => unit.unitNumber >= startUnit && unit.unitNumber <= endUnit
  );

  if (targetUnits.length === 0) {
    return [];
  }

  const quests: DailyQuest[] = [];
  const today = new Date();

  // 각 단원당 할당 일수 계산
  const daysPerUnit = totalDays / targetUnits.length;

  for (let day = 1; day <= totalDays; day++) {
    // 해당 날짜에 학습할 단원 인덱스 계산 (더 정확한 공식)
    const unitIndex = Math.min(
      Math.floor((day - 1) / daysPerUnit),
      targetUnits.length - 1
    );
    const unit = targetUnits[unitIndex];

    // 날짜 계산
    const questDate = new Date(today);
    questDate.setDate(today.getDate() + day - 1);

    // 현재 단원의 시작일과 종료일 계산
    const unitStartDay = Math.floor(unitIndex * daysPerUnit) + 1;
    const unitEndDay = Math.min(
      Math.floor((unitIndex + 1) * daysPerUnit),
      totalDays
    );
    const daysForThisUnit = unitEndDay - unitStartDay + 1;

    // 현재 단원에서 몇 번째 날인지 (0-based)
    const dayInUnit = day - unitStartDay;

    // 소단원 범위 결정
    const subSectionCount = unit.subSections.length;
    let range: string;

    if (subSectionCount === 0) {
      range = '전체';
    } else if (daysForThisUnit <= 1) {
      // 하루에 단원 전체
      range = unit.subSections.join(', ');
    } else {
      // 여러 날에 걸쳐 소단원 분배
      const sectionsPerDay = Math.ceil(subSectionCount / daysForThisUnit);
      const startIdx = dayInUnit * sectionsPerDay;
      const endIdx = Math.min(startIdx + sectionsPerDay, subSectionCount);

      if (startIdx < subSectionCount) {
        const sections = unit.subSections.slice(startIdx, endIdx);
        range = sections.length > 0 ? sections.join(', ') : '복습';
      } else {
        range = '복습';
      }
    }

    quests.push({
      day,
      date: formatDate(questDate),
      unitNumber: unit.unitNumber,
      unitTitle: unit.unitTitle,
      range,
      estimatedMinutes: DIFFICULTY_MINUTES[unit.difficulty],
    });
  }

  return quests;
}
