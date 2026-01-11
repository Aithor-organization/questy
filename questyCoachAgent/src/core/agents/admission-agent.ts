/**
 * AdmissionAgent
 * 입학 상담 전문 에이전트
 * - 신규 학생 온보딩
 * - 학습 목표 설정
 * - 초기 진단
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
  StudentProfile,
  LearningStyle,
  AgentAction,
  MessageAction,
} from '../../types/agent.js';
import type { Subject } from '../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';
import { QuestActions } from '../shared/quest-actions.js';

const ADMISSION_SYSTEM_PROMPT = `당신은 학습 상담 전문가 AI입니다.

## 핵심 역할
1. **환영 및 안내**: 따뜻한 첫인상으로 신뢰 형성
2. **니즈 파악**: 학습 목표와 현재 상태 이해
3. **맞춤 제안**: 학생에게 적합한 학습 경로 안내
4. **프로필 생성**: 초기 학습자 프로필 설정

## 상담 원칙
- 친근하고 편안한 분위기 조성
- 열린 질문으로 학생의 이야기 경청
- 압박 없이 자연스러운 대화
- 구체적인 목표 설정 도움

## 수집 정보
- 학년 및 학교 유형
- 목표 시험/대학
- 관심 과목 및 약한 과목
- 학습 스타일 선호
- 가용 학습 시간`;

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

    // 일정 조정/조회 요청 감지 - AdmissionAgent도 스케줄 관련 작업 가능
    if (context && QuestActions.isScheduleRequest(message)) {
      console.log('[AdmissionAgent] Schedule request detected - generating actions');
      const todayQuests = context.todayQuests;
      const activePlans = context.activePlans;
      const result = QuestActions.generateRescheduleActions(
        message,
        todayQuests,
        activePlans?.[0],
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

    // 프론트엔드에서 전달한 stage 우선 사용, 없으면 자동 결정
    const providedStage = metadata?.stage as string | undefined;
    const stage = this.mapFrontendStageToOnboardingStage(providedStage)
      ?? this.determineOnboardingStage(studentProfile, message);

    // 프론트엔드에서 추출한 정보가 있으면 사용
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
      const stagePrompt = this.buildStagePrompt(stage, studentProfile, message, {
        extractedName,
        currentInfo,
      });
      response = await this.generateResponse(stagePrompt, message);

      // COMPLETE 단계에서 프로필 생성 및 액션 추가
      if (stage === 'COMPLETE') {
        const profile = this.createProfile(studentId, message, studentProfile);
        actions.push({
          type: 'CREATE_PLAN',
          payload: { profile },
        });
      }
    } catch (error) {
      // LLM 실패 시 템플릿 폴백
      console.warn(`[ADMISSION] LLM failed, using template fallback:`, error);
      switch (stage) {
        case 'WELCOME':
          response = this.generateWelcome();
          break;
        case 'COLLECT_BASIC':
          response = this.collectBasicInfo(message, extractedName);
          break;
        case 'COLLECT_GOALS':
          response = this.collectGoals(message);
          break;
        case 'COLLECT_STYLE':
          response = this.collectLearningStyle(message);
          break;
        case 'COMPLETE':
          const profile = this.createProfile(studentId, message, studentProfile);
          response = this.generateCompletionMessage(profile);
          actions.push({
            type: 'CREATE_PLAN',
            payload: { profile },
          });
          break;
        default:
          response = this.handleGeneralInquiry(message);
      }
    }

    return this.createResponse(response, {
      actions,
      suggestedFollowUp: this.getStageFollowUps(stage),
    });
  }

  /**
   * 단계별 LLM 프롬프트 생성
   */
  private buildStagePrompt(
    stage: OnboardingStage,
    profile: StudentProfile | undefined,
    message: string,
    frontendData?: {
      extractedName?: string;
      currentInfo?: {
        name?: string;
        grade?: string;
        subjects?: string[];
        goals?: string[];
      };
    }
  ): string {
    const basePrompt = this.systemPrompt;

    // 프론트엔드에서 전달된 정보 우선 사용
    const studentName = frontendData?.extractedName || frontendData?.currentInfo?.name || profile?.name;
    const studentGrade = frontendData?.currentInfo?.grade || profile?.grade;
    const subjects = frontendData?.currentInfo?.subjects || profile?.enrolledSubjects;
    const goals = frontendData?.currentInfo?.goals || profile?.goals;

    // 현재 수집된 정보를 프롬프트에 포함
    let collectedInfo = '\n\n## 현재까지 수집된 정보';
    if (studentName) collectedInfo += `\n- 이름: ${studentName}`;
    if (studentGrade) collectedInfo += `\n- 학년: ${studentGrade}`;
    if (subjects && subjects.length > 0) collectedInfo += `\n- 과목: ${subjects.join(', ')}`;
    if (goals && goals.length > 0) collectedInfo += `\n- 목표: ${goals.join(', ')}`;

    const profileContext = (studentName || studentGrade || (subjects && subjects.length > 0))
      ? collectedInfo
      : '\n\n## 신규 학생 (정보 수집 중)';

    // 사용자가 방금 보낸 메시지에서 추출된 정보 강조
    const userInputContext = frontendData?.extractedName
      ? `\n\n## 🔔 중요: 사용자가 방금 "${frontendData.extractedName}"라는 이름을 알려줬습니다. 이 이름을 사용하여 친근하게 응답하세요.`
      : '';

    const stageInstructions: Record<OnboardingStage, string> = {
      'WELCOME': `
## 현재 단계: 환영
- 따뜻하게 환영 인사하기
- 퀘스티북 서비스 간단히 소개
- 학년과 관심 과목 질문으로 대화 시작
- 친근하고 편안한 톤 유지`,

      'COLLECT_BASIC': `
## 현재 단계: 기본 정보 수집
- 학생이 말한 학년/학교 정보 인정하고 반응
- 목표(수능/내신/시험)에 대해 질문
- 격려하는 톤으로 대화 이어가기`,

      'COLLECT_GOALS': `
## 현재 단계: 목표 수집
- 학생의 목표에 공감하고 응원
- 학습 스타일 선호도 질문 (빠른 진도 vs 천천히, 아침 vs 저녁)
- 구체적인 목표 설정 도움`,

      'COLLECT_STYLE': `
## 현재 단계: 학습 스타일 파악
- 학습 스타일 선호도 확인하고 반응
- 수집된 정보 요약
- 프로필 완성 준비 안내`,

      'COMPLETE': `
## 현재 단계: 온보딩 완료
- 환영 메시지와 함께 프로필 완성 축하
- 다음 단계 안내 (학습 계획 세우기, 진단 테스트 등)
- 동기부여 메시지 포함`,

      'GENERAL': `
## 현재 단계: 일반 문의
- 학생의 질문에 친절하게 답변
- 학습 관련 조언 제공
- 필요시 다른 기능 안내`,

      'LEVEL_TEST': `
## 현재 단계: 레벨 테스트
- 레벨 테스트 목적과 진행 방법 설명
- 테스트 준비 안내
- 긴장하지 말라고 격려`,

      'CLASS_ASSIGN': `
## 현재 단계: 반 배정
- 반 배정 과정 안내
- 각 반의 특징 설명
- 학생에게 맞는 반 추천`,

      'ORIENTATION': `
## 현재 단계: 오리엔테이션
- 퀘스티북 사용법 안내
- 주요 기능 소개
- 학습 시작 준비`,
    };

    return `${basePrompt}${profileContext}${userInputContext}
${stageInstructions[stage]}

## 응답 지침
- 이모지를 적절히 사용해 친근감 표현
- 마크다운 형식으로 구조화
- 2-4문단 정도로 간결하게
- 학생의 메시지에 직접 반응하기
- 학생이 이름이나 정보를 알려줬다면 반드시 그 정보를 인정하고 다음 질문으로 넘어가기`;
  }

  /**
   * 프론트엔드 stage를 OnboardingStage로 매핑
   */
  private mapFrontendStageToOnboardingStage(stage: string | undefined): OnboardingStage | null {
    if (!stage) return null;

    const mapping: Record<string, OnboardingStage> = {
      'name': 'COLLECT_BASIC',
      'grade': 'COLLECT_BASIC',
      'subjects': 'COLLECT_GOALS',
      'goals': 'COLLECT_GOALS',
      'levelTest': 'LEVEL_TEST',
      'classAssignment': 'CLASS_ASSIGN',
      'orientation': 'ORIENTATION',
      'complete': 'COMPLETE',
      'general': 'GENERAL',
      'welcome': 'WELCOME',
    };

    return mapping[stage] ?? null;
  }

  /**
   * 온보딩 단계 결정
   */
  private determineOnboardingStage(
    profile: StudentProfile | undefined,
    message: string
  ): OnboardingStage {
    // 기존 프로필이 완성되어 있으면 일반 문의
    if (profile && profile.enrolledSubjects.length > 0) {
      return 'GENERAL';
    }

    // 메시지 내용으로 단계 파악
    if (/시작|가입|처음|등록/.test(message)) return 'WELCOME';
    if (/학년|고등|중학|초등/.test(message)) return 'COLLECT_BASIC';
    if (/목표|수능|대학|시험/.test(message)) return 'COLLECT_GOALS';
    if (/스타일|방식|시간|선호/.test(message)) return 'COLLECT_STYLE';
    if (/완료|시작하자|준비됐/.test(message)) return 'COMPLETE';

    return 'WELCOME';
  }

  /**
   * 환영 메시지
   */
  private generateWelcome(): string {
    return `안녕하세요! 🎓 **퀘스티 학습 코치**에 오신 것을 환영해요!

저는 여러분의 학습을 도와줄 AI 코치예요.
함께하면 더 효율적이고 즐겁게 공부할 수 있을 거예요! 💪

먼저 몇 가지 알려주시면 맞춤 학습을 준비해드릴게요.

📋 **알려주세요**
1. 학년이 어떻게 되세요?
2. 어떤 과목을 공부하고 싶으세요?

편하게 말씀해 주세요! 😊`;
  }

  /**
   * 기본 정보 수집
   */
  private collectBasicInfo(message: string, extractedName?: string): string {
    const grade = this.extractGrade(message);

    let response = '';

    // 이름이 추출되었으면 인사 추가
    if (extractedName) {
      response += `${extractedName}님, 반가워요! 😊\n\n`;
    }

    if (grade) {
      response += `${grade}이시군요! 👍\n\n`;
    }

    response += `그럼 다음으로 알려주세요:\n\n`;
    response += `🎯 **목표가 뭐예요?**\n`;
    response += `- 수능 준비\n`;
    response += `- 내신 관리\n`;
    response += `- 특정 시험 대비\n`;
    response += `- 기초 다지기\n\n`;
    response += `목표를 알면 더 정확한 계획을 세울 수 있어요!`;

    return response;
  }

  /**
   * 목표 수집
   */
  private collectGoals(message: string): string {
    const goals = this.extractGoals(message);

    let response = '';
    if (goals.length > 0) {
      response += `좋은 목표예요! 🎯\n`;
      response += `**설정된 목표**: ${goals.join(', ')}\n\n`;
    }

    response += `마지막으로, 학습 스타일에 대해 알려주세요:\n\n`;
    response += `📚 **어떤 학습 방식이 좋으세요?**\n`;
    response += `- 빠르게 진도 나가기 vs 천천히 꼼꼼하게\n`;
    response += `- 혼자 문제 풀기 vs 설명 듣고 풀기\n`;
    response += `- 아침 학습 vs 저녁 학습\n\n`;
    response += `편하게 알려주세요! 여러분에게 맞춰드릴게요. 😊`;

    return response;
  }

  /**
   * 학습 스타일 수집
   */
  private collectLearningStyle(message: string): string {
    const style = this.extractLearningStyle(message);

    return `완벽해요! 정보를 다 수집했어요. ✅

📋 **수집된 정보 확인**
${style.preferredPace === 'FAST' ? '- 빠른 페이스 선호 🚀' : '- 천천히 꼼꼼하게 선호 📖'}
${style.needsRepetition ? '- 반복 학습 필요' : '- 한 번에 이해하는 편'}
${style.prefersChallenges ? '- 도전적인 문제 좋아함 💪' : '- 기초부터 차근차근'}

이제 학습을 시작할 준비가 됐어요!
"시작하자" 또는 "준비됐어"라고 말씀해 주세요! 🎓`;
  }

  /**
   * 프로필 생성
   */
  private createProfile(
    studentId: string,
    message: string,
    existingProfile?: StudentProfile
  ): StudentProfile {
    const now = new Date();

    return {
      id: studentId || uuidv4(),
      name: existingProfile?.name ?? '학생',
      grade: existingProfile?.grade ?? this.extractGrade(message) ?? '고2',
      targetExam: '수능',
      enrolledSubjects: this.extractSubjects(message),
      learningStyle: this.extractLearningStyle(message),
      preferredStudyTime: '저녁',
      goals: this.extractGoals(message),
      createdAt: existingProfile?.createdAt ?? now,
      lastActiveAt: now,
    };
  }

  /**
   * 완료 메시지
   */
  private generateCompletionMessage(profile: StudentProfile): string {
    return `🎉 **환영합니다, ${profile.name}님!**

프로필이 생성되었어요. 이제 함께 공부할 준비가 됐어요!

📋 **학습자 프로필**
- 학년: ${profile.grade}
- 목표: ${profile.targetExam ?? '성적 향상'}
- 과목: ${profile.enrolledSubjects.join(', ')}

🚀 **다음 단계**
1. 학습 계획을 세워볼까요? ("계획 세워줘")
2. 바로 공부를 시작할까요? ("공부 시작")
3. 진단 테스트를 받아볼까요? ("실력 진단")

언제든 도움이 필요하면 말씀해 주세요! 💪
함께라면 목표를 이룰 수 있어요!`;
  }

  /**
   * 일반 문의 처리
   */
  private handleGeneralInquiry(message: string): string {
    return `안녕하세요! 무엇을 도와드릴까요? 😊

📌 **자주 묻는 질문**
- "수업 등록하고 싶어요" - 새로운 과목 추가
- "프로필 수정해줘" - 정보 업데이트
- "어떻게 시작해?" - 이용 가이드

궁금한 게 있으면 편하게 물어봐 주세요!`;
  }

  /**
   * 학년 추출
   */
  private extractGrade(message: string): string | null {
    if (/고3|고등학교\s*3/.test(message)) return '고3';
    if (/고2|고등학교\s*2/.test(message)) return '고2';
    if (/고1|고등학교\s*1/.test(message)) return '고1';
    if (/중3|중학교\s*3/.test(message)) return '중3';
    if (/중2|중학교\s*2/.test(message)) return '중2';
    if (/중1|중학교\s*1/.test(message)) return '중1';
    if (/N수|재수|삼수/.test(message)) return 'N수생';
    return null;
  }

  /**
   * 목표 추출
   */
  private extractGoals(message: string): string[] {
    const goals: string[] = [];
    if (/수능/.test(message)) goals.push('수능 대비');
    if (/내신/.test(message)) goals.push('내신 관리');
    if (/대학/.test(message)) goals.push('대학 입시');
    if (/기초/.test(message)) goals.push('기초 다지기');
    if (/성적/.test(message)) goals.push('성적 향상');
    return goals.length > 0 ? goals : ['학습 능력 향상'];
  }

  /**
   * 과목 추출
   */
  private extractSubjects(message: string): Subject[] {
    const subjects: Subject[] = [];
    if (/국어|문학/.test(message)) subjects.push('KOREAN');
    if (/수학|미적/.test(message)) subjects.push('MATH');
    if (/영어/.test(message)) subjects.push('ENGLISH');
    if (/과학|물리|화학|생물/.test(message)) subjects.push('SCIENCE');
    if (/사회|역사/.test(message)) subjects.push('SOCIAL');
    return subjects.length > 0 ? subjects : ['GENERAL'];
  }

  /**
   * 학습 스타일 추출
   */
  private extractLearningStyle(message: string): LearningStyle {
    return {
      preferredPace: /빠르|빨리/.test(message) ? 'FAST' : /천천히|느리/.test(message) ? 'SLOW' : 'MEDIUM',
      visualLearner: /시각|영상|그림/.test(message),
      needsRepetition: /반복|여러\s*번/.test(message),
      prefersChallenges: /도전|어려운|심화/.test(message),
      attentionSpan: /집중.*짧|금방/.test(message) ? 'SHORT' : 'MEDIUM',
    };
  }

  /**
   * 단계별 후속 질문
   */
  private getStageFollowUps(stage: OnboardingStage): string[] {
    const followUps: Record<OnboardingStage, string[]> = {
      WELCOME: ['학년을 알려주세요', '어떤 과목이 필요해요?'],
      COLLECT_BASIC: ['목표가 뭐예요?', '수능 준비 중이에요?'],
      COLLECT_GOALS: ['학습 스타일은 어때요?', '하루에 얼마나 공부해요?'],
      COLLECT_STYLE: ['시작할 준비됐어요?', '더 알려줄 게 있어요?'],
      COMPLETE: ['바로 공부 시작할까요?', '계획부터 세울까요?'],
      GENERAL: ['무엇을 도와드릴까요?', '다른 질문 있으세요?'],
      LEVEL_TEST: ['레벨 테스트 시작할까요?', '어떤 과목으로 할까요?'],
      CLASS_ASSIGN: ['반 선택 도움이 필요해요?', '추천 반으로 할까요?'],
      ORIENTATION: ['다음 단계로 넘어갈까요?', '다시 설명해 드릴까요?'],
    };

    return followUps[stage] ?? [];
  }

  // ==================== FR-051: 레벨 테스트 메서드 ====================

  /**
   * 레벨 테스트 생성
   */
  generateLevelTest(subject: Subject, questionCount: number = 5): LevelTestQuestion[] {
    const questions: LevelTestQuestion[] = [];
    const difficulties: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];

    // 과목별 샘플 문제 (실제로는 DB에서 가져와야 함)
    const questionBank = this.getQuestionBank(subject);

    for (let i = 0; i < questionCount; i++) {
      const difficulty = difficulties[i % 3] ?? 'MEDIUM';
      const availableQuestions = questionBank.filter(q => q.difficulty === difficulty);
      const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

      if (randomQuestion) {
        questions.push({
          ...randomQuestion,
          id: `q-${Date.now()}-${i}`,
        });
      }
    }

    return questions;
  }

  /**
   * 레벨 테스트 채점
   */
  evaluateLevelTest(
    studentId: string,
    subject: Subject,
    questions: LevelTestQuestion[],
    answers: number[]
  ): LevelTestResult {
    let correctAnswers = 0;
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];
    const topicScores = new Map<string, { correct: number; total: number }>();

    questions.forEach((q, i) => {
      const isCorrect = answers[i] === q.correctAnswer;
      if (isCorrect) correctAnswers++;

      // 토픽별 점수 추적
      const topicScore = topicScores.get(q.topic) ?? { correct: 0, total: 0 };
      topicScore.total++;
      if (isCorrect) topicScore.correct++;
      topicScores.set(q.topic, topicScore);
    });

    // 토픽별 강점/약점 분류
    topicScores.forEach((score, topic) => {
      const rate = score.correct / score.total;
      if (rate >= 0.7) {
        strongTopics.push(topic);
      } else if (rate < 0.5) {
        weakTopics.push(topic);
      }
    });

    const score = Math.round((correctAnswers / questions.length) * 100);
    const level: LevelTestResult['level'] =
      score >= 80 ? 'ADVANCED' :
      score >= 50 ? 'INTERMEDIATE' : 'BEGINNER';

    return {
      studentId,
      subject,
      totalQuestions: questions.length,
      correctAnswers,
      score,
      level,
      weakTopics,
      strongTopics,
      recommendedClass: this.recommendClassFromLevel(level, subject),
      completedAt: new Date(),
    };
  }

  /**
   * 레벨 테스트 결과 메시지 생성 (LLM 사용)
   */
  async generateLevelTestResultMessage(result: LevelTestResult): Promise<string> {
    const levelEmoji = {
      BEGINNER: '🌱',
      INTERMEDIATE: '🌿',
      ADVANCED: '🌳',
    };

    const levelName = {
      BEGINNER: '기초',
      INTERMEDIATE: '중급',
      ADVANCED: '심화',
    };

    // LLM으로 개인화된 피드백 생성
    try {
      const prompt = `당신은 학습 상담 전문가 AI입니다.

## 레벨 테스트 결과
- 레벨: ${levelName[result.level]} (${result.level})
- 점수: ${result.score}점 (${result.correctAnswers}/${result.totalQuestions} 정답)
- 강점 영역: ${result.strongTopics.length > 0 ? result.strongTopics.join(', ') : '없음'}
- 보완 영역: ${result.weakTopics.length > 0 ? result.weakTopics.join(', ') : '없음'}
- 추천 반: ${result.recommendedClass}

## 응답 지침
1. 테스트 결과를 격려하며 전달
2. 강점을 칭찬하고 보완점에 대한 긍정적인 조언
3. 추천 반에 대한 설명과 동기부여
4. 마크다운 형식, 이모지 사용
5. 3-4문단으로 간결하게`;

      const response = await this.generateResponse(prompt, '레벨 테스트 결과를 알려주세요');
      return response;
    } catch (error) {
      console.warn('[ADMISSION] LLM failed for level test result, using template:', error);
      // 템플릿 폴백
      return `📋 **레벨 테스트 결과**

${levelEmoji[result.level]} **${levelName[result.level]} 레벨**이에요!

📊 **점수**: ${result.score}점 (${result.correctAnswers}/${result.totalQuestions} 정답)

${result.strongTopics.length > 0 ? `💪 **강점 영역**: ${result.strongTopics.join(', ')}\n` : ''}
${result.weakTopics.length > 0 ? `📚 **보완 영역**: ${result.weakTopics.join(', ')}\n` : ''}

🎯 **추천 반**: ${result.recommendedClass}

${result.level === 'BEGINNER'
  ? '기초부터 탄탄하게 다져볼까요? 차근차근 함께 해요! 💪'
  : result.level === 'INTERMEDIATE'
    ? '좋은 실력이에요! 조금만 더 노력하면 심화까지 갈 수 있어요! 🔥'
    : '와, 대단해요! 심화 과정으로 더 높이 도전해봐요! 🏆'}`;
    }
  }

  /**
   * 문제 은행 (샘플)
   */
  private getQuestionBank(subject: Subject): Omit<LevelTestQuestion, 'id'>[] {
    // 실제로는 DB에서 가져와야 함
    const banks: Record<Subject, Omit<LevelTestQuestion, 'id'>[]> = {
      MATH: [
        { subject: 'MATH', difficulty: 'EASY', question: '2 + 3 × 4 = ?', options: ['20', '14', '11', '24'], correctAnswer: 1, topic: '사칙연산' },
        { subject: 'MATH', difficulty: 'EASY', question: '1/2 + 1/3 = ?', options: ['2/5', '5/6', '1/6', '2/6'], correctAnswer: 1, topic: '분수' },
        { subject: 'MATH', difficulty: 'MEDIUM', question: 'x² - 5x + 6 = 0 의 해는?', options: ['1, 6', '2, 3', '-2, -3', '1, -6'], correctAnswer: 1, topic: '이차방정식' },
        { subject: 'MATH', difficulty: 'MEDIUM', question: 'sin²θ + cos²θ = ?', options: ['0', '1', '2', 'sinθ'], correctAnswer: 1, topic: '삼각함수' },
        { subject: 'MATH', difficulty: 'HARD', question: '∫x²dx = ?', options: ['x³', 'x³/3 + C', '2x', 'x³/3'], correctAnswer: 1, topic: '적분' },
      ],
      KOREAN: [
        { subject: 'KOREAN', difficulty: 'EASY', question: '"맞춤법"의 올바른 표기는?', options: ['맛춤법', '맞춤법', '맛츰법', '맞츰법'], correctAnswer: 1, topic: '맞춤법' },
        { subject: 'KOREAN', difficulty: 'MEDIUM', question: '"은유"의 예시는?', options: ['내 마음은 호수', '바람이 살랑살랑', '쿵쾅쿵쾅', '하늘이 파랗다'], correctAnswer: 0, topic: '비유법' },
        { subject: 'KOREAN', difficulty: 'HARD', question: '다음 중 문학 작품 분석 요소가 아닌 것은?', options: ['시점', '구성', '문법', '주제'], correctAnswer: 2, topic: '문학' },
      ],
      ENGLISH: [
        { subject: 'ENGLISH', difficulty: 'EASY', question: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'went'], correctAnswer: 1, topic: '동사' },
        { subject: 'ENGLISH', difficulty: 'MEDIUM', question: 'I wish I ___ fly.', options: ['can', 'could', 'will', 'would'], correctAnswer: 1, topic: '가정법' },
        { subject: 'ENGLISH', difficulty: 'HARD', question: 'The book ___ on the table is mine.', options: ['lies', 'lying', 'lay', 'lied'], correctAnswer: 1, topic: '분사' },
      ],
      SCIENCE: [
        { subject: 'SCIENCE', difficulty: 'EASY', question: '물의 화학식은?', options: ['H2O', 'CO2', 'O2', 'NaCl'], correctAnswer: 0, topic: '화학' },
        { subject: 'SCIENCE', difficulty: 'MEDIUM', question: 'F = ma 는 무슨 법칙?', options: ['관성의 법칙', '가속도의 법칙', '작용반작용', '만유인력'], correctAnswer: 1, topic: '물리' },
      ],
      SOCIAL: [
        { subject: 'SOCIAL', difficulty: 'EASY', question: '대한민국의 수도는?', options: ['부산', '서울', '대전', '인천'], correctAnswer: 1, topic: '지리' },
        { subject: 'SOCIAL', difficulty: 'MEDIUM', question: '3.1 운동이 일어난 해는?', options: ['1910년', '1919년', '1945년', '1950년'], correctAnswer: 1, topic: '역사' },
      ],
      GENERAL: [
        { subject: 'GENERAL', difficulty: 'EASY', question: '1년은 몇 개월?', options: ['10개월', '11개월', '12개월', '13개월'], correctAnswer: 2, topic: '일반상식' },
      ],
    };

    return banks[subject] ?? banks.GENERAL;
  }

  /**
   * 레벨에서 반 추천
   */
  private recommendClassFromLevel(level: LevelTestResult['level'], subject: Subject): string {
    const classMap = {
      BEGINNER: '기초반',
      INTERMEDIATE: '정규반',
      ADVANCED: '심화반',
    };
    return `${subject === 'GENERAL' ? '' : subject + ' '}${classMap[level]}`;
  }

  // ==================== FR-052: 반 배정 메서드 ====================

  /**
   * 반 옵션 조회
   */
  getClassOptions(subject: Subject): ClassOption[] {
    return [
      {
        id: 'basic',
        name: '기초반',
        description: '기초부터 차근차근! 개념 이해에 집중해요.',
        pace: 'SLOW',
        difficulty: 'BASIC',
        features: ['개념 설명 중심', '쉬운 예제', '반복 학습', '1:1 질문'],
        recommendedFor: '기초가 부족하거나 처음 시작하는 학생',
      },
      {
        id: 'regular',
        name: '정규반',
        description: '균형 잡힌 학습! 개념과 문제풀이를 함께해요.',
        pace: 'MEDIUM',
        difficulty: 'STANDARD',
        features: ['개념 + 문제풀이', '중간 난이도', '주간 테스트', '오답 분석'],
        recommendedFor: '기본기가 있고 꾸준히 실력을 키우고 싶은 학생',
      },
      {
        id: 'advanced',
        name: '심화반',
        description: '상위권 도전! 어려운 문제도 거뜬히!',
        pace: 'FAST',
        difficulty: 'ADVANCED',
        features: ['고난도 문제', '빠른 진도', '심화 개념', '실전 연습'],
        recommendedFor: '기본기가 탄탄하고 상위권을 목표로 하는 학생',
      },
    ];
  }

  /**
   * 반 배정 실행
   */
  assignClass(
    studentId: string,
    classId: string,
    levelTestResult?: LevelTestResult
  ): ClassAssignment {
    const classOptions = this.getClassOptions('GENERAL');
    const selectedClass = classOptions.find(c => c.id === classId);

    if (!selectedClass) {
      throw new Error('존재하지 않는 반입니다');
    }

    const reason = levelTestResult
      ? `레벨 테스트 결과(${levelTestResult.level})에 따른 자동 배정`
      : '학생 선택에 의한 배정';

    return {
      studentId,
      classId,
      className: selectedClass.name,
      assignedAt: new Date(),
      reason,
    };
  }

  /**
   * 반 배정 메시지 생성 (LLM 사용)
   */
  async generateClassAssignmentMessage(
    assignment: ClassAssignment,
    classOptions: ClassOption[]
  ): Promise<string> {
    const selectedClass = classOptions.find(c => c.id === assignment.classId);

    if (!selectedClass) {
      return '반 배정이 완료되었어요!';
    }

    // LLM으로 개인화된 반 배정 메시지 생성
    try {
      const prompt = `당신은 학습 상담 전문가 AI입니다.

## 반 배정 정보
- 배정된 반: ${selectedClass.name}
- 반 설명: ${selectedClass.description}
- 학습 페이스: ${selectedClass.pace === 'SLOW' ? '천천히' : selectedClass.pace === 'MEDIUM' ? '보통' : '빠르게'}
- 난이도: ${selectedClass.difficulty === 'BASIC' ? '기초' : selectedClass.difficulty === 'STANDARD' ? '정규' : '심화'}
- 특징: ${selectedClass.features.join(', ')}
- 추천 대상: ${selectedClass.recommendedFor}
- 배정 이유: ${assignment.reason}

## 응답 지침
1. 축하 메시지와 함께 배정된 반 안내
2. 반의 특징과 장점 설명
3. 학습 동기부여 메시지
4. 마크다운 형식, 이모지 사용
5. 3-4문단으로 간결하게`;

      const response = await this.generateResponse(prompt, '어떤 반에 배정됐나요?');
      return response;
    } catch (error) {
      console.warn('[ADMISSION] LLM failed for class assignment, using template:', error);
      // 템플릿 폴백
      return `🎓 **반 배정 완료!**

📚 **${selectedClass.name}**에 배정되었어요!

${selectedClass.description}

✨ **특징**
${selectedClass.features.map(f => `• ${f}`).join('\n')}

💬 ${selectedClass.recommendedFor}에게 딱 맞아요!

이제 학습을 시작할 준비가 됐어요! 🚀`;
    }
  }

  // ==================== FR-053: 오리엔테이션 메서드 ====================

  /**
   * 오리엔테이션 시작
   */
  startOrientation(studentId: string): OrientationProgress {
    const steps: OrientationStep[] = [
      {
        id: 'welcome',
        title: '환영합니다! 👋',
        description: '퀘스티 학습 코치에 오신 것을 환영해요! AI가 학습을 도와드릴게요.',
        action: '다음으로 넘어가기',
        completed: false,
      },
      {
        id: 'profile',
        title: '프로필 확인 📋',
        description: '입력하신 정보를 확인하고, 필요하면 수정할 수 있어요.',
        action: '프로필 확인하기',
        completed: false,
      },
      {
        id: 'plan',
        title: '학습 플랜 이해하기 📅',
        description: '매일 퀘스트를 완료하며 학습 목표를 달성해요. AI가 맞춤 플랜을 만들어드려요.',
        action: '플래너 살펴보기',
        completed: false,
      },
      {
        id: 'quest',
        title: '퀘스트 시스템 🎯',
        description: '매일 완료할 퀘스트가 주어져요. 완료하면 XP를 얻고 성장할 수 있어요!',
        action: '첫 퀘스트 확인하기',
        completed: false,
      },
      {
        id: 'coach',
        title: 'AI 코치 만나기 🤖',
        description: '언제든 코치에게 질문하세요. 학습 조언, 설명, 격려를 받을 수 있어요.',
        action: '코치와 인사하기',
        completed: false,
      },
      {
        id: 'complete',
        title: '준비 완료! 🚀',
        description: '이제 학습을 시작할 준비가 됐어요! 함께 목표를 달성해봐요!',
        action: '학습 시작하기',
        completed: false,
      },
    ];

    return {
      studentId,
      steps,
      currentStep: 0,
      completedSteps: 0,
      totalSteps: steps.length,
      startedAt: new Date(),
    };
  }

  /**
   * 오리엔테이션 단계 완료
   */
  completeOrientationStep(
    progress: OrientationProgress,
    stepId: string
  ): OrientationProgress {
    const stepIndex = progress.steps.findIndex(s => s.id === stepId);

    if (stepIndex === -1) {
      return progress;
    }

    const step = progress.steps[stepIndex];
    if (step && !step.completed) {
      step.completed = true;
      progress.completedSteps++;
    }

    // 다음 단계로 이동
    if (stepIndex === progress.currentStep && progress.currentStep < progress.totalSteps - 1) {
      progress.currentStep++;
    }

    // 모든 단계 완료 시
    if (progress.completedSteps === progress.totalSteps) {
      progress.completedAt = new Date();
    }

    return progress;
  }

  /**
   * 오리엔테이션 메시지 생성 (LLM 사용)
   */
  async generateOrientationStepMessage(
    progress: OrientationProgress,
    stepIndex?: number
  ): Promise<string> {
    const index = stepIndex ?? progress.currentStep;
    const step = progress.steps[index];

    if (!step) {
      return '오리엔테이션이 완료되었어요! 🎉';
    }

    const progressBar = progress.steps
      .map((s, i) => (i < index ? '●' : i === index ? '◐' : '○'))
      .join(' ');

    // LLM으로 개인화된 오리엔테이션 메시지 생성
    try {
      const prompt = `당신은 학습 상담 전문가 AI입니다.

## 오리엔테이션 진행 상황
- 현재 단계: ${index + 1}/${progress.totalSteps}
- 단계 제목: ${step.title}
- 단계 설명: ${step.description}
- 다음 액션: ${step.action}
- 완료 여부: ${step.completed ? '완료됨' : '진행 중'}
- 진행률: ${progressBar}

## 응답 지침
1. 현재 단계를 친근하게 안내
2. 다음에 할 일을 명확하게 설명
3. 격려와 동기부여 포함
4. 마크다운 형식, 이모지 사용
5. 2-3문단으로 간결하게`;

      const response = await this.generateResponse(prompt, '다음 단계가 뭐예요?');
      return response;
    } catch (error) {
      console.warn('[ADMISSION] LLM failed for orientation step, using template:', error);
      // 템플릿 폴백
      return `📖 **오리엔테이션** (${index + 1}/${progress.totalSteps})

${progressBar}

## ${step.title}

${step.description}

👉 **${step.action}**

${step.completed ? '✅ 완료됨' : ''}`;
    }
  }

  /**
   * 오리엔테이션 완료 메시지 (LLM 사용)
   */
  async generateOrientationCompleteMessage(studentName: string): Promise<string> {
    // LLM으로 개인화된 완료 메시지 생성
    try {
      const prompt = `당신은 학습 상담 전문가 AI입니다.

## 상황
- 학생 이름: ${studentName}
- 상태: 오리엔테이션 완료

## 응답 지침
1. 오리엔테이션 완료 축하
2. 퀘스티의 주요 기능 간단히 안내
3. 다음 단계 제안 (오늘의 퀘스트, 학습 계획, 코치 상담)
4. 강력한 동기부여 메시지
5. 마크다운 형식, 이모지 사용
6. 3-4문단으로 간결하게`;

      const response = await this.generateResponse(prompt, '오리엔테이션을 마쳤어요!');
      return response;
    } catch (error) {
      console.warn('[ADMISSION] LLM failed for orientation complete, using template:', error);
      // 템플릿 폴백
      return `🎉 **오리엔테이션 완료!**

${studentName}님, 축하해요! 이제 퀘스티의 모든 기능을 사용할 준비가 됐어요!

📚 **시작하기**
• "오늘 뭐 공부해?" - 오늘의 퀘스트 확인
• "계획 세워줘" - 새로운 학습 플랜 생성
• "도움이 필요해" - 언제든 코치에게 질문

함께 목표를 향해 달려가요! 💪🔥`;
    }
  }
}

