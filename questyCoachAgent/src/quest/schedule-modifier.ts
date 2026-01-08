/**
 * ScheduleModifier
 * 사용자 요청에 따른 일정 재조정 옵션 생성
 * 
 * 사용 시나리오:
 * - "내일부터 3일간 바빠서 공부 못해"
 * - "일정 좀 뒤로 미뤄줘"
 * - "여행 다녀와서 스케줄 조정해줘"
 */

import type { DailyQuest, TodayQuests } from '../types/quest.js';
import type { StudyPlan } from '../types/agent.js';

// 일정 재조정 요청
export interface ScheduleChangeRequest {
    studentId: string;
    skipDays?: Date[];              // 건너뛸 날짜들
    skipFromDate?: Date;            // 시작일
    skipUntilDate?: Date;           // 종료일 (포함)
    keepTotalDays?: boolean;        // 목표일 유지 여부
    reason?: string;                // 변경 사유
}

// 재조정 옵션
export interface RescheduleOption {
    id: string;
    planName: string;
    description: string;
    impactSummary: string;
    strategy: 'COMPRESS' | 'EXTEND' | 'SKIP' | 'REDUCE_LOAD';

    // 변경 내용
    originalEndDate: Date;
    newEndDate: Date;
    daysChanged: number;

    // 영향받는 퀘스트
    affectedQuestCount: number;
    dailyLoadChange: string;        // e.g., "1.5배 증가", "동일", "30% 감소"

    // 적용 가능 여부
    isRecommended: boolean;
    feasibility: 'HIGH' | 'MEDIUM' | 'LOW';
    warningMessage?: string;
}

// 재조정 결과
export interface ScheduleModificationResult {
    success: boolean;
    studentId: string;
    appliedOption: RescheduleOption;
    modifiedQuests: DailyQuest[];
    message: string;
}

export class ScheduleModifier {
    /**
     * 재조정 옵션 생성
     */
    generateRescheduleOptions(
        request: ScheduleChangeRequest,
        activePlans: StudyPlan[],
        todayQuests: TodayQuests | null
    ): RescheduleOption[] {
        const options: RescheduleOption[] = [];
        const skipDays = this.calculateSkipDays(request);

        if (skipDays === 0) {
            return options;
        }

        // 현재 플랜 정보 추출
        const mainPlan = activePlans[0];
        if (!mainPlan) {
            return options;
        }

        const remainingDays = this.calculateRemainingDays(mainPlan);
        const originalEndDate = mainPlan.targetEndDate;

        // 옵션 1: 일정 압축 (목표일 유지)
        if (remainingDays > skipDays) {
            const compressionRatio = remainingDays / (remainingDays - skipDays);
            options.push({
                id: `option-compress-${Date.now()}`,
                planName: '📚 일정 압축',
                description: `${skipDays}일 건너뛰고 남은 일정을 압축합니다`,
                impactSummary: `목표일 ${this.formatDate(originalEndDate)} 유지`,
                strategy: 'COMPRESS',
                originalEndDate,
                newEndDate: originalEndDate,
                daysChanged: 0,
                affectedQuestCount: remainingDays - skipDays,
                dailyLoadChange: compressionRatio > 1.5
                    ? `${(compressionRatio).toFixed(1)}배 증가 ⚠️`
                    : `${(compressionRatio).toFixed(1)}배 증가`,
                isRecommended: compressionRatio <= 1.3,
                feasibility: compressionRatio <= 1.3 ? 'HIGH' : compressionRatio <= 1.5 ? 'MEDIUM' : 'LOW',
                warningMessage: compressionRatio > 1.5 ? '하루 학습량이 많아질 수 있어요' : undefined,
            });
        }

        // 옵션 2: 목표일 연장
        const newEndDate = new Date(originalEndDate);
        newEndDate.setDate(newEndDate.getDate() + skipDays);
        options.push({
            id: `option-extend-${Date.now()}`,
            planName: '📅 목표일 연장',
            description: `목표일을 ${skipDays}일 뒤로 미룹니다`,
            impactSummary: `새 목표일: ${this.formatDate(newEndDate)}`,
            strategy: 'EXTEND',
            originalEndDate,
            newEndDate,
            daysChanged: skipDays,
            affectedQuestCount: skipDays,
            dailyLoadChange: '동일',
            isRecommended: true,
            feasibility: 'HIGH',
        });

        // 옵션 3: 해당 기간 건너뛰기 (분량 축소)
        if (skipDays <= 5) {
            const skipPercentage = Math.round((skipDays / remainingDays) * 100);
            options.push({
                id: `option-skip-${Date.now()}`,
                planName: '⏭️ 일부 건너뛰기',
                description: `${skipDays}일치 분량을 건너뛰고 진행합니다`,
                impactSummary: `전체 진도의 약 ${skipPercentage}% 스킵`,
                strategy: 'SKIP',
                originalEndDate,
                newEndDate: originalEndDate,
                daysChanged: 0,
                affectedQuestCount: skipDays,
                dailyLoadChange: '동일',
                isRecommended: skipDays <= 2,
                feasibility: skipDays <= 3 ? 'HIGH' : 'MEDIUM',
                warningMessage: skipDays > 2 ? '일부 학습 내용을 건너뛰게 됩니다' : undefined,
            });
        }

        // 옵션 4: 분량 감소 (장기 휴식용)
        if (skipDays >= 3) {
            const reducedNewEnd = new Date(originalEndDate);
            reducedNewEnd.setDate(reducedNewEnd.getDate() + Math.ceil(skipDays / 2));
            options.push({
                id: `option-reduce-${Date.now()}`,
                planName: '📉 분량 조정',
                description: `하루 학습량을 줄이고 목표일을 조금 연장합니다`,
                impactSummary: `새 목표일: ${this.formatDate(reducedNewEnd)}, 하루 분량 80%`,
                strategy: 'REDUCE_LOAD',
                originalEndDate,
                newEndDate: reducedNewEnd,
                daysChanged: Math.ceil(skipDays / 2),
                affectedQuestCount: remainingDays,
                dailyLoadChange: '20% 감소',
                isRecommended: skipDays >= 5,
                feasibility: 'HIGH',
            });
        }

        // 추천 순으로 정렬
        return options.sort((a, b) => {
            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            const feasibilityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return feasibilityOrder[a.feasibility] - feasibilityOrder[b.feasibility];
        });
    }

