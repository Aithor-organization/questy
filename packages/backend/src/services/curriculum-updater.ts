/**
 * Curriculum Updater Service
 * 강좌 커리큘럼 자동 업데이트 서비스
 * - 미완강 강좌 대상으로 커리큘럼 크롤링
 * - 완강 감지 시 업데이트 대상에서 제외
 * - DB 업데이트 및 로깅
 */

import { getMegastudyCrawler, MegastudyCrawler } from '../crawlers/index.js';
import { detectCompletion } from '../crawlers/megastudy/models.js';
import {
  getIncompleteCourses,
  getCourse,
  updateCourseCurriculum,
  type Course,
} from '../db/index.js';

// 업데이트 결과 타입
export interface UpdateResult {
  courseId: string;
  courseName: string;
  success: boolean;
  isCompleted: boolean;
  lectureCount: number;
  previousLectureCount: number;
  error?: string;
}

export interface BatchUpdateResult {
  total: number;
  updated: number;
  completed: number;
  failed: number;
  skipped: number;
  results: UpdateResult[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// 강의 데이터 타입
interface Lecture {
  num: number;
  title: string;
  duration: string;
}

export class CurriculumUpdater {
  private crawler: MegastudyCrawler;
  private delayMs: number;

  constructor(options?: { delayMs?: number }) {
    this.crawler = getMegastudyCrawler();
    this.delayMs = options?.delayMs ?? 2000; // 기본 2초 딜레이
  }

  /**
   * 단일 강좌 커리큘럼 업데이트
   */
  async updateCourse(courseId: string): Promise<UpdateResult> {
    const course = getCourse(courseId);

    if (!course) {
      return {
        courseId,
        courseName: '',
        success: false,
        isCompleted: false,
        lectureCount: 0,
        previousLectureCount: 0,
        error: 'Course not found in database',
      };
    }

    // 이미 완강된 강좌는 스킵
    if (course.isCompleted) {
      return {
        courseId,
        courseName: course.name,
        success: true,
        isCompleted: true,
        lectureCount: course.lectureCount || 0,
        previousLectureCount: course.lectureCount || 0,
        error: 'Already completed, skipped',
      };
    }

    return this.updateCourseFromUrl(course);
  }

  /**
   * URL에서 커리큘럼을 가져와 강좌 업데이트
   */
  private async updateCourseFromUrl(course: Course): Promise<UpdateResult> {
    const previousLectureCount = course.lectureCount || 0;

    try {
      // URL이 없으면 기본 URL 생성 (megastudy 기본 패턴)
      const url = course.url ||
        `https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=${course.id}`;

      console.log(`[CurriculumUpdater] Crawling course ${course.id}: ${course.name}`);
      console.log(`[CurriculumUpdater] URL: ${url}`);

      const result = await this.crawler.getCurriculumFromUrl(url);
      console.log(`[CurriculumUpdater] Result: success=${result.success}, curriculum=${result.curriculum?.length || 0} items`);

      if (!result.success || !result.curriculum) {
        return {
          courseId: course.id,
          courseName: course.name,
          success: false,
          isCompleted: false,
          lectureCount: previousLectureCount,
          previousLectureCount,
          error: result.error || 'Failed to fetch curriculum',
        };
      }

      // 커리큘럼 파싱 및 완강 감지
      const lectures = this.parseCurriculumToLectures(result.curriculum);
      const isCompleted = detectCompletion(result.curriculum);

      // DB 업데이트
      updateCourseCurriculum(course.id, {
        lectures: JSON.stringify(lectures),
        lectureCount: lectures.length,
        totalDuration: this.calculateTotalDuration(lectures),
        isCompleted,
      });

      console.log(
        `[CurriculumUpdater] Updated ${course.id}: ${lectures.length} lectures, completed=${isCompleted}`
      );

      return {
        courseId: course.id,
        courseName: course.name,
        success: true,
        isCompleted,
        lectureCount: lectures.length,
        previousLectureCount,
      };
    } catch (error) {
      console.error(`[CurriculumUpdater] Error updating ${course.id}:`, error);
      return {
        courseId: course.id,
        courseName: course.name,
        success: false,
        isCompleted: false,
        lectureCount: previousLectureCount,
        previousLectureCount,
        error: String(error),
      };
    }
  }

  /**
   * 배치 업데이트 - 모든 미완강 강좌 대상
   */
  async batchUpdate(options?: {
    limit?: number;
    onProgress?: (current: number, total: number, result: UpdateResult) => void;
  }): Promise<BatchUpdateResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 미완강 강좌 목록 가져오기
    let courses = getIncompleteCourses();

    if (options?.limit) {
      courses = courses.slice(0, options.limit);
    }

    console.log(`[CurriculumUpdater] Starting batch update for ${courses.length} courses`);

    const results: UpdateResult[] = [];
    let updated = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];

      // 딜레이 적용 (첫 번째 제외)
      if (i > 0) {
        await this.delay(this.delayMs);
      }

      const result = await this.updateCourseFromUrl(course);
      results.push(result);

      if (result.success) {
        if (result.error === 'Already completed, skipped') {
          skipped++;
        } else {
          updated++;
          if (result.isCompleted) {
            completed++;
          }
        }
      } else {
        failed++;
      }

      // 진행 콜백
      if (options?.onProgress) {
        options.onProgress(i + 1, courses.length, result);
      }
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    console.log(
      `[CurriculumUpdater] Batch update complete: ${updated} updated, ${completed} newly completed, ${failed} failed, ${skipped} skipped`
    );

    return {
      total: courses.length,
      updated,
      completed,
      failed,
      skipped,
      results,
      startedAt,
      finishedAt,
      durationMs,
    };
  }

