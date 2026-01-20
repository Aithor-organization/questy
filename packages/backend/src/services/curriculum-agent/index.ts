// Curriculum Agent - TypeScript Implementation
// Python curriculum-agent의 TypeScript 완전 변환

export * from './types.js';
export { QuestManager } from './quest-manager.js';
export { ScheduleOptimizer } from './schedule-optimizer.js';
export { CurriculumValidator } from './curriculum-validator.js';

import {
  Quest,
  GenerateQuestsParams,
  RescheduleStrategy,
  RescheduleResult,
  ExistingPlan,
  CourseContent,
  ValidationResult,
  ValidationSeverity,
} from './types.js';
import { QuestManager } from './quest-manager.js';
import { ScheduleOptimizer } from './schedule-optimizer.js';
import { CurriculumValidator } from './curriculum-validator.js';

/**
 * 커리큘럼 에이전트 서비스
 * Python 에이전트의 CLI 인터페이스를 TypeScript 함수로 제공
 */
export class CurriculumAgentService {
  private questManager: QuestManager;
  private scheduleOptimizer: ScheduleOptimizer;
  private validator: CurriculumValidator;

  constructor() {
    this.questManager = new QuestManager();
    this.scheduleOptimizer = new ScheduleOptimizer(this.questManager);
    this.validator = new CurriculumValidator();
  }

  /**
   * 퀘스트 생성
   * Python: cli_generate_quests()
   */
  generateQuests(params: {
    courseIds?: string[];
    courseContents?: CourseContent[];
    targetDate: string;
    dailyStudyHours?: number;
    subjectRatio?: Record<string, number>;
    subjectHours?: Record<string, number | null>;
    subjectDays?: Record<string, number[]>;
    options?: {
      includeOt?: boolean;
      reviewSettings?: {
        enabled?: boolean;
        sameDayReview?: boolean;
        reviewDuration?: number;
      };
      customSchedule?: Array<{
        subject: string;
        type: 'daily' | 'alternate' | 'weekly';
        hoursPerSession: number;
      }>;
    };
    learningStrategies?: {
      applyBuffer?: boolean;
      fiveDayCycle?: boolean;
    };
    existingPlans?: ExistingPlan[];
  }): {
    success: boolean;
    quests: Quest[];
    summary: Record<string, any>;
    validation?: ValidationResult;
    error?: string;
  } {
    try {
      const {
        courseContents = [],
        targetDate,
        dailyStudyHours = 10,
        subjectRatio = { '국어': 20, '영어': 25, '수학': 35, '한국사': 5, '탐구1': 7.5, '탐구2': 7.5 },
        subjectHours,
        subjectDays,
        options = {},
        learningStrategies = { applyBuffer: true, fiveDayCycle: false },
        existingPlans = [],
      } = params;

      // 기존 플랜의 일별 시간 사용량 계산
      const dailyExistingUsage: Record<string, number> = {};
      for (const plan of existingPlans) {
        for (const quest of plan.quests || []) {
          const date = quest.scheduledDate;
          const minutes = quest.estimatedMinutes || 0;
          if (date && minutes > 0) {
            dailyExistingUsage[date] = (dailyExistingUsage[date] || 0) + minutes;
          }
        }
      }

      const quests = this.questManager.generateQuestsFromCurriculum({
        courseContents,
        targetDate,
        dailyStudyHours,
        subjectRatio,
        subjectHours,
        subjectDays,
        includeOt: options.includeOt ?? false,
        reviewSettings: {
          enabled: options.reviewSettings?.enabled ?? true,
          sameDayReview: options.reviewSettings?.sameDayReview ?? true,
          reviewDuration: options.reviewSettings?.reviewDuration ?? 15,
        },
        customSchedule: options.customSchedule,
        learningStrategies: {
          applyBuffer: learningStrategies.applyBuffer ?? true,
          fiveDayCycle: learningStrategies.fiveDayCycle ?? false,
        },
        dailyExistingUsage,
      });

      const stats = this.questManager.getCompletionStats();
      const scheduleExport = this.questManager.exportSchedule();

      // 생성된 커리큘럼 검증
      const dailyStudyMinutes = dailyStudyHours * 60;
      const validation = this.validator.validate(quests, dailyStudyMinutes);

      console.log('[CurriculumAgent] Validation result:', {
        isValid: validation.isValid,
        severity: validation.severity,
        errors: validation.summary.errors,
        warnings: validation.summary.warnings,
      });

      // 검증 실패 시 (INVALID) 에러 반환
      if (validation.severity === ValidationSeverity.INVALID) {
        const errorMessages = validation.issues
          .filter(i => i.severity === ValidationSeverity.INVALID)
          .map(i => i.message)
          .join(' ');

        return {
          success: false,
          quests: [],
          summary: {},
          validation,
          error: `커리큘럼 생성 불가: ${errorMessages}`,
        };
      }

      return {
        success: true,
        quests,
        summary: {
          totalQuests: quests.length,
          stats,
          schedules: scheduleExport.schedules,
        },
        validation,
      };
    } catch (error: any) {
      console.error('[CurriculumAgent] generateQuests error:', error);
      return {
        success: false,
        quests: [],
        summary: {},
        error: error.message || '퀘스트 생성 중 오류가 발생했습니다',
      };
    }
  }

