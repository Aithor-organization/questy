/**
 * Mimac (대성마이맥) 크롤러 데이터 모델
 */

import { z } from 'zod';

// Zod 스키마 정의
export const MimacLecturerSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  teacherCode: z.string().optional(),
});

export const MimacCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  lecturerId: z.string(),
  lecturerName: z.string(),
  price: z.number().min(0).optional(),
  discountPrice: z.number().min(0).optional(),
  thumbnailUrl: z.string().optional(),
  courseUrl: z.string().optional(),
  totalLectures: z.number().min(0).optional(),
});

export const MimacCourseDetailSchema = MimacCourseSchema.extend({
  curriculum: z.array(z.string()).optional(),
  objectives: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
  isCompleted: z.boolean().optional(),
});

// 커리큘럼 항목 (API 응답용)
export const MimacCurriculumItemSchema = z.object({
  crclmNo: z.number(),        // 강의 번호
  mvptName: z.string(),       // 강의 제목
  lctrTime: z.string().optional(),  // 강의 시간
  regDttm: z.string().optional(),   // 등록일
});

// 완강 감지 키워드
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
export type MimacLecturer = z.infer<typeof MimacLecturerSchema>;
export type MimacCourse = z.infer<typeof MimacCourseSchema>;
export type MimacCourseDetail = z.infer<typeof MimacCourseDetailSchema>;
export type MimacCurriculumItem = z.infer<typeof MimacCurriculumItemSchema>;

// 과목 카테고리 매핑
export const MIMAC_SUBJECTS = {
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
export function validateLecturer(data: unknown): MimacLecturer {
  return MimacLecturerSchema.parse(data);
}

export function validateCourse(data: unknown): MimacCourse {
  return MimacCourseSchema.parse(data);
}

export function validateCourseDetail(data: unknown): MimacCourseDetail {
  return MimacCourseDetailSchema.parse(data);
}

export function calculateDiscountRate(originalPrice: number, discountPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
}
