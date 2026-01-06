/**
 * CoachAgent
 * 학습 코칭 전문 에이전트
 * - 개념 설명 및 문제 풀이 지도
 * - 동기부여 및 감정 지원
 * - 학습 피드백 제공
 * - 저녁 리뷰 (FR-025)
 * - 미학습 대응 (FR-024)
 * - 위기 개입 (FR-026)
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentRequest,
  AgentResponse,
  DirectorContext,
} from '../../types/agent.js';

// 오늘의 학습 현황 인터페이스
interface TodayStudyStatus {
  completedQuests: number;
  totalQuests: number;
  completedMinutes: number;
  remainingQuests: string[];
  streak: number;
}

// 미학습 상황 인터페이스
interface MissedStudyContext {
  missedDays: number;
  lastStudyDate: string | null;
  missedQuests: string[];
  suggestedReschedule: boolean;
}

const COACH_SYSTEM_PROMPT = `당신은 학생의 학습을 돕는 전문 AI 코치입니다.

## 핵심 역할
1. **개념 설명**: 학생의 수준에 맞춰 쉽고 명확하게 설명
2. **문제 풀이 지도**: 힌트를 주며 스스로 생각하도록 유도
3. **동기부여**: 긍정적 피드백과 격려로 학습 의욕 고취
4. **감정 지원**: 학생의 감정 상태를 파악하고 적절히 대응

## 코칭 원칙
- 답을 직접 알려주기보다 생각하는 과정을 안내
- 틀린 부분을 지적하되, 격려와 함께
- 학생의 페이스를 존중하고 압박하지 않음
- 작은 성취도 인정하고 칭찬

## 대화 스타일
- 친근하고 따뜻한 어조
- 이모지 적절히 활용 😊
- 한 번에 너무 많은 정보 X
- 질문으로 이해도 확인

## 학생 컨텍스트 활용
- 이전 학습 기억을 참고하여 맥락 있는 답변
- 약한 부분은 더 자세히, 강한 부분은 간결하게
- 번아웃 징후 시 휴식 권유`;

export class CoachAgent extends BaseAgent {
  constructor() {
    super({
      role: 'COACH',
      modelConfig: {
        id: 'claude-4.5-haiku',
        provider: 'anthropic',
        maxTokens: 2048,
        temperature: 0.7,
        purpose: '학습 코칭 및 감정 지원',
      },
      systemPrompt: COACH_SYSTEM_PROMPT,
    });
  }

  async process(
    request: AgentRequest,
    context: DirectorContext
  ): Promise<AgentResponse> {
    const { message, metadata } = request;

    // 학생 상태 파악
    const studentState = this.analyzeStudentState(message, context);

    // 응답 유형 결정
    const responseType = this.determineResponseType(studentState, message);

    // 메모리 컨텍스트 적용
    const memoryContext = this.buildMemoryContext(context);

    // 응답 생성
    const response = await this.generateCoachingResponse(
      message,
      responseType,
      memoryContext,
      studentState
    );

    return this.createResponse(response, {
      memoryExtracted: true,
      suggestedFollowUp: this.generateFollowUps(responseType),
    });
  }

  /**
   * 학생 상태 분석
   */
  private analyzeStudentState(
    message: string,
    context: DirectorContext
  ): StudentState {
    const burnout = context.memoryContext.burnoutStatus;
    const emotion = this.detectEmotion(message);

    return {
      needsMotivation: /힘들|어려|못하겠|포기/.test(message),
      isConfused: /모르겠|헷갈|이해.*안/.test(message),
      isConfident: /알겠|이해했|쉬워/.test(message),
      emotion,
      burnoutLevel: burnout?.level ?? 'LOW',
    };
  }

  /**
   * 응답 유형 결정
   */
  private determineResponseType(
    state: StudentState,
    message: string
  ): ResponseType {
    if (state.burnoutLevel === 'HIGH') return 'EMOTIONAL_SUPPORT';
    if (state.needsMotivation) return 'MOTIVATION';
    if (state.isConfused) return 'EXPLANATION';
    if (/문제|풀어|답/.test(message)) return 'PROBLEM_SOLVING';
    if (/피드백|어땠/.test(message)) return 'FEEDBACK';
    return 'GENERAL';
  }

  /**
   * 메모리 컨텍스트 구성
   */
  private buildMemoryContext(context: DirectorContext): string {
    const memories = context.memoryContext.relevantMemories;
    if (memories.length === 0) return '';

    const memoryText = memories.slice(0, 3).map((m) =>
      `- [${m.type}] ${m.title}: ${m.content.slice(0, 50)}...`
    ).join('\n');

    return `\n## 이전 학습 기억\n${memoryText}`;
  }

  /**
   * 코칭 응답 생성 (실제 LLM 사용)
   */
  private async generateCoachingResponse(
    message: string,
    responseType: ResponseType,
    memoryContext: string,
    state: StudentState
  ): Promise<string> {
    // 응답 유형별 추가 지시사항
    const responseGuidelines: Record<ResponseType, string> = {
      EMOTIONAL_SUPPORT: `학생이 지쳐있거나 힘들어 보입니다.
따뜻하게 위로하고 휴식을 권유하세요. 절대 공부를 강요하지 마세요.`,
      MOTIVATION: `학생이 어려움을 느끼고 있습니다.
긍정적으로 격려하고, 작은 성취도 인정해주세요.
"할 수 있어"라는 메시지를 전달하세요.`,
      EXPLANATION: `학생이 개념 설명을 원합니다.
학생의 수준에 맞춰 쉽게 설명하고, 예시를 들어주세요.
한 번에 너무 많은 정보를 주지 마세요.`,
      PROBLEM_SOLVING: `학생이 문제 풀이 도움을 원합니다.
답을 직접 알려주지 말고, 생각하는 과정을 안내하세요.
힌트를 주고 스스로 생각하도록 유도하세요.`,
      FEEDBACK: `학생의 학습에 대한 피드백을 요청했습니다.
칭찬과 함께 개선점을 부드럽게 제안하세요.`,
      GENERAL: `일반적인 대화입니다.
친근하고 따뜻하게 응답하세요.`,
      EVENING_REVIEW: `저녁 학습 리뷰입니다.
오늘 학습을 따뜻하게 정리하고, 내일 학습을 가볍게 안내하세요.`,
      MISSED_STUDY: `학습을 놓친 학생에 대한 응답입니다.
공감하고 부담 없이 다시 시작할 수 있도록 격려하세요.`,
      CRISIS_INTERVENTION: `위기 상황 개입입니다.
매우 따뜻하고 공감적인 톤으로, 학생의 어려움을 인정하세요.
작은 것부터 천천히 시작하도록 안내하세요.`,
    };

    // 학생 상태 정보
    const stateInfo = `
## 현재 학생 상태
- 동기부여 필요: ${state.needsMotivation ? '예' : '아니오'}
- 혼란 상태: ${state.isConfused ? '예' : '아니오'}
- 자신감: ${state.isConfident ? '높음' : '낮음'}
- 감정: ${state.emotion}
- 번아웃 레벨: ${state.burnoutLevel}`;

    // 전체 프롬프트 구성
    const fullPrompt = this.buildPrompt(
      this.systemPrompt,
      memoryContext,
      stateInfo
    ) + `\n\n## 이번 응답 가이드라인\n${responseGuidelines[responseType]}`;

    try {
      // 실제 LLM 호출
      const response = await this.generateResponse(
        fullPrompt,
        message,
        {
          model: 'claude-4.5-haiku',
          temperature: 0.7,
          maxTokens: 1024,
        }
      );
      return response;
    } catch (error) {
      console.error('[CoachAgent] LLM call failed, using fallback:', error);
      // 폴백: 기본 템플릿
      return this.getFallbackResponse(responseType, state);
    }
  }

  /**
   * 폴백 응답 (LLM 실패 시)
   */
  private getFallbackResponse(responseType: ResponseType, state: StudentState): string {
    const templates: Record<ResponseType, string> = {
      EMOTIONAL_SUPPORT: `😊 지금 많이 지쳤구나. 오늘은 무리하지 말고 잠시 쉬어가는 건 어떨까?
공부는 마라톤이야. 쉬어가면서 해도 괜찮아.`,
      MOTIVATION: `💪 어렵게 느껴지는 건 당연해! 그게 성장하고 있다는 증거야.
한 걸음씩 천천히 가보자. 넌 충분히 할 수 있어!`,
      EXPLANATION: `좋은 질문이야! 😊 차근차근 알려줄게.`,
      PROBLEM_SOLVING: `이 문제 함께 풀어보자! 🎯
먼저 문제에서 구하라는 게 뭔지 찾아볼까?`,
      FEEDBACK: `잘했어! 👏
${state.isConfident ? '이해를 잘 하고 있구나.' : '조금만 더 연습하면 완벽해질 거야!'}`,
      GENERAL: `안녕! 무엇이든 물어봐도 좋아. 😊
함께 공부하자!`,
      EVENING_REVIEW: `🌙 오늘도 고생했어! 오늘 학습을 간단히 정리해볼게.
내일도 함께 화이팅하자!`,
      MISSED_STUDY: `😊 괜찮아, 누구나 쉬어갈 때가 있어.
다시 시작하는 것 자체가 대단한 거야! 천천히 해보자.`,
      CRISIS_INTERVENTION: `💕 많이 힘들었구나. 정말 걱정했어.
무리하지 말고, 작은 것부터 천천히 시작해보자. 난 항상 여기 있을게.`,
    };
    return templates[responseType];
  }

  /**
   * 감정 감지
   */
  private detectEmotion(message: string): string {
    if (/기뻐|좋아|신나/.test(message)) return 'POSITIVE';
    if (/슬퍼|우울|힘들/.test(message)) return 'NEGATIVE';
    if (/화나|짜증|답답/.test(message)) return 'FRUSTRATED';
    return 'NEUTRAL';
  }

  /**
   * 후속 질문 생성
   */
  private generateFollowUps(responseType: ResponseType): string[] {
    const followUps: Record<ResponseType, string[]> = {
      EMOTIONAL_SUPPORT: ['기분이 나아지면 말해줘', '쉬고 나서 다시 시작할까?'],
      MOTIVATION: ['어떤 부분이 가장 어려워?', '천천히 시작해볼까?'],
      EXPLANATION: ['이해가 됐어?', '더 궁금한 게 있어?'],
      PROBLEM_SOLVING: ['힌트가 필요해?', '어디까지 풀었어?'],
      FEEDBACK: ['다음 문제도 풀어볼까?', '비슷한 유형 더 연습할까?'],
      GENERAL: ['오늘 뭘 공부하고 싶어?', '어떤 과목이 가장 급해?'],
      EVENING_REVIEW: ['내일 계획은 어때?', '오늘 어려웠던 부분 있어?'],
      MISSED_STUDY: ['오늘은 조금만 해볼까?', '일정 조정해줄까?'],
      CRISIS_INTERVENTION: ['무슨 일 있었어?', '도움이 필요하면 말해줘'],
    };

    return followUps[responseType] ?? [];
  }

  /**
   * FR-025: 저녁 리뷰 생성
   * 오늘 학습 요약, 달성률 피드백, 내일 예고, 스트릭 현황
   */
  async generateEveningReview(
    studentName: string,
    todayStatus: TodayStudyStatus,
    tomorrowQuests: string[]
  ): Promise<string> {
    const completionRate = todayStatus.totalQuests > 0
      ? Math.round((todayStatus.completedQuests / todayStatus.totalQuests) * 100)
      : 0;

    const prompt = `## 저녁 리뷰 생성
학생 이름: ${studentName}
오늘 달성률: ${completionRate}% (${todayStatus.completedQuests}/${todayStatus.totalQuests} 퀘스트)
학습 시간: ${todayStatus.completedMinutes}분
남은 퀘스트: ${todayStatus.remainingQuests.join(', ') || '없음'}
연속 학습일: ${todayStatus.streak}일
내일 예정: ${tomorrowQuests.join(', ') || '미정'}

## 저녁 리뷰 규칙
1. 오늘 학습 요약 (구체적인 성과)
2. 달성률에 맞는 피드백:
   - 100%: 축하 + 칭찬
   - 70-99%: 격려 + 작은 아쉬움
   - 50-69%: 공감 + 내일 응원
   - 50% 미만: 따뜻한 위로 + 작은 목표 제안
3. 내일 예고 (가볍게)
4. 스트릭 언급 (있다면)
5. 푹 쉬라는 인사`;

    try {
      const response = await this.generateResponse(
        this.systemPrompt + '\n\n' + prompt,
        '저녁 리뷰를 작성해주세요.',
        { model: 'claude-4.5-haiku', temperature: 0.7, maxTokens: 512 }
      );
      return response;
    } catch {
      // 폴백 템플릿
      if (completionRate >= 100) {
        return `${studentName}야, 오늘 정말 대단했어! 🎉\n\n` +
          `모든 퀘스트 완료! ${todayStatus.completedMinutes}분 동안 열심히 했네.\n` +
          (todayStatus.streak > 1 ? `🔥 ${todayStatus.streak}일 연속 학습 중이야!\n\n` : '\n') +
          `내일은 ${tomorrowQuests[0] || '새로운 도전'}이 기다리고 있어.\n` +
          `오늘은 푹 쉬어! 🌙`;
      } else if (completionRate >= 70) {
        return `${studentName}야, 오늘도 수고했어! 👏\n\n` +
          `${todayStatus.completedQuests}개 퀘스트 완료! 거의 다 했네.\n` +
          `${todayStatus.remainingQuests.length > 0 ? `남은 건 내일 이어가자.` : ''}\n\n` +
          `내일 화이팅! 푹 쉬어 🌙`;
      } else {
        return `${studentName}야, 오늘 하루 수고했어 😊\n\n` +
          `바쁜 날이었구나. 괜찮아, 내일 다시 시작하면 돼.\n` +
          `작은 것부터 천천히 해보자.\n\n` +
          `푹 쉬고 내일 보자! 🌙`;
      }
    }
  }

  /**
   * FR-024: 미학습 대응
   * 공감적 메시지 + 일정 재조정 제안 + "오늘 30분만 해볼까?" 협상
   */
  async generateMissedStudyResponse(
    studentName: string,
    missedContext: MissedStudyContext
  ): Promise<string> {
    const { missedDays, missedQuests, suggestedReschedule } = missedContext;

    // 미학습 기간에 따른 톤 조절
    let tone: 'gentle' | 'concerned' | 'supportive' = 'gentle';
    if (missedDays >= 3) tone = 'concerned';
    else if (missedDays >= 1) tone = 'supportive';

    const prompt = `## 미학습 대응 메시지 생성
학생 이름: ${studentName}
미학습 일수: ${missedDays}일
놓친 퀘스트: ${missedQuests.join(', ')}
일정 재조정 제안 여부: ${suggestedReschedule ? '예' : '아니오'}

## 대응 규칙 (절대 비난/강압 금지!)
1. 톤: ${tone === 'concerned' ? '걱정하는 톤 (하지만 따뜻하게)' : tone === 'supportive' ? '응원하는 톤' : '가벼운 톤'}
2. 공감 표현 필수 ("힘들었구나", "바빴구나")
3. 협상 제안: "오늘 10분만 해볼까?" 또는 "짧게 1개만 해볼까?"
4. 일정 재조정 옵션 제시 (원하면)
5. 절대 금지 표현: "왜 안 했어?", "실망이야", "해야 해"`;

    try {
      const response = await this.generateResponse(
        this.systemPrompt + '\n\n' + prompt,
        '미학습 대응 메시지를 작성해주세요.',
        { model: 'claude-4.5-haiku', temperature: 0.7, maxTokens: 512 }
      );
      return response;
    } catch {
      // 폴백 템플릿
      if (missedDays >= 3) {
        return `${studentName}야... 요즘 많이 바빴구나 😢\n\n` +
          `걱정했어. 괜찮아?\n` +
          `무리하지 않아도 돼. 오늘은 딱 10분만 해볼까?\n` +
          `아니면 일정을 다시 조정해줄 수도 있어.\n\n` +
          `어떻게 하고 싶어?`;
      } else if (missedDays >= 1) {
        return `${studentName}야, 어제 바빴구나! 😊\n\n` +
          `괜찮아, 누구나 그런 날 있어.\n` +
          `오늘 30분만 해볼까? 아니면 짧게 1개만?\n\n` +
          `선택해줘!`;
      }
      return `${studentName}야, 오늘 공부 시작할 준비 됐어? 😊\n\n` +
        `천천히 시작해보자!`;
    }
  }

  /**
   * FR-026: 위기 개입 (연속 3일 미학습)
   * Gemini 3 Flash로 업그레이드하여 특별 공감 메시지 생성
   */
  async generateCrisisIntervention(
    studentName: string,
    missedDays: number,
    recentEmotions: string[]
  ): Promise<string> {
    const hasNegativeEmotions = recentEmotions.some(e =>
      ['NEGATIVE', 'FRUSTRATED', 'STRESSED'].includes(e)
    );

    const prompt = `## 위기 개입 메시지 (중요!)
학생 이름: ${studentName}
연속 미학습: ${missedDays}일
최근 감정 상태: ${recentEmotions.join(', ') || '알 수 없음'}
부정적 감정 감지: ${hasNegativeEmotions ? '예' : '아니오'}

## 위기 개입 규칙
1. **절대 비난/압박 금지** - 학생이 더 힘들어짐
2. **진심 어린 걱정 표현** - "많이 걱정했어", "괜찮아?"
3. **공부보다 학생의 상태 우선** - "공부보다 네가 더 중요해"
4. **선택권 부여** - 학생이 통제감을 느끼도록
5. **아주 작은 목표 제시** - "5분만", "1문제만"
6. **플랜 축소 제안** - "양을 줄여줄 수도 있어"
7. **휴식 권유도 OK** - "쉬어도 괜찮아"

## 메시지 톤
- 따뜻하고 진심 어린 목소리
- 걱정하지만 압박하지 않음
- 학생의 선택을 존중`;

    try {
      // 위기 상황: 고성능 모델로 업그레이드
      const response = await this.generateResponse(
        this.systemPrompt + '\n\n' + prompt,
        '위기 개입 메시지를 작성해주세요.',
        { model: 'gemini-3-flash', temperature: 0.6, maxTokens: 600 }
      );
      return response;
    } catch {
      // 폴백 템플릿 (매우 중요한 메시지)
      return `${studentName}야... 😢\n\n` +
        `요즘 많이 힘들었구나. 걱정했어.\n\n` +
        `공부보다 네가 더 중요해.\n` +
        `무슨 일 있으면 얘기해줘. 듣고 있을게.\n\n` +
        `준비되면, 딱 5분만 같이 해볼까?\n` +
        `아니면 플랜을 좀 줄여줄 수도 있어.\n\n` +
        `어떻게 하고 싶어? 네가 정해도 돼 💙`;
    }
  }

  /**
   * FR-021: 학습 시작 유도 + 재알림 메시지 생성
   */
  async generateStudyStartReminder(
    studentName: string,
    reminderType: 'first' | '15min' | '30min',
    questName: string,
    estimatedMinutes: number
  ): Promise<string> {
    const now = new Date();
    const endTime = new Date(now.getTime() + estimatedMinutes * 60000);
    const endTimeStr = `${endTime.getHours()}시 ${endTime.getMinutes()}분`;

    const templates = {
      first: `${studentName}야~ 공부 시작할 시간이야! 📚\n\n` +
        `오늘의 퀘스트: ${questName}\n` +
        `지금 시작하면 ${endTimeStr}에 끝나!\n\n` +
        `준비 됐어? 💪`,

      '15min': `${studentName}야, 아직 시작 안 했구나! 😊\n\n` +
        `괜찮아, 지금 시작해도 충분해.\n` +
        `${questName} - ${estimatedMinutes}분이면 끝나!\n\n` +
        `같이 해보자!`,

      '30min': `${studentName}야~ 한 번 더 알려줄게 ⏰\n\n` +
        `오늘 ${questName} 남았어.\n` +
        `바빠? 10분만 짧게 해볼까?\n` +
        `아니면 나중에 해도 돼!\n\n` +
        `[지금 시작] [나중에]`,
    };

    return templates[reminderType];
  }
}

// 내부 타입
interface StudentState {
  needsMotivation: boolean;
  isConfused: boolean;
  isConfident: boolean;
  emotion: string;
  burnoutLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

type ResponseType =
  | 'EMOTIONAL_SUPPORT'
  | 'MOTIVATION'
  | 'EXPLANATION'
  | 'PROBLEM_SOLVING'
  | 'FEEDBACK'
  | 'GENERAL'
  | 'EVENING_REVIEW'
  | 'MISSED_STUDY'
  | 'CRISIS_INTERVENTION';