  /**
   * 특정 강사의 강좌만 업데이트
   */
  async updateByTeacher(teacherName: string): Promise<BatchUpdateResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const allCourses = getIncompleteCourses();
    const courses = allCourses.filter(
      (c) => c.teacher.includes(teacherName)
    );

    console.log(
      `[CurriculumUpdater] Updating ${courses.length} courses for teacher: ${teacherName}`
    );

    const results: UpdateResult[] = [];
    let updated = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < courses.length; i++) {
      if (i > 0) await this.delay(this.delayMs);

      const result = await this.updateCourseFromUrl(courses[i]);
      results.push(result);

      if (result.success && !result.error?.includes('skipped')) {
        updated++;
        if (result.isCompleted) completed++;
      } else if (!result.success) {
        failed++;
      } else {
        skipped++;
      }
    }

    return {
      total: courses.length,
      updated,
      completed,
      failed,
      skipped,
      results,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 커리큘럼 문자열 배열을 Lecture 객체로 변환
   */
  private parseCurriculumToLectures(curriculum: string[]): Lecture[] {
    return curriculum.map((item, index) => {
      // "1. 강의제목 (12:34)" 형식 파싱
      const match = item.match(/^(\d+)\.\s*(.+?)(?:\s*\((\d+:\d+(?::\d+)?)\))?$/);

      if (match) {
        return {
          num: parseInt(match[1], 10),
          title: match[2].trim(),
          duration: match[3] || '',
        };
      }

      // 파싱 실패 시 기본값
      return {
        num: index + 1,
        title: item.trim(),
        duration: '',
      };
    });
  }

  /**
   * 총 강의 시간 계산
   */
  private calculateTotalDuration(lectures: Lecture[]): string {
    let totalMinutes = 0;

    for (const lecture of lectures) {
      if (!lecture.duration) continue;

      const parts = lecture.duration.split(':').map(Number);
      if (parts.length === 2) {
        // MM:SS
        totalMinutes += parts[0] + parts[1] / 60;
      } else if (parts.length === 3) {
        // HH:MM:SS
        totalMinutes += parts[0] * 60 + parts[1] + parts[2] / 60;
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  }

  /**
   * 딜레이 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
let updaterInstance: CurriculumUpdater | null = null;

export function getCurriculumUpdater(): CurriculumUpdater {
  if (!updaterInstance) {
    updaterInstance = new CurriculumUpdater();
  }
  return updaterInstance;
}
