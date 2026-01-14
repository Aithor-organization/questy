/**
 * 기본 크롤러 클래스
 * 교육 플랫폼 크롤러의 베이스 클래스
 */

import { logger } from './logger.js';

// 타입 정의
export interface CrawlerConfig {
  baseUrl: string;
  requestDelay?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface CourseDetail {
  id: string;
  title: string;
  lecturerId?: string;
  lecturerName: string;
  price?: number;
  description?: string;
  thumbnailUrl?: string;
  curriculum?: string[];
  objectives?: string[];
  features?: string[];
  isCompleted?: boolean;  // 완강 여부
}

export interface Lecturer {
  id: string;
  name: string;
  subject?: string;
  imageUrl?: string;
  description?: string;
}

export interface Course {
  id: string;
  title: string;
  lecturerId: string;
  lecturerName: string;
  price?: number;
  thumbnailUrl?: string;
}

// BaseCrawler 추상 클래스
export abstract class BaseCrawler {
  protected config: Required<CrawlerConfig>;
  private lastRequestTime: number = 0;

  constructor(config: CrawlerConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      requestDelay: config.requestDelay ?? 1500,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
    };
  }

  abstract get platformName(): string;
  abstract getCourseDetail(courseId: string): Promise<CourseDetail | null>;

  protected async delay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const delay = this.config.requestDelay + Math.random() * 500;

    if (elapsed < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

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

        const html = await response.text();
        logger.debug(`✅ GET ${fullUrl} - Status: ${response.status}`);
        return html;

      } catch (error) {
        logger.warn(`⚠️ Attempt ${attempt + 1}/${this.config.maxRetries} failed for ${fullUrl}: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }

    logger.error(`❌ Failed to fetch ${fullUrl} after ${this.config.maxRetries} attempts`);
    return null;
  }
}