  /**
   * 스케줄 재조정
   * Python: cli_reschedule_quests()
   */
  rescheduleQuests(params: {
    questIds?: string[];
    targetDate: string;
    dailyStudyHours?: number;
    strategy?: string;
    existingPlans?: ExistingPlan[];
  }): { success: boolean; message: string; rescheduledCount: number; rescheduledQuests: Quest[]; newSchedule: Record<string, any>; error?: string } {
    try {
      const {
        targetDate,
        dailyStudyHours = 10,
        strategy = 'smart',
        existingPlans = [],
      } = params;

      // 전략 매핑
      let rescheduleStrategy: RescheduleStrategy;
      switch (strategy.toLowerCase()) {
        case 'spread':
          rescheduleStrategy = RescheduleStrategy.SPREAD;
          break;
        case 'front_load':
        case 'frontload':
          rescheduleStrategy = RescheduleStrategy.FRONT_LOAD;
          break;
        case 'back_load':
        case 'backload':
          rescheduleStrategy = RescheduleStrategy.BACK_LOAD;
          break;
        case 'priority':
        case 'priority_first':
          rescheduleStrategy = RescheduleStrategy.PRIORITY_FIRST;
          break;
        case 'smart':
        default:
          rescheduleStrategy = RescheduleStrategy.SMART;
      }

      const result = this.scheduleOptimizer.rescheduleOverdue(
        targetDate,
        dailyStudyHours,
        rescheduleStrategy,
        existingPlans
      );

      return {
        success: result.success,
        message: result.success
          ? `${result.rescheduledQuests.length}개 퀘스트가 재조정되었습니다.`
          : `재조정 실패: ${result.warnings.join(', ')}`,
        rescheduledCount: result.rescheduledQuests.length,
        rescheduledQuests: result.rescheduledQuests,
        newSchedule: result.newSchedules,
      };
    } catch (error: any) {
      console.error('[CurriculumAgent] rescheduleQuests error:', error);
      return {
        success: false,
        message: error.message || '스케줄 재조정 중 오류가 발생했습니다',
        rescheduledCount: 0,
        rescheduledQuests: [],
        newSchedule: {},
        error: error.message,
      };
    }
  }

  /**
   * 따라잡기 계획 제안
   */
  suggestCatchUpPlan(targetDate: string, extraHoursPerDay = 2): Record<string, any> {
    return this.scheduleOptimizer.suggestCatchUpPlan(targetDate, extraHoursPerDay);
  }

  /**
   * 일별 부하 균형 최적화
   */
  optimizeDailyBalance(dailyStudyHours = 6): { adjustments: any[]; totalMoved: number } {
    return this.scheduleOptimizer.optimizeDailyBalance(dailyStudyHours);
  }

  /**
   * QuestManager 직접 접근
   */
  getQuestManager(): QuestManager {
    return this.questManager;
  }
}

// 싱글톤 인스턴스 (편의용)
let _instance: CurriculumAgentService | null = null;

export function getCurriculumAgentService(): CurriculumAgentService {
  if (!_instance) {
    _instance = new CurriculumAgentService();
  }
  return _instance;
}

export function createCurriculumAgentService(): CurriculumAgentService {
  return new CurriculumAgentService();
}
