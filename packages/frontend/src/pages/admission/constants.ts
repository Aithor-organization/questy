/**
 * Admission Page Constants
 * 입학 상담 페이지에서 사용하는 상수 정의
 */

import type { OrientationStep } from './types';

export const GRADE_OPTIONS = ['고1', '고2', '고3', 'N수생', '중3', '중2', '중1'];

export const SUBJECT_OPTIONS = [
  { id: 'MATH', label: '수학', emoji: '📐' },
  { id: 'KOREAN', label: '국어', emoji: '📚' },
  { id: 'ENGLISH', label: '영어', emoji: '🌍' },
  { id: 'SCIENCE', label: '과학', emoji: '🔬' },
  { id: 'SOCIAL', label: '사회', emoji: '🌏' },
];

export const ORIENTATION_STEPS: OrientationStep[] = [
  { id: 'welcome', title: '환영해요!', description: 'QuestyBook은 AI 코치가 함께하는 학습 플래너예요.', icon: '👋' },
  { id: 'quest', title: '퀘스트란?', description: '매일 해야 할 학습을 퀘스트로 만들어 게임처럼 진행해요.', icon: '🎯' },
  { id: 'coach', title: 'AI 코치', description: '힘들 때, 막힐 때 언제든 코치에게 물어보세요!', icon: '🤖' },
  { id: 'report', title: '학습 리포트', description: '매주 학습 현황을 분석해서 알려드려요.', icon: '📊' },
  { id: 'start', title: '시작해볼까요?', description: '이제 첫 학습 플랜을 만들어봐요!', icon: '🚀' },
];

export const DEFAULT_CLASS_OPTIONS = [
  { id: 'slow', name: '천천히반', description: '기초부터 차근차근', pace: 'SLOW', features: ['기초 개념 강화', '반복 학습', '1:1 피드백'] },
  { id: 'medium', name: '꾸준히반', description: '균형 잡힌 학습', pace: 'MEDIUM', features: ['핵심 개념 정리', '문제 풀이 연습', '주간 테스트'] },
  { id: 'fast', name: '달리기반', description: '빠른 진도', pace: 'FAST', features: ['심화 학습', '고난도 문제', '자기주도 학습'] },
];

export const DEFAULT_LEVEL_TEST_QUESTIONS = [
  { id: '1', subject: 'MATH', difficulty: 'EASY', question: '2 + 3 = ?', options: ['4', '5', '6', '7'], correctAnswer: 1 },
  { id: '2', subject: 'MATH', difficulty: 'EASY', question: '5 × 4 = ?', options: ['15', '20', '25', '30'], correctAnswer: 1 },
  { id: '3', subject: 'MATH', difficulty: 'MEDIUM', question: '12 ÷ 4 = ?', options: ['2', '3', '4', '5'], correctAnswer: 1 },
];
