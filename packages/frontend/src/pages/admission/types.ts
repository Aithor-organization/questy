/**
 * Admission Page Types
 * 입학 상담 페이지에서 사용하는 타입 정의
 */

export interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

export interface StudentInfo {
  name: string;
  grade: string;
  subjects: string[];
  goals: string[];
}

export interface LevelTestQuestion {
  id: string;
  subject: string;
  difficulty: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface LevelTestResult {
  level: string;
  score: number;
  message: string;
}

export interface ClassOption {
  id: string;
  name: string;
  description: string;
  pace: string;
  features: string[];
}

export interface OrientationStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export type AdmissionStep =
  | 'intro' | 'name' | 'grade' | 'subjects' | 'goals' | 'registered'
  | 'level-test-intro' | 'level-test' | 'level-test-result'
  | 'class-select' | 'class-assigned'
  | 'orientation' | 'complete';
