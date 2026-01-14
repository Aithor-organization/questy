/**
 * AdmissionAgent
 * 입학 상담 전문 에이전트
 * - 신규 학생 온보딩
 * - 학습 목표 설정
 * - 초기 진단
 */

import { BaseAgent } from '../base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  AgentAction,
  MessageAction,
} from '../../../types/agent.js';
import type { Subject } from '../../../types/memory.js';
import { QuestActions } from '../../shared/quest-actions.js';

// 모듈 import
import { ADMISSION_SYSTEM_PROMPT, buildStagePrompt } from './prompts.js';
import type { OnboardingStage, ClassOption, ClassAssignment, OrientationProgress } from './types.js';
import {
  mapFrontendStageToOnboardingStage,
  determineOnboardingStage,
  getStageFollowUps,
} from './utils/stage-utils.js';
import {
  generateWelcome,
  collectBasicInfo,
  collectGoals,
  collectLearningStyle,
  createProfile,
  generateCompletionMessage,
  handleGeneralInquiry,
} from './handlers/template-handler.js';
import {
  getClassOptions,
  assignClass,
  generateClassAssignmentMessage,
} from './features/class-assignment.js';
import {
  startOrientation,
  completeOrientationStep,
  generateOrientationStepMessage,
  generateOrientationCompleteMessage,
} from './features/orientation.js';

export class AdmissionAgent extends BaseAgent {
  constructor() {
    super({
      role: 'ADMISSION',
      modelConfig: {
        id: 'claude-4.5-haiku',
        provider: 'anthropic',
        maxTokens: 1024,
        temperature: 0.7,
        purpose: '신규 학생 상담 및 온보딩',
      },
      systemPrompt: ADMISSION_SYSTEM_PROMPT,
    });
  }

  async process(
    request: AgentRequest,
    context?: DirectorContext
  ): Promise<AgentResponse> {
    const { message, studentId, metadata } = request;
    const studentProfile = context?.studentProfile;
    const messageActions: MessageAction[] = [];

    // 일정 조정/조회 요청 감지
    if (context && QuestActions.isScheduleRequest(message)) {
      console.log('[AdmissionAgent] Schedule request detected');
      const result = QuestActions.generateRescheduleActions(
        message,
        context.todayQuests,
        context.activePlans?.[0],
      );
      messageActions.push(...result.messageActions);

      return this.createResponse(
        `물론이죠! 일정 조정을 도와드릴게요. 😊\n\n${result.message}`,
        {
          suggestedFollowUp: ['다른 도움이 필요하세요?', '온보딩을 계속할까요?'],
          messageActions,
        }
      );
    }

    // 일정 조회 요청 처리
    if (context && QuestActions.isScheduleQuery(message)) {
      console.log('[AdmissionAgent] Schedule query detected');
      const summary = QuestActions.generateScheduleSummary(
        context.activePlans ?? [],
        context.fullScheduleContext
      );

      return this.createResponse(
        `학습 일정을 확인해볼게요! 📅\n\n${summary}`,
        {
          suggestedFollowUp: ['온보딩을 계속할까요?', '다른 질문이 있으세요?'],
        }
      );
    }

    // 플랜 생성 요청 감지
    if (QuestActions.isPlanCreationRequest(message)) {
      console.log('[AdmissionAgent] Plan creation request detected');
      messageActions.push({
        id: `navigate-new-plan-${Date.now()}`,
        type: 'NAVIGATE',
        label: '새 플랜 만들기',
        icon: '➕',
        data: { navigateTo: '/new-plan' },
      });

      return this.createResponse(
        '좋아요! 새로운 학습 계획을 세워볼까요? 🎯\n\n아래 버튼을 눌러 플랜을 만들어보세요.',
        {
          suggestedFollowUp: ['어떤 과목을 공부하고 싶으세요?'],
          messageActions,
        }
      );
    }

    // 온보딩 단계 결정
    const providedStage = metadata?.stage as string | undefined;
    const stage = mapFrontendStageToOnboardingStage(providedStage)
      ?? determineOnboardingStage(studentProfile, message);

    const extractedName = metadata?.extractedInfo?.name as string | undefined;
    const currentInfo = metadata?.currentInfo as {
      name?: string;
      grade?: string;
      subjects?: string[];
      goals?: string[];
    } | undefined;

    let response: string;
    const actions: AgentAction[] = [];

    // LLM을 사용한 동적 응답 생성
    try {
      const stagePrompt = buildStagePrompt(stage, studentProfile, {
        extractedName,
        currentInfo,
      });
      response = await this.generateResponse(stagePrompt, message);

      // COMPLETE 단계에서 프로필 생성 및 액션 추가
      if (stage === 'COMPLETE') {
        const profile = createProfile(studentId, message, studentProfile);
        actions.push({
          type: 'CREATE_PLAN',
          payload: { profile },
        });
      }
    } catch (error) {
      // LLM 실패 시 템플릿 폴백
      console.warn(`[ADMISSION] LLM failed, using template fallback:`, error);
      response = this.handleStageWithTemplate(stage, studentId, message, studentProfile, extractedName, actions);
    }

    return this.createResponse(response, {
      actions,
      suggestedFollowUp: getStageFollowUps(stage),
    });
  }

  /**
   * 템플릿 기반 단계 처리
   */
  private handleStageWithTemplate(
    stage: OnboardingStage,
    studentId: string,
    message: string,
    studentProfile: DirectorContext['studentProfile'] | undefined,
    extractedName: string | undefined,
    actions: AgentAction[]
  ): string {
    switch (stage) {
      case 'WELCOME':
        return generateWelcome();
      case 'COLLECT_BASIC':
        return collectBasicInfo(message, extractedName);
      case 'COLLECT_GOALS':
        return collectGoals(message);
      case 'COLLECT_STYLE':
        return collectLearningStyle(message);
      case 'COMPLETE': {
        const profile = createProfile(studentId, message, studentProfile);
        actions.push({
          type: 'CREATE_PLAN',
          payload: { profile },
        });
        return generateCompletionMessage(profile);
      }
      default:
        return handleGeneralInquiry(message);
    }
  }

  // ==================== FR-052: 반 배정 메서드 ====================

  getClassOptions(subject: Subject): ClassOption[] {
    return getClassOptions(subject);
  }

  assignClass(studentId: string, classId: string): ClassAssignment {
    return assignClass(studentId, classId);
  }

  async generateClassAssignmentMessage(
    assignment: ClassAssignment,
    classOptions: ClassOption[]
  ): Promise<string> {
    return generateClassAssignmentMessage(
      assignment,
      classOptions,
      this.generateResponse.bind(this)
    );
  }

  // ==================== FR-053: 오리엔테이션 메서드 ====================

  startOrientation(studentId: string): OrientationProgress {
    return startOrientation(studentId);
  }

  completeOrientationStep(
    progress: OrientationProgress,
    stepId: string
  ): OrientationProgress {
    return completeOrientationStep(progress, stepId);
  }

  async generateOrientationStepMessage(
    progress: OrientationProgress,
    stepIndex?: number
  ): Promise<string> {
    return generateOrientationStepMessage(
      progress,
      stepIndex,
      this.generateResponse.bind(this)
    );
  }

  async generateOrientationCompleteMessage(studentName: string): Promise<string> {
    return generateOrientationCompleteMessage(
      studentName,
      this.generateResponse.bind(this)
    );
  }
}
