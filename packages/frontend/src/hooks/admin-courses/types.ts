/**
 * Admin Courses - Types & Utilities
 * 타입 정의 및 유틸리티 함수
 */

import { API_BASE_URL } from '../../config';

// 크롤링 API 베이스 URL
export const CRAWL_API_BASE = API_BASE_URL;

// ngrok 무료 버전 경고 페이지 우회용 헤더
export const defaultHeaders: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
};

// 강사 타입
export interface Teacher {
  id?: string;
  name: string;
  platform: string;
  subjects: string[];
  courseCount: number;
}

// 강좌 타입
export interface Course {
  id: string;
  name: string;
  teacher: string;
  teacherId?: string;
  subject: string | null;
  platform: string;
  url: string | null;
  lectureCount: number;
  totalDuration: string | null;
  isCompleted: boolean;
  lastCrawledAt: string | null;
  chapters: Array<{
    num: string;
    title: string;
    duration: string;
  }>;
}

// 배치 업데이트 옵션
export interface BatchUpdateOptions {
  skipCompleted?: boolean;
  onlyOutdated?: boolean;
  maxCourses?: number;
}

// 배치 업데이트 진행 상황
export interface BatchProgressData {
  type: 'start' | 'progress' | 'complete' | 'error';
  total?: number;
  completed?: number;
  updated?: number;
  failed?: number;
  skipped?: number;
  error?: string;
  current?: {
    id: string;
    name: string;
    teacher?: string;
    success: boolean;
    diff?: number;
    isCompleted?: boolean;
    error?: string;
  };
}

// Supabase 응답 → Course 변환
export function mapCourseFromSupabase(row: any): Course {
  return {
    id: row.id,
    name: row.name,
    teacher: row.teacher_name,
    teacherId: row.teacher_id,
    subject: row.subject,
    platform: row.platform,
    url: row.url,
    lectureCount: row.lecture_count || 0,
    totalDuration: row.total_duration,
    isCompleted: row.is_completed || false,
    lastCrawledAt: row.last_crawled_at,
    chapters: row.lectures || [],
  };
}
