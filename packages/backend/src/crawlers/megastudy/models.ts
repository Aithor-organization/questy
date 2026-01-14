/**
 * Megastudy 크롤러 데이터 모델
 */

import { z } from 'zod';

// Zod 스키마 정의
export const MegastudyLecturerSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  profileUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  teacherCode: z.string().optional(),
  isPopular: z.boolean().optional(),
});

export const MegastudyCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  lecturerId: z.string(),
  lecturerName: z.string(),
  price: z.number().min(0).optional(),
  discountPrice: z.number().min(0).optional(),
  students: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  thumbnailUrl: z.string().optional(),
  courseUrl: z.string().optional(),
  lectureCode: z.string().optional(),
  totalLectures: z.number().min(0).optional(),
});

export const MegastudyCourseDetailSchema = MegastudyCourseSchema.extend({
  curriculum: z.array(z.string()).optional(),
  objectives: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
  reviews: z.array(z.object({
    rating: z.number().min(0).max(5),
    comment: z.string(),
    author: z.string().optional(),
    date: z.string().optional(),
  })).optional(),
  isCompleted: z.boolean().optional(),  // 완강 여부
});

// 완강 감지 키워드 (마지막 강의 제목에 포함되면 완강)
export const COMPLETION_INDICATORS = [
  '완강',
  '▶완강',
  '►완강',
  '★완강',
  '●완강',
  '[완강]',
  '(완강)',
  '완결',
  '마지막 강의',
  'COMPLETE',
] as const;

/**
 * 커리큘럼에서 완강 여부 감지
 * 마지막 강의 제목에 완강 키워드가 포함되어 있는지 확인
 */
export function detectCompletion(curriculum: string[] | undefined): boolean {
  if (!curriculum || curriculum.length === 0) return false;

  const lastLecture = curriculum[curriculum.length - 1];
  if (!lastLecture) return false;

  return COMPLETION_INDICATORS.some(indicator =>
    lastLecture.includes(indicator)
  );
}

// 타입 추론
export type MegastudyLecturer = z.infer<typeof MegastudyLecturerSchema>;
export type MegastudyCourse = z.infer<typeof MegastudyCourseSchema>;
export type MegastudyCourseDetail = z.infer<typeof MegastudyCourseDetailSchema>;

// 과목 카테고리 매핑
export const MEGASTUDY_SUBJECTS = {
  KOREAN: { code: 'korean', name: '국어', domainCode: 'kor' },
  ENGLISH: { code: 'english', name: '영어', domainCode: 'eng' },
  MATH: { code: 'math', name: '수학', domainCode: 'mat' },
  SCIENCE: { code: 'science', name: '과학', domainCode: 'sci' },
  SOCIAL: { code: 'social', name: '사회', domainCode: 'soc' },
  PHYSICS: { code: 'physics', name: '물리학', domainCode: 'phy' },
  CHEMISTRY: { code: 'chemistry', name: '화학', domainCode: 'che' },
  BIOLOGY: { code: 'biology', name: '생명과학', domainCode: 'bio' },
  EARTH_SCIENCE: { code: 'earth', name: '지구과학', domainCode: 'ear' },
  HISTORY: { code: 'history', name: '한국사', domainCode: 'his' },
} as const;

// 유틸리티 함수
export function validateLecturer(data: unknown): MegastudyLecturer {
  return MegastudyLecturerSchema.parse(data);
}

export function validateCourse(data: unknown): MegastudyCourse {
  return MegastudyCourseSchema.parse(data);
}

export function validateCourseDetail(data: unknown): MegastudyCourseDetail {
  return MegastudyCourseDetailSchema.parse(data);
}

export function calculateDiscountRate(originalPrice: number, discountPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
}
