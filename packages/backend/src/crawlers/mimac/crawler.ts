/**
 * Mimac (대성마이맥) 크롤러
 * 대성마이맥 강좌 정보 및 목차 크롤링
 */

import { BaseCrawler, CourseDetail } from '../base-crawler.js';
import { MimacParser } from './parser.js';
import type { MimacCourseDetail } from './models.js';
import { detectCompletion } from './models.js';
import { logger } from '../logger.js';
import iconv from 'iconv-lite';

// Mimac URL 상수
const MIMAC_URLS = {
  BASE: 'https://www.mimacstudy.com',
  LECTURE_DETAIL: '/tcher/lctr/lctrDetail.ds',
  CURRICULUM_API: '/tcher/lctr/crclmList.ds',
} as const;

export class MimacCrawler extends BaseCrawler {
  get platformName(): string {
    return 'mimac';
  }

  constructor() {
    super({
      baseUrl: MIMAC_URLS.BASE,
      requestDelay: 1500,
      maxRetries: 3,
      timeout: 30000,
    });

    logger.info('MimacCrawler initialized');
  }

  private lastRequestTime: number = 0;

  /**
   * EUC-KR 인코딩 처리가 포함된 fetchHtml 오버라이드
   * 대성마이맥도 EUC-KR 인코딩을 사용함
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

  // delay 메서드 (rate limiting)
  private async delay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delayMs = this.config.requestDelay + Math.random() * 500;

    if (elapsed < delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * JSON API 호출
   */
  private async fetchJson(url: string, body?: Record<string, string>): Promise<unknown | null> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await this.delay();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(fullUrl, {
          method: body ? 'POST' : 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': `${MIMAC_URLS.BASE}/tcher/lctr/lctrDetail.ds`,
          },
          body: body ? new URLSearchParams(body).toString() : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        logger.debug(`✅ ${body ? 'POST' : 'GET'} ${fullUrl} - Status: ${response.status}`);
        return data;

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
      const url = `${MIMAC_URLS.LECTURE_DETAIL}?pid=${courseId}`;
      const html = await this.fetchHtml(url);

      if (!html) {
        logger.warn(`No HTML received for course ${courseId}`);
        return null;
      }

      const course = MimacParser.parseCourseDetail(html, courseId);

      if (!course) {
        return null;
      }

      // 커리큘럼 API로 목차 가져오기
      const curriculum = await this.fetchCurriculum(courseId);

      // 완강 여부 감지
      const isCompleted = detectCompletion(curriculum);
      if (isCompleted) {
        logger.info(`[COMPLETED] Course ${courseId} detected as completed`);
      }

      return {
        id: course.id,
        title: course.title,
        lecturerName: course.lecturerName,
        price: course.price,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        curriculum: curriculum.length > 0 ? curriculum : undefined,
        isCompleted,
      };

    } catch (error) {
      logger.error(`Failed to get course detail for ${courseId}:`, error);
      return null;
    }
  }

  /**
   * 커리큘럼 (강의 목차) 가져오기
   */
  private async fetchCurriculum(courseId: string): Promise<string[]> {
    try {
      const data = await this.fetchJson(MIMAC_URLS.CURRICULUM_API, {
        pid: courseId,
      });

      if (!data) {
        logger.warn(`No curriculum data for course ${courseId}`);
        return [];
      }

      return MimacParser.parseCurriculumResponse(data);
    } catch (error) {
      logger.error(`Failed to fetch curriculum for ${courseId}:`, error);
      return [];
    }
  }

  /**
   * URL에서 강좌 코드 (pid) 추출
   */
  static extractCourseIdFromUrl(url: string): string | null {
    // 다양한 URL 패턴들
    const patterns = [
      /pid=([A-Z]+\d+)/,           // pid=PL00057418
      /\/(PL\d+)/,                  // /PL00057418
      /goodCode=([^&]+)/,          // goodCode 파라미터
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
      const courseId = MimacCrawler.extractCourseIdFromUrl(url);

      if (!courseId) {
        // URL에서 pid를 추출할 수 없으면 직접 크롤링
        logger.info(`[getCurriculumFromUrl] Cannot extract pid from URL, fetching directly: ${url}`);
      }

      // 페이지 HTML 가져오기
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

      // HTML에서 pid 추출 (URL에서 추출 실패한 경우)
      const extractedPid = courseId || MimacParser.extractPidFromHtml(html);

      if (!extractedPid) {
        return {
          success: false,
          error: 'Could not extract course ID from URL or HTML',
        };
      }

      // HTML 파싱
      const course = MimacParser.parseCourseDetail(html, extractedPid);

      if (!course) {
        return {
          success: false,
          courseId: extractedPid,
          error: 'Could not parse course data from HTML',
        };
      }

      // 커리큘럼 API로 목차 가져오기
      const curriculum = await this.fetchCurriculum(extractedPid);
      const isCompleted = detectCompletion(curriculum);

      return {
        success: true,
        courseId: extractedPid,
        title: course.title,
        lecturer: course.lecturerName,
        curriculum: curriculum.length > 0 ? curriculum : undefined,
        isCompleted,
      };

    } catch (error) {
      logger.error(`Failed to get curriculum from URL ${url}:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// 싱글톤 인스턴스 생성 헬퍼
let crawlerInstance: MimacCrawler | null = null;

export function getMimacCrawler(): MimacCrawler {
  if (!crawlerInstance) {
    crawlerInstance = new MimacCrawler();
  }
  return crawlerInstance;
}