    /**
     * 재조정 옵션 적용
     */
    applyReschedule(
        optionId: string,
        options: RescheduleOption[],
        existingQuests: DailyQuest[]
    ): ScheduleModificationResult {
        const option = options.find(o => o.id === optionId);
        if (!option) {
            return {
                success: false,
                studentId: '',
                appliedOption: options[0],
                modifiedQuests: [],
                message: '선택한 옵션을 찾을 수 없습니다',
            };
        }

        // 전략에 따라 퀘스트 수정
        const modifiedQuests = this.modifyQuestsByStrategy(option, existingQuests);

        return {
            success: true,
            studentId: existingQuests[0]?.studentId || '',
            appliedOption: option,
            modifiedQuests,
            message: this.generateSuccessMessage(option),
        };
    }

    // ==================== Private Methods ====================

    private calculateSkipDays(request: ScheduleChangeRequest): number {
        if (request.skipDays && request.skipDays.length > 0) {
            return request.skipDays.length;
        }

        if (request.skipFromDate && request.skipUntilDate) {
            const diff = request.skipUntilDate.getTime() - request.skipFromDate.getTime();
            return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
        }

        return 0;
    }

    private calculateRemainingDays(plan: StudyPlan): number {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(plan.targetEndDate);
        endDate.setHours(0, 0, 0, 0);
        const diff = endDate.getTime() - today.getTime();
        return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    private formatDate(date: Date): string {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }

    private modifyQuestsByStrategy(
        option: RescheduleOption,
        quests: DailyQuest[]
    ): DailyQuest[] {
        // 실제 구현: 전략에 따라 퀘스트 날짜/분량 조정
        // 여기서는 간소화된 버전
        return quests.map(quest => ({
            ...quest,
            // TODO: 실제 날짜/분량 조정 로직
        }));
    }

    private generateSuccessMessage(option: RescheduleOption): string {
        const messages: Record<RescheduleOption['strategy'], string> = {
            COMPRESS: `일정을 압축했어요! ${option.dailyLoadChange}로 진행됩니다 💪`,
            EXTEND: `목표일을 ${this.formatDate(option.newEndDate)}로 연장했어요 📅`,
            SKIP: `해당 기간은 건너뛰고 진행할게요 ⏭️`,
            REDUCE_LOAD: `하루 분량을 줄이고 목표일을 조정했어요 📉`,
        };
        return messages[option.strategy];
    }
}