type OnboardingStage =
  | 'WELCOME'
  | 'COLLECT_BASIC'
  | 'COLLECT_GOALS'
  | 'COLLECT_STYLE'
  | 'COMPLETE'
  | 'GENERAL'
  | 'LEVEL_TEST'
  | 'CLASS_ASSIGN'
  | 'ORIENTATION';

// ==================== FR-051: 레벨 테스트 ====================

export interface LevelTestQuestion {
  id: string;
  subject: Subject;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  question: string;
  options: string[];
  correctAnswer: number;
  topic: string;
}

export interface LevelTestResult {
  studentId: string;
  subject: Subject;
  totalQuestions: number;
  correctAnswers: number;
  score: number; // 0-100
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  weakTopics: string[];
  strongTopics: string[];
  recommendedClass: string;
  completedAt: Date;
}

// ==================== FR-052: 반 배정 ====================

export interface ClassOption {
  id: string;
  name: string;
  description: string;
  pace: 'SLOW' | 'MEDIUM' | 'FAST';
  difficulty: 'BASIC' | 'STANDARD' | 'ADVANCED';
  features: string[];
  recommendedFor: string;
}

export interface ClassAssignment {
  studentId: string;
  classId: string;
  className: string;
  assignedAt: Date;
  reason: string;
}

// ==================== FR-053: 오리엔테이션 ====================

export interface OrientationStep {
  id: string;
  title: string;
  description: string;
  action: string;
  completed: boolean;
}

export interface OrientationProgress {
  studentId: string;
  steps: OrientationStep[];
  currentStep: number;
  completedSteps: number;
  totalSteps: number;
  startedAt: Date;
  completedAt?: Date;
}
