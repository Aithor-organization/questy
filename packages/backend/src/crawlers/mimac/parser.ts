/**
 * Mimac (대성마이맥) HTML 파싱 로직
 * Cheerio를 사용한 DOM 파싱
 */

import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import type { MimacCourseDetail, MimacCurriculumItem } from './models.js';
import { detectCompletion } from './models.js';

export class MimacParser {
  /**
   * 강좌 상세 페이지 파싱
   */
  static parseCourseDetail(html: string, courseId: string): MimacCourseDetail | null {
    const $ = cheerio.load(html);

    try {
      // 강좌 제목 파싱 - lctrv2_l_title 클래스 사용
      let title = '';
      title = $('.lctrv2_l_title').first().text().trim();

      // 대체 셀렉터
      if (!title) {
        title = (
          $('.lctrv2_detail_tab .tit_area h2').text().trim() ||
          $('.tit_area h2').text().trim() ||
          $('.lctr_info .lctr_name').text().trim() ||
          $('title').text().split('|')[0]?.trim() ||
          ''
        );
      }

      // 선생님 이름 파싱 - 선생님 홈 링크에서 추출
      let lecturerName = '';

      // 방법 1: eachTcherMain 링크에서 추출
      $('a[href*="eachTcherMain"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.endsWith('선생님') && !text.includes('마이맥')) {
          // "유대종선생님" → "유대종"
          lecturerName = text.replace(/\s*선생님\s*$/, '').trim();
          // "국어 유대종" → "유대종"
          const parts = lecturerName.split(' ');
          if (parts.length > 1) {
            lecturerName = parts[parts.length - 1];
          }
          return false; // break
        }
      });

      // 방법 2: 대체 셀렉터
      if (!lecturerName) {
        lecturerName = (
          $('.lctrv2_detail_tab .tcher_name').text().trim() ||
          $('.tcher_info .name').text().trim() ||
          $('.teacher_name').text().trim() ||
          ''
        );
        lecturerName = lecturerName.replace(/\s*선생님\s*$/, '');
      }

      // 가격 파싱
      let price: number | undefined;
      const priceCheckbox = $('.pidChkbox');
      if (priceCheckbox.length > 0) {
        const salePrice = priceCheckbox.attr('saleprice');
        if (salePrice) {
          price = parseInt(salePrice.replace(/[^0-9]/g, ''));
        }
      }
      if (!price) {
        const priceText = (
          $('.price_area .sale_price').text() ||
          $('.price .num').text() ||
          ''
        );
        const match = priceText.replace(/[^0-9]/g, '');
        if (match) {
          price = parseInt(match);
        }
      }

      // 강의 수 파싱
      let totalLectures: number | undefined;
      const totLctrCnt = $('[data-tot-lctr-cnt]').attr('data-tot-lctr-cnt');
      if (totLctrCnt) {
        totalLectures = parseInt(totLctrCnt);
      }
      if (!totalLectures) {
        const lctrCountText = (
          $('.lctr_count').text() ||
          $('.info_area .count').text() ||
          ''
        );
        const match = lctrCountText.match(/(\d+)/);
        if (match) {
          totalLectures = parseInt(match[1]);
        }
      }

      // 썸네일 URL 파싱
      const thumbnailUrl = (
        $('.lctrv2_preview img').attr('src') ||
        $('.thumb_area img').attr('src') ||
        ''
      );

      // 설명 파싱
      const description = (
        $('.lctr_desc').text().trim() ||
        $('.info_text').text().trim() ||
        ''
      );

      if (!title) {
        logger.warn(`No title found for course ${courseId}`);
        return null;
      }

      return {
        id: courseId,
        title,
        lecturerId: '',
        lecturerName,
        price,
        description: description || undefined,
        thumbnailUrl: thumbnailUrl ? this.normalizeUrl(thumbnailUrl) : undefined,
        totalLectures,
        curriculum: undefined, // 커리큘럼은 별도 API로 가져옴
        isCompleted: undefined, // 커리큘럼 로드 후 설정
      };
    } catch (error) {
      logger.error(`Failed to parse course detail for ${courseId}:`, error);
      return null;
    }
  }

  /**
   * 커리큘럼 API 응답 파싱
   */
  static parseCurriculumResponse(data: unknown): string[] {
    const curriculum: string[] = [];

    try {
      // API 응답 구조: { code: "success", data: { crclmList: [...] } }
      const response = data as {
        code?: string;
        data?: { crclmList?: MimacCurriculumItem[] };
        crclmList?: MimacCurriculumItem[];
      };

      // 새로운 구조: data.crclmList
      let crclmList = response.data?.crclmList;

      // 이전 구조 호환: 직접 crclmList
      if (!crclmList) {
        crclmList = response.crclmList;
      }

      if (!Array.isArray(crclmList)) {
        logger.warn('crclmList is not an array');
        return curriculum;
      }

      for (const item of crclmList) {
        if (item.mvptName) {
          // HTML 태그 제거 (예: <font color=red><b>[Part 01]</font></b> → [Part 01])
          const cleanName = this.stripHtmlTags(item.mvptName);
          // 시간 정보가 있으면 포함
          const duration = item.lctrTime ? this.formatDuration(item.lctrTime) : '';
          const formattedLecture = duration
            ? `${item.crclmNo}. ${cleanName} (${duration})`
            : `${item.crclmNo}. ${cleanName}`;
          curriculum.push(formattedLecture);
        }
      }

      logger.debug(`Parsed ${curriculum.length} curriculum items from API`);
    } catch (error) {
      logger.error('Failed to parse curriculum response:', error);
    }

    return curriculum;
  }

  /**
   * 강의 시간 포맷팅 (분 → 시:분)
   */
  private static formatDuration(lctrTime: string): string {
    const minutes = parseInt(lctrTime);
    if (isNaN(minutes)) return lctrTime;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
    }
    return `${minutes}분`;
  }

  /**
   * HTML 태그 제거
   * 예: <font color=red><b>[Part 01]</font></b> → [Part 01]
   */
  private static stripHtmlTags(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')  // HTML 태그 제거
      .replace(/&nbsp;/g, ' ')  // &nbsp; → 공백
      .replace(/&amp;/g, '&')   // &amp; → &
      .replace(/&lt;/g, '<')    // &lt; → <
      .replace(/&gt;/g, '>')    // &gt; → >
      .replace(/\s+/g, ' ')     // 연속 공백 → 단일 공백
      .trim();
  }

  // URL 정규화
  private static normalizeUrl(url: string, baseUrl: string = 'https://www.mimacstudy.com'): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }
    return `${baseUrl}/${url}`;
  }

  /**
   * HTML에서 pid (product ID) 추출
   */
  static extractPidFromHtml(html: string): string | null {
    const $ = cheerio.load(html);

    // data-pid 속성에서 추출
    const pidAttr = $('[data-pid]').attr('data-pid');
    if (pidAttr) return pidAttr;

    // checkbox에서 추출
    const pidCheckbox = $('.pidChkbox').attr('pid');
    if (pidCheckbox) return pidCheckbox;

    // URL 파라미터에서 추출 (script 내부)
    const scriptMatch = html.match(/pid['":\s]+['"]?(PL\d+)['"]?/);
    if (scriptMatch) return scriptMatch[1];

    return null;
  }
}
