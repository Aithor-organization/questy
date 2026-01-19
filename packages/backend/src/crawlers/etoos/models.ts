/**
 * 이투스 크롤러 타입 정의
 */

export interface EtoosLecturer {
  id: string;
  name: string;
  subject?: string;
  imageUrl?: string;
}

export interface EtoosCourse {
  id: string;
  title: string;
  lecturerId?: string;
  lecturerName: string;
  price?: number;
  thumbnailUrl?: string;
}

export interface EtoosCourseDetail extends EtoosCourse {
  description?: string;
  curriculum: string[];
  objectives?: string[];
  features?: string[];
  isCompleted: boolean;
  totalLectures: number;
  duration?: string;
  category?: string;
}

export interface EtoosCurriculumItem {
  order: number;
  title: string;
  duration?: string;
  indexCount?: number;
  isPreview?: boolean;
}
