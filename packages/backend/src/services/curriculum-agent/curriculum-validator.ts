// CurriculumValidator - 생성된 커리큘럼 검증
// 비현실적인 일정을 사전에 감지하여 사용자에게 알림

import {
  Quest,
  QuestType,
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  ValidationConfig,
} from './types.js';

// 기본 검증 설정
const DEFAULT_CONFIG: ValidationConfig = {
  maxLecturesPerDayWarning: 8,
  maxLecturesPerDayError: 15,
  maxMinutesPerDayWarningRatio: 1.2,
  maxMinutesPerDayErrorRatio: 2.0,
  overloadRatioWarning: 2.0,
  overloadRatioError: 4.0,
  concentrationWarning: 0.30,
  concentrationError: 0.50,
};

export class CurriculumValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 생성된 커리큘럼 검증
   */
  validate(quests: Quest[], dailyStudyMinutes: number): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 강의 타입 퀘스트만 필터링
    const lectureQuests = quests.filter(q => q.questType === QuestType.LECTURE);

    if (lectureQuests.length === 0) {
      return this.createResult(issues, [], 0, 0, 0);
    }

    // 일별 그룹화
    const questsByDate = this.groupByDate(quests);
    const lecturesByDate = this.groupByDate(lectureQuests);

    // 통계 계산
    const dates = Object.keys(lecturesByDate);
    const currentDays = dates.length;
    const totalLectures = lectureQuests.length;
    const avgLecturesPerDay = totalLectures / currentDays;
    const totalMinutes = quests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    const avgMinutesPerDay = totalMinutes / Object.keys(questsByDate).length;

    // 검증 1: 일별 강의 수 체크
    this.validateDailyLectureCount(lecturesByDate, totalLectures, issues);

    // 검증 2: 일별 학습 시간 체크
    this.validateDailyStudyTime(questsByDate, dailyStudyMinutes, issues);

    // 검증 3: 마지막 날 과부하 체크
    this.validateLastDayOverload(lecturesByDate, avgLecturesPerDay, issues);

    // 검증 4: 특정 날 집중도 체크
    this.validateConcentration(lecturesByDate, totalLectures, issues);

    // 검증 5: 연속 학습일 체크
    this.validateConsecutiveDays(questsByDate, issues);

    // 정확한 제안 계산 (전체 데이터 기반)
    const suggestions = this.calculateAccurateSuggestions(
      issues,
      totalLectures,
      totalMinutes,
      currentDays,
      dailyStudyMinutes
    );

    return this.createResult(issues, suggestions, totalLectures, totalMinutes, currentDays);
  }

  /**
   * 정확한 최소 필요 일수 및 제안 계산
   */
  private calculateAccurateSuggestions(
    issues: ValidationIssue[],
    totalLectures: number,
    totalMinutes: number,
    currentDays: number,
    dailyStudyMinutes: number
  ): string[] {
    const suggestions: string[] = [];
    const hasErrors = issues.some(i => i.severity === ValidationSeverity.INVALID);

    if (!hasErrors) return suggestions;

    // 1. 강의 수 기반 최소 일수 (하루 최대 8개로 여유있게)
    const maxLecturesPerDay = 8; // 여유있는 기준
    const minDaysForLectures = Math.ceil(totalLectures / maxLecturesPerDay);

    // 2. 학습 시간 기반 최소 일수 (순공시간의 80%만 인강에 사용)
    const effectiveDailyMinutes = dailyStudyMinutes * 0.8;
    const minDaysForTime = Math.ceil(totalMinutes / effectiveDailyMinutes);

    // 3. 두 기준 중 더 큰 값 선택 + 여유 버퍼 20%
    const minRequiredDays = Math.ceil(Math.max(minDaysForLectures, minDaysForTime) * 1.2);

    // 현재 일수와 비교하여 필요한 추가 일수 계산
    const additionalDaysNeeded = minRequiredDays - currentDays;

    if (additionalDaysNeeded > 0) {
      suggestions.push(`목표일을 최소 ${additionalDaysNeeded}일 이상 연장해주세요. (권장: ${minRequiredDays}일)`);
    }

    // 대안 제안: 순공시간 늘리기
    if (dailyStudyMinutes < 14 * 60) { // 14시간 미만이면 순공시간 증가 제안
      const neededMinutes = Math.ceil(totalMinutes / currentDays / 0.8);
      const neededHours = Math.min(14, Math.ceil(neededMinutes / 60));
      const currentHours = Math.round(dailyStudyMinutes / 60);
      if (neededHours > currentHours) {
        suggestions.push(`또는 일일 순공시간을 ${neededHours}시간으로 늘려주세요. (현재: ${currentHours}시간)`);
      }
    }

    // 강좌 수 줄이기 제안
    const maxLecturesForCurrentDays = currentDays * maxLecturesPerDay;
    if (totalLectures > maxLecturesForCurrentDays) {
      suggestions.push(`또는 강좌 수를 ${maxLecturesForCurrentDays}개 이하로 줄여주세요. (현재: ${totalLectures}개)`);
    }

    return suggestions;
  }

  /**
   * 일별 강의 수 검증
   */
  private validateDailyLectureCount(
    lecturesByDate: Record<string, Quest[]>,
    totalLectures: number,
    issues: ValidationIssue[]
  ): void {
    for (const [date, lectures] of Object.entries(lecturesByDate)) {
      const count = lectures.length;

      if (count >= this.config.maxLecturesPerDayError) {
        issues.push({
          severity: ValidationSeverity.INVALID,
          code: 'EXCESSIVE_DAILY_LECTURES',
          message: `${date}에 ${count}개 강의가 배정되었습니다. 하루에 ${this.config.maxLecturesPerDayError}개 이상은 현실적으로 불가능합니다.`,
          details: { date, count, expected: this.config.maxLecturesPerDayError, actual: count },
        });
      } else if (count >= this.config.maxLecturesPerDayWarning) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'HIGH_DAILY_LECTURES',
          message: `${date}에 ${count}개 강의가 배정되었습니다. 하루 ${this.config.maxLecturesPerDayWarning}개 이상은 힘들 수 있습니다.`,
          details: { date, count, expected: this.config.maxLecturesPerDayWarning, actual: count },
        });
      }
    }
  }

  /**
   * 일별 학습 시간 검증
   */
  private validateDailyStudyTime(
    questsByDate: Record<string, Quest[]>,
    dailyStudyMinutes: number,
    issues: ValidationIssue[]
  ): void {
    const errorThreshold = dailyStudyMinutes * this.config.maxMinutesPerDayErrorRatio;
    const warningThreshold = dailyStudyMinutes * this.config.maxMinutesPerDayWarningRatio;

    for (const [date, dayQuests] of Object.entries(questsByDate)) {
      const totalMinutes = dayQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);

      if (totalMinutes >= errorThreshold) {
        const hours = Math.round(totalMinutes / 60 * 10) / 10;
        const dailyHours = Math.round(dailyStudyMinutes / 60 * 10) / 10;
        issues.push({
          severity: ValidationSeverity.INVALID,
          code: 'EXCESSIVE_DAILY_TIME',
          message: `${date}에 ${hours}시간 학습이 배정되었습니다. 설정한 순공시간(${dailyHours}시간)의 2배를 초과합니다.`,
          details: { date, expected: dailyStudyMinutes, actual: totalMinutes },
        });
      } else if (totalMinutes >= warningThreshold) {
        const hours = Math.round(totalMinutes / 60 * 10) / 10;
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'HIGH_DAILY_TIME',
          message: `${date}에 ${hours}시간 학습이 배정되었습니다. 설정한 순공시간보다 많습니다.`,
          details: { date, expected: dailyStudyMinutes, actual: totalMinutes },
        });
      }
    }
  }

  /**
   * 마지막 날 과부하 검증
   */
  private validateLastDayOverload(
    lecturesByDate: Record<string, Quest[]>,
    avgLecturesPerDay: number,
    issues: ValidationIssue[]
  ): void {
    const dates = Object.keys(lecturesByDate).sort();
    if (dates.length === 0) return;

    const lastDate = dates[dates.length - 1];
    const lastDayCount = lecturesByDate[lastDate].length;

    if (lastDayCount >= avgLecturesPerDay * this.config.overloadRatioError) {
      issues.push({
        severity: ValidationSeverity.INVALID,
        code: 'LAST_DAY_OVERLOAD',
        message: `마지막 날(${lastDate})에 ${lastDayCount}개 강의가 몰려있습니다. 평균(${Math.round(avgLecturesPerDay)}개)의 4배 이상입니다.`,
        details: { date: lastDate, count: lastDayCount, expected: Math.round(avgLecturesPerDay) },
      });
    } else if (lastDayCount >= avgLecturesPerDay * this.config.overloadRatioWarning) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: 'LAST_DAY_HIGH',
        message: `마지막 날(${lastDate})에 ${lastDayCount}개 강의가 배정되었습니다. 평균보다 많습니다.`,
        details: { date: lastDate, count: lastDayCount, expected: Math.round(avgLecturesPerDay) },
      });
    }
  }

  /**
   * 특정 날 집중도 검증 (전체 대비)
   */
  private validateConcentration(
    lecturesByDate: Record<string, Quest[]>,
    totalLectures: number,
    issues: ValidationIssue[]
  ): void {
    for (const [date, lectures] of Object.entries(lecturesByDate)) {
      const ratio = lectures.length / totalLectures;

      if (ratio >= this.config.concentrationError) {
        const percent = Math.round(ratio * 100);
        issues.push({
          severity: ValidationSeverity.INVALID,
          code: 'EXCESSIVE_CONCENTRATION',
          message: `${date}에 전체 강의의 ${percent}%가 집중되어 있습니다. 분산이 필요합니다.`,
          details: { date, count: lectures.length, actual: percent },
        });
      } else if (ratio >= this.config.concentrationWarning) {
        const percent = Math.round(ratio * 100);
        issues.push({
          severity: ValidationSeverity.WARNING,
          code: 'HIGH_CONCENTRATION',
          message: `${date}에 전체 강의의 ${percent}%가 집중되어 있습니다.`,
          details: { date, count: lectures.length, actual: percent },
        });
      }
    }
  }

  /**
   * 연속 학습일 체크 (휴식 없이 너무 긴 연속 학습)
   */
  private validateConsecutiveDays(
    questsByDate: Record<string, Quest[]>,
    issues: ValidationIssue[]
  ): void {
    const dates = Object.keys(questsByDate).sort();
    if (dates.length < 14) return; // 2주 미만은 체크 안함

    // 연속 학습일 계산
    let consecutive = 1;
    let maxConsecutive = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 1;
      }
    }

    if (maxConsecutive >= 21) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        code: 'NO_REST_DAYS',
        message: `${maxConsecutive}일 연속 학습 일정입니다. 중간에 휴식일을 고려해보세요.`,
        details: { count: maxConsecutive },
      });
    }
  }

  /**
   * 일별 그룹화
   */
  private groupByDate(quests: Quest[]): Record<string, Quest[]> {
    const grouped: Record<string, Quest[]> = {};
    for (const quest of quests) {
      if (!grouped[quest.scheduledDate]) {
        grouped[quest.scheduledDate] = [];
      }
      grouped[quest.scheduledDate].push(quest);
    }
    return grouped;
  }

  /**
   * 검증 결과 생성
   */
  private createResult(
    issues: ValidationIssue[],
    suggestions: string[],
    totalLectures: number,
    totalMinutes: number,
    currentDays: number
  ): ValidationResult {
    const errors = issues.filter(i => i.severity === ValidationSeverity.INVALID).length;
    const warnings = issues.filter(i => i.severity === ValidationSeverity.WARNING).length;

    // 중복 제거
    const uniqueSuggestions = Array.from(new Set(suggestions));

    // 최종 severity 결정
    let severity: ValidationSeverity;
    if (errors > 0) {
      severity = ValidationSeverity.INVALID;
    } else if (warnings > 0) {
      severity = ValidationSeverity.WARNING;
    } else {
      severity = ValidationSeverity.VALID;
    }

    return {
      isValid: errors === 0,
      severity,
      issues,
      summary: {
        totalIssues: issues.length,
        warnings,
        errors,
      },
      suggestions: uniqueSuggestions,
    };
  }

  /**
   * 사전 검증 (생성 전 가능 여부 체크)
   */
  static preValidate(params: {
    totalLectures: number;
    totalDays: number;
    dailyStudyMinutes: number;
    avgLectureMinutes?: number;
  }): { canGenerate: boolean; message: string; suggestions: string[] } {
    const { totalLectures, totalDays, dailyStudyMinutes, avgLectureMinutes = 45 } = params;

    const suggestions: string[] = [];

    // 최소 일수 체크
    if (totalDays <= 0) {
      return {
        canGenerate: false,
        message: '목표일은 오늘 이후여야 합니다.',
        suggestions: ['목표일을 미래 날짜로 설정해주세요.'],
      };
    }

    // 일일 최대 강의 수 계산
    const maxDailyLectures = 15;
    const minRequiredDays = Math.ceil(totalLectures / maxDailyLectures);

    if (totalDays < minRequiredDays) {
      return {
        canGenerate: false,
        message: `${totalLectures}개 강의를 ${totalDays}일 안에 완료하려면 하루에 ${Math.ceil(totalLectures / totalDays)}개 이상 들어야 합니다. 현실적으로 불가능합니다.`,
        suggestions: [
          `목표일을 최소 ${minRequiredDays}일 이상으로 설정해주세요.`,
          `또는 강좌 수를 ${totalDays * maxDailyLectures}개 이하로 줄여주세요.`,
        ],
      };
    }

    // 총 학습 시간 vs 가용 시간 체크
    const totalLectureMinutes = totalLectures * avgLectureMinutes;
    const totalAvailableMinutes = totalDays * dailyStudyMinutes * 0.6; // 인강은 60% 제한

    if (totalLectureMinutes > totalAvailableMinutes * 2) {
      const neededDays = Math.ceil(totalLectureMinutes / (dailyStudyMinutes * 0.6));
      return {
        canGenerate: false,
        message: `선택한 강좌(약 ${Math.round(totalLectureMinutes / 60)}시간)를 ${totalDays}일 안에 완료하기 어렵습니다.`,
        suggestions: [
          `목표일을 ${neededDays}일 이상으로 설정해주세요.`,
          `또는 일일 순공시간을 늘려주세요.`,
        ],
      };
    }

    // 경고 수준 체크
    if (totalLectureMinutes > totalAvailableMinutes) {
      suggestions.push('일정이 빡빡합니다. 여유를 두고 목표일을 조금 늘리는 것을 권장합니다.');
    }

    return {
      canGenerate: true,
      message: suggestions.length > 0 ? '생성 가능하지만 일정이 빡빡합니다.' : '생성 가능합니다.',
      suggestions,
    };
  }
}
