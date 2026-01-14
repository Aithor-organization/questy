/**
 * 템플릿 기반 응답 핸들러 (LLM 실패 시 폴백)
 */

import type { StudentProfile } from '../../../../types/agent.js';
import { extractGrade, extractGoals, extractSubjects, extractLearningStyle } from '../utils/extract-utils.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 환영 메시지
 */
export function generateWelcome(): string {
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
export function collectBasicInfo(message: string, extractedName?: string): string {
  const grade = extractGrade(message);

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
export function collectGoals(message: string): string {
  const goals = extractGoals(message);

  let response = '';
  if (goals.length > 0 && goals[0] !== '학습 능력 향상') {
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
export function collectLearningStyle(message: string): string {
  const style = extractLearningStyle(message);

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
export function createProfile(
  studentId: string,
  message: string,
  existingProfile?: StudentProfile
): StudentProfile {
  const now = new Date();

  return {
    id: studentId || uuidv4(),
    name: existingProfile?.name ?? '학생',
    grade: existingProfile?.grade ?? extractGrade(message) ?? '고2',
    targetExam: '수능',
    enrolledSubjects: extractSubjects(message),
    learningStyle: extractLearningStyle(message),
    preferredStudyTime: '저녁',
    goals: extractGoals(message),
    createdAt: existingProfile?.createdAt ?? now,
    lastActiveAt: now,
  };
}

/**
 * 완료 메시지
 */
export function generateCompletionMessage(profile: StudentProfile): string {
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
export function handleGeneralInquiry(_message: string): string {
  return `안녕하세요! 무엇을 도와드릴까요? 😊

📌 **자주 묻는 질문**
- "수업 등록하고 싶어요" - 새로운 과목 추가
- "프로필 수정해줘" - 정보 업데이트
- "어떻게 시작해?" - 이용 가이드

궁금한 게 있으면 편하게 물어봐 주세요!`;
}
