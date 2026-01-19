/**
 * 이투스(Etoos) 크롤러
 * 이투스 강좌 정보 및 목차 크롤링
 */

import { BaseCrawler, CourseDetail } from '../base-crawler.js';
import { EtoosParser } from './parser.js';
import type { EtoosCourseDetail } from './models.js';
import { logger } from '../logger.js';
import iconv from 'iconv-lite';

// 이투스 URL 상수
const ETOOS_URLS = {
  BASE: 'https://www.etoos.com',
  LECTURE_DETAIL: '/lecture/LectureDetailN.asp',
} as const;

export class EtoosCrawler extends BaseCrawler {
  get platformName(): string {
    return 'etoos';
  }

  constructor() {
    super({
      baseUrl: ETOOS_URLS.BASE,
      requestDelay: 1500,
      maxRetries: 3,
      timeout: 30000,
    });

    logger.info('EtoosCrawler initialized');
  }

  /**
   * EUC-KR 인코딩 처리가 포함된 fetchHtml 오버라이드
   * 이투스는 EUC-KR 인코딩을 사용함
   */
  protected async fetchHtml(url: string): Promise<string | null> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await this.delay();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.etoos.com/',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // EUC-KR → UTF-8 변환
        const buffer = await response.arrayBuffer();
        const html = iconv.decode(Buffer.from(buffer), 'euc-kr');

        logger.debug(`✅ GET ${fullUrl} - Status: ${response.status} (EUC-KR decoded)`);
        return html;

      } catch (error) {
        logger.warn(`⚠️ Attempt ${attempt + 1}/${this.config.maxRetries} failed for ${fullUrl}: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }

    logger.error(`❌ Failed to fetch ${fullUrl} after ${this.config.maxRetries} attempts`);
    return null;
  }

  /**
   * 강좌 상세 정보 가져오기 (목차 포함)
   */
  async getCourseDetail(courseId: string): Promise<CourseDetail | null> {
    try {
      const url = `${ETOOS_URLS.LECTURE_DETAIL}?lecture_id=${courseId}`;
      const html = await this.fetchHtml(url);

      if (!html) {
        logger.warn(`No HTML received for course ${courseId}`);
        return null;
      }

      const course = EtoosParser.parseCourseDetail(html, courseId);

      if (course) {
        return {
          id: course.id,
          title: course.title,
          lecturerName: course.lecturerName,
          price: course.price,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          curriculum: course.curriculum,
          objectives: course.objectives,
          features: course.features,
          isCompleted: course.isCompleted,
        };
      }

      return null;

    } catch (error) {
      logger.error(`Failed to get course detail for ${courseId}:`, error);
      return null;
    }
  }

  /**
   * URL에서 강좌 ID 추출
   */
  static extractCourseIdFromUrl(url: string): string | null {
    const patterns = [
      /lecture_id=([^&]+)/i,           // lecture_id=L70722
      /LectureDetailN\.asp\?.*?id=([^&]+)/i,
      /\/lecture\/([A-Z]\d+)/i,
    ];

    for (const pattern of patterns) {
      const result = url.match(pattern);
      if (result) return result[1];
    }

    return null;
  }

  /**
   * URL로 강좌 목차 가져오기
   */
  async getCurriculumFromUrl(url: string): Promise<{
    success: boolean;
    courseId?: string;
    title?: string;
    lecturer?: string;
    curriculum?: string[];
    isCompleted?: boolean;
    error?: string;
  }> {
    try {
      // URL에서 courseId 추출
      const courseId = EtoosCrawler.extractCourseIdFromUrl(url);

      logger.info(`[getCurriculumFromUrl] Fetching URL: ${url}`);
      const html = await this.fetchHtml(url);
      logger.info(`[getCurriculumFromUrl] HTML received: ${html ? html.length : 0} chars`);

      if (!html) {
        return {
          success: false,
          courseId: courseId || undefined,
          error: 'Failed to fetch URL',
        };
      }

      // HTML에서 직접 파싱
      const course = EtoosParser.parseCourseDetail(html, courseId || 'unknown');

      if (course) {
        return {
          success: true,
          courseId: courseId || undefined,
          title: course.title,
          lecturer: course.lecturerName,
          curriculum: course.curriculum,
          isCompleted: course.isCompleted,
        };
      }

      return {
        success: false,
        courseId: courseId || undefined,
        error: 'Could not parse course data from URL',
      };

    } catch (error) {
      logger.error(`Failed to get curriculum from URL ${url}:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 상세 커리큘럼 정보 가져오기 (시간, INDEX 포함)
   */
  async getDetailedCurriculum(courseId: string): Promise<{
    success: boolean;
    courseId: string;
    curriculum?: ReturnType<typeof EtoosParser.extractDetailedCurriculum>;
    error?: string;
  }> {
    try {
      const url = `${ETOOS_URLS.LECTURE_DETAIL}?lecture_id=${courseId}`;
      const html = await this.fetchHtml(url);

      if (!html) {
        return {
          success: false,
          courseId,
          error: 'Failed to fetch URL',
        };
      }

      const curriculum = EtoosParser.extractDetailedCurriculum(html);

      return {
        success: true,
        courseId,
        curriculum,
      };

    } catch (error) {
      logger.error(`Failed to get detailed curriculum for ${courseId}:`, error);
      return {
        success: false,
        courseId,
        error: String(error),
      };
    }
  }
}

// 싱글톤 인스턴스
let crawlerInstance: EtoosCrawler | null = null;

export function getEtoosCrawler(): EtoosCrawler {
  if (!crawlerInstance) {
    crawlerInstance = new EtoosCrawler();
  }
  return crawlerInstance;
}
