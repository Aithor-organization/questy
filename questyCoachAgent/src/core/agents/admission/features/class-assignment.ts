/**
 * 반 배정 기능 (FR-052)
 */

import type { Subject } from '../../../../types/memory.js';
import type { ClassOption, ClassAssignment } from '../types.js';

type GenerateResponseFn = (prompt: string, message: string) => Promise<string>;

/**
 * 반 옵션 조회
 */
export function getClassOptions(_subject: Subject): ClassOption[] {
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
export function assignClass(
  studentId: string,
  classId: string
): ClassAssignment {
  const classOptions = getClassOptions('GENERAL');
  const selectedClass = classOptions.find(c => c.id === classId);

  if (!selectedClass) {
    throw new Error('존재하지 않는 반입니다');
  }

  return {
    studentId,
    classId,
    className: selectedClass.name,
    assignedAt: new Date(),
    reason: '학생 선택에 의한 배정',
  };
}

/**
 * 반 배정 메시지 생성 (LLM 사용)
 */
export async function generateClassAssignmentMessage(
  assignment: ClassAssignment,
  classOptions: ClassOption[],
  generateResponse: GenerateResponseFn
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

    const response = await generateResponse(prompt, '어떤 반에 배정됐나요?');
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
