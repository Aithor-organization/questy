/**
 * 이투스 HTML 파서
 */

import type { EtoosCourseDetail, EtoosCurriculumItem } from './models.js';
import { logger } from '../logger.js';

export class EtoosParser {
  /**
   * 강좌 상세 페이지 HTML 파싱
   */
  static parseCourseDetail(html: string, courseId: string): EtoosCourseDetail | null {
    try {
      // 강의 제목 추출
      const title = this.extractTitle(html);

      // 선생님 이름 추출
      const lecturerName = this.extractLecturerName(html);

      // 강좌 유형 추출
      const category = this.extractCategory(html);

      // 강좌 구성 정보 추출
      const { totalLectures, duration, isCompleted } = this.extractCourseInfo(html);

      // 강의 목차 추출
      const curriculum = this.extractCurriculum(html);

      // 강좌 설명 추출
      const description = this.extractDescription(html);

      // 강좌 특징 추출
      const features = this.extractFeatures(html);

      // 수강 대상 추출
      const objectives = this.extractObjectives(html);

      // 가격 추출
      const price = this.extractPrice(html);

      // 썸네일 URL 추출
      const thumbnailUrl = this.extractThumbnail(html);

      if (!title && curriculum.length === 0) {
        logger.warn(`[EtoosParser] No data found for course ${courseId}`);
        return null;
      }

      return {
        id: courseId,
        title: title || `강좌 ${courseId}`,
        lecturerName: lecturerName || '미확인',
        category,
        totalLectures,
        duration,
        isCompleted,
        curriculum,
        description,
        features,
        objectives,
        price,
        thumbnailUrl,
      };

    } catch (error) {
      logger.error(`[EtoosParser] Failed to parse course ${courseId}:`, error);
      return null;
    }
  }

  /**
   * 강의 제목 추출
   */
  private static extractTitle(html: string): string {
    // 패턴 1: <p class="title_main">...</p> (최신 페이지 구조)
    const titleMainMatch = html.match(/<p\s+class="title_main">([^<]+)<\/p>/i);
    if (titleMainMatch) {
      return titleMainMatch[1].trim();
    }

    // 패턴 2: <h2 class="tit">...</h2>
    const titleMatch = html.match(/<h2[^>]*class="tit"[^>]*>([^<]+)<\/h2>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // 패턴 3: New 20XX 패턴
    const newMatch = html.match(/>(New\s+\d{4}[^<]+)</);
    if (newMatch) {
      return newMatch[1].trim();
    }

    return '';
  }

  /**
   * 선생님 이름 추출
   */
  private static extractLecturerName(html: string): string {
    // 패턴: "수학 정승제 선생님" 또는 "OO 선생님"
    const patterns = [
      /(?:수학|국어|영어|과학|사회|한국사|제2외국어)\s+([가-힣]{2,4})\s*선생님/,
      /class="teacher[^"]*"[^>]*>([가-힣]{2,4})/,
      />([가-힣]{2,4})\s*선생님</,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '';
  }

  /**
   * 강좌 유형 추출 (수능, 내신 등)
   */
  private static extractCategory(html: string): string {
    // th가 "강좌유형"인 행의 td
    const match = html.match(/<th[^>]*>강좌유형<\/th>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (match) {
      return match[1].trim();
    }
    return '';
  }

  /**
   * 강좌 구성 정보 추출
   */
  private static extractCourseInfo(html: string): {
    totalLectures: number;
    duration: string;
    isCompleted: boolean;
  } {
    let totalLectures = 0;
    let duration = '';
    let isCompleted = false;

    // th가 "강좌구성"인 행의 td
    const match = html.match(/<th[^>]*>강좌구성<\/th>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (match) {
      const text = match[1];
      duration = text.trim();

      // 총 N강 추출
      const lectureMatch = text.match(/총\s*(\d+)강/);
      if (lectureMatch) {
        totalLectures = parseInt(lectureMatch[1], 10);
      }

      // 완강 여부
      isCompleted = text.includes('완강');
    }

    return { totalLectures, duration, isCompleted };
  }

  /**
   * 강의 목차 추출
   */
  private static extractCurriculum(html: string): string[] {
    const curriculum: string[] = [];

    // ORIENTATION 확인
    if (html.includes('>ORIENTATION<')) {
      curriculum.push('ORIENTATION');
    }

    // 패턴 1: >01강 - xxx< (일반 강좌)
    const lecturePattern1 = />(\d{2}강 - [^<]+)</g;
    let match;

    while ((match = lecturePattern1.exec(html)) !== null) {
      const title = match[1].trim();
      if (!curriculum.includes(title)) {
        curriculum.push(title);
      }
    }

    // 패턴 2: <td class="tit"><a>STEP X - NNN ~ NNN</a></td> (기출끝 등 STEP 형식)
    const lecturePattern2 = /<td\s+class="tit">\s*<a[^>]*>([^<]+)<\/a>/g;
    while ((match = lecturePattern2.exec(html)) !== null) {
      const title = match[1].trim();
      // 실제 강의 제목인지 확인 (STEP, 문제, 강 등 포함)
      if (title && !curriculum.includes(title) &&
          (title.includes('STEP') || title.includes('강') || title.match(/\d{3}/))) {
        curriculum.push(title);
      }
    }

    // 강의 번호순 정렬
    curriculum.sort((a, b) => {
      if (a === 'ORIENTATION') return -1;
      if (b === 'ORIENTATION') return 1;

      // "NN강" 형식
      const numA = parseInt(a.match(/^(\d+)강/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/^(\d+)강/)?.[1] || '0', 10);
      if (numA !== 0 || numB !== 0) {
        return numA - numB;
      }

      // "STEP N" 형식
      const stepA = a.match(/STEP\s*(\d+)/i)?.[1] || '0';
      const stepB = b.match(/STEP\s*(\d+)/i)?.[1] || '0';
      const stepNumA = parseInt(stepA, 10);
      const stepNumB = parseInt(stepB, 10);
      if (stepNumA !== stepNumB) {
        return stepNumA - stepNumB;
      }

      // STEP 내 번호 추출 (예: "001 ~ 024" → 1)
      const rangeA = a.match(/(\d{3})\s*~/)?.[1] || '0';
      const rangeB = b.match(/(\d{3})\s*~/)?.[1] || '0';
      return parseInt(rangeA, 10) - parseInt(rangeB, 10);
    });

    return curriculum;
  }

  /**
   * 상세 커리큘럼 정보 추출 (시간, INDEX 포함)
   */
  static extractDetailedCurriculum(html: string): EtoosCurriculumItem[] {
    const items: EtoosCurriculumItem[] = [];

    // ORIENTATION
    if (html.includes('>ORIENTATION<')) {
      const durationMatch = html.match(/ORIENTATION[\s\S]*?(\d+)분/);
      items.push({
        order: 0,
        title: 'ORIENTATION',
        duration: durationMatch ? `${durationMatch[1]}분` : undefined,
        isPreview: false,
      });
    }

    // 각 강의 정보 추출
    // 패턴: 강의명_ID" ... >NN강 - 제목< ... >NN분< ... INDEX(N)
    const lectureBlocks = html.split(/(?=\d{2}강-)/);

    for (const block of lectureBlocks) {
      const titleMatch = block.match(/>(\d{2}강 - [^<]+)</);
      if (!titleMatch) continue;

      const title = titleMatch[1].trim();

      // 이미 추가된 강의인지 확인
      if (items.some(item => item.title === title)) continue;

      // 시간 추출
      const durationMatch = block.match(/>(\d+)분</);
      const duration = durationMatch ? `${durationMatch[1]}분` : undefined;

      // INDEX 개수 추출
      const indexMatch = block.match(/INDEX\s*\((\d+)\)/i);
      const indexCount = indexMatch ? parseInt(indexMatch[1], 10) : undefined;

      // 맛보기 여부
      const isPreview = block.includes('맛보기');

      // 강의 번호 추출
      const orderMatch = title.match(/^(\d+)강/);
      const order = orderMatch ? parseInt(orderMatch[1], 10) : items.length;

      items.push({
        order,
        title,
        duration,
        indexCount,
        isPreview,
      });
    }

    // 순서 정렬
    items.sort((a, b) => a.order - b.order);

    return items;
  }

  /**
   * 강좌 설명 추출
   */
  private static extractDescription(html: string): string {
    const match = html.match(/<th[^>]*>강좌 범위<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (match) {
      return this.stripHtml(match[1]).trim();
    }
    return '';
  }

  /**
   * 강좌 특징 추출
   */
  private static extractFeatures(html: string): string[] {
    const features: string[] = [];
    const match = html.match(/<th[^>]*>강좌 특징<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);

    if (match) {
      const text = this.stripHtml(match[1]);
      const lines = text.split(/[▣■●•]\s*/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.length > 5) {
          features.push(trimmed);
        }
      }
    }

    return features;
  }

  /**
   * 수강 대상 추출
   */
  private static extractObjectives(html: string): string[] {
    const objectives: string[] = [];
    const match = html.match(/<th[^>]*>수강 대상<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);

    if (match) {
      const text = this.stripHtml(match[1]);
      const lines = text.split(/[▣■●•]\s*/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.length > 5) {
          objectives.push(trimmed);
        }
      }
    }

    return objectives;
  }

  /**
   * 가격 추출
   */
  private static extractPrice(html: string): number | undefined {
    // 패턴: 36,000원 또는 36000원
    const match = html.match(/(\d{1,3}(?:,\d{3})*)\s*원/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return undefined;
  }

  /**
   * 썸네일 URL 추출
   */
  private static extractThumbnail(html: string): string | undefined {
    // 강사 이미지 또는 강좌 썸네일
    const match = html.match(/src="(https?:\/\/img\.etoos\.com[^"]+)"/i);
    if (match) {
      return match[1];
    }
    return undefined;
  }

  /**
   * HTML 태그 제거
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
