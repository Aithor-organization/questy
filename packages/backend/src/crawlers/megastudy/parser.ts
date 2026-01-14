/**
 * Megastudy HTML 파싱 로직
 * Cheerio를 사용한 DOM 파싱
 */

import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import type { MegastudyLecturer, MegastudyCourse, MegastudyCourseDetail } from './models.js';
import { calculateDiscountRate, detectCompletion } from './models.js';

export class MegastudyParser {
  /**
   * 강사 목록 페이지 파싱
   */
  static parseLecturerList(html: string): MegastudyLecturer[] {
    const $ = cheerio.load(html);
    const lecturers: MegastudyLecturer[] = [];

    try {
      $('.teacher-list .teacher-item, .teacher_list .item').each((_, element) => {
        try {
          const $item = $(element);

          const teacherCode = $item.attr('data-teacher-code')
            || $item.find('a').attr('href')?.match(/teacher_code=(\w+)/)?.[1]
            || '';

          const name = $item.find('.teacher-name, .name').text().trim();
          const subject = $item.find('.subject, .category').text().trim();
          const imageUrl = $item.find('img').attr('src') || '';
          const description = $item.find('.intro, .description').text().trim();

          if (name && teacherCode) {
            lecturers.push({
              id: teacherCode,
              name,
              subject: subject || undefined,
              subjects: subject ? [subject] : undefined,
              imageUrl: imageUrl ? this.normalizeUrl(imageUrl) : undefined,
              description: description || undefined,
              teacherCode,
            });
          }
        } catch (error) {
          logger.warn('Failed to parse lecturer item:', error);
        }
      });

      logger.debug(`Parsed ${lecturers.length} lecturers from HTML`);
    } catch (error) {
      logger.error('Failed to parse lecturer list:', error);
    }

    return lecturers;
  }

  /**
   * 강좌 목록 페이지 파싱
   */
  static parseCourseList(html: string): MegastudyCourse[] {
    const $ = cheerio.load(html);
    const courses: MegastudyCourse[] = [];

    try {
      $('.lecture-list .lecture-item, .course-list .course-item').each((_, element) => {
        try {
          const $item = $(element);

          const lectureCode = $item.attr('data-lecture-code')
            || $item.find('a').attr('href')?.match(/lecture_code=(\w+)/)?.[1]
            || '';

          const title = $item.find('.lecture-title, .title').text().trim();
          const lecturerName = $item.find('.teacher-name, .lecturer').text().trim();
          const thumbnailUrl = $item.find('img').attr('src') || '';
          const courseUrl = $item.find('a').attr('href') || '';

          const priceText = $item.find('.price, .original-price').text();
          const price = this.parsePrice(priceText);

          if (title && lectureCode) {
            courses.push({
              id: lectureCode,
              title,
              lecturerId: '',
              lecturerName,
              price,
              thumbnailUrl: thumbnailUrl ? this.normalizeUrl(thumbnailUrl) : undefined,
              courseUrl: courseUrl ? this.normalizeUrl(courseUrl) : undefined,
              lectureCode,
            });
          }
        } catch (error) {
          logger.warn('Failed to parse course item:', error);
        }
      });

      logger.debug(`Parsed ${courses.length} courses from HTML`);
    } catch (error) {
      logger.error('Failed to parse course list:', error);
    }

    return courses;
  }

  /**
   * 강좌 상세 페이지 파싱
   */
  static parseCourseDetail(html: string, courseId: string): MegastudyCourseDetail | null {
    const $ = cheerio.load(html);

    try {
      // 다양한 셀렉터 시도 (메가스터디 페이지 구조에 맞게)
      // 2024+ 메가스터디 신규 구조 우선
      const title = (
        $('.lstedu_bookinfo--tit').text().trim() ||
        $('.book_tit').text().trim() ||
        $('.lecture-detail .title').text().trim() ||
        $('.course-title').text().trim() ||
        $('.lec_title').text().trim() ||
        $('h1.tit').text().trim() ||
        $('h2.tit').text().trim() ||
        $('.chr_info h3').text().trim() ||
        $('title').text().split('|')[0]?.trim() ||
        ''
      );

      // 선생님 이름 파싱 (2024+ 구조 우선)
      // ".lstedu_bookinfo--teacher strong a" → "[국어] 김동욱 선생님" 형태
      let lecturerName = '';
      const teacherLink = $('.lstedu_bookinfo--teacher strong a').text().trim();
      if (teacherLink) {
        // "[국어] 김동욱 선생님" → "김동욱" 추출
        const match = teacherLink.match(/\[.+?\]\s*(.+?)\s*선생님/);
        lecturerName = match ? match[1] : teacherLink.replace(/\[.+?\]\s*/, '').replace(/\s*선생님/, '');
      }

      // 기존 셀렉터 폴백
      if (!lecturerName) {
        lecturerName = (
          $('.teacher-info .name').text().trim() ||
          $('.lecturer-name').text().trim() ||
          $('.teacher_name').text().trim() ||
          $('.tec_name').text().trim() ||
          ''
        );
      }

      const thumbnailUrl = (
        $('.lecture-image img').attr('src') ||
        $('.course-thumbnail img').attr('src') ||
        $('.chr_img img').attr('src') ||
        ''
      );

      const description = (
        $('.lecture-description').text().trim() ||
        $('.course-description').text().trim() ||
        $('.lec_info').text().trim() ||
        $('.chr_cont').text().trim() ||
        ''
      );

      const priceText = $('.price-info .original-price, .price, .sale_price').text();
      const price = this.parsePrice(priceText);

      // 커리큘럼 (목차) 파싱 - 다양한 셀렉터 시도
      const curriculum: string[] = [];

      // 방법 1: 강의목록 테이블에서 파싱 (megastudy 2024+ 구조)
      // #scrollTab2는 "강의목차" 섹션 - 반드시 이것만 선택해야 함
      const lectureTable = $('#scrollTab2 table.tb_char_opt');
      logger.debug(`[parseCourseDetail] Found ${lectureTable.length} lecture tables in #scrollTab2`);

      if (lectureTable.length > 0) {
        let lectureNum = 0;
        lectureTable.find('tbody tr').each((_, row) => {
          const $row = $(row);
          const titleCell = $row.find('td').first();
          const timeCell = $row.find('td.lecture-time');

          const lectureTitle = titleCell.text().trim();
          const duration = timeCell.text().trim();

          // 빈 행이나 헤더 행 스킵
          if (!lectureTitle || lectureTitle.length < 2) return;

          lectureNum++;
          const formattedLecture = duration
            ? `${lectureNum}. ${lectureTitle} (${duration})`
            : `${lectureNum}. ${lectureTitle}`;
          curriculum.push(formattedLecture);
        });
        logger.debug(`[parseCourseDetail] Parsed ${curriculum.length} lectures from #scrollTab2 table`);
      }

      // 방법 2: 기존 셀렉터 시도 (이전 구조 호환성)
      if (curriculum.length === 0) {
        const curriculumSelectors = [
          '.curriculum-list li',
          '.lesson-list li',
          '.lec_list li',
          '.unit_list li',
          '.chr_list li',
          '.list_chr_cont li',
          'table.list_table tbody tr td:nth-child(2)',
          '.lecList li',
          '.lec_cont_list li',
        ];

        for (const selector of curriculumSelectors) {
          $(selector).each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 0 && text.length < 500) {
              curriculum.push(text);
            }
          });
          if (curriculum.length > 0) break;
        }
      }

      // 학습 목표 파싱
      const objectives: string[] = [];
      $('.objectives-list li, .goals-list li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) objectives.push(text);
      });

      // 강좌 특징 파싱
      const features: string[] = [];
      $('.features-list li, .benefits-list li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) features.push(text);
      });

      if (!title) {
        logger.warn(`No title found for course ${courseId}`);
        return null;
      }

      // 완강 여부 감지 (마지막 강의 제목에 "완강" 키워드 포함 여부)
      const isCompleted = detectCompletion(curriculum);
      if (isCompleted) {
        logger.info(`[COMPLETED] Course ${courseId} detected as completed`);
      }

      return {
        id: courseId,
        title,
        lecturerId: '',
        lecturerName,
        price,
        description: description || undefined,
        thumbnailUrl: thumbnailUrl ? this.normalizeUrl(thumbnailUrl) : undefined,
        curriculum: curriculum.length > 0 ? curriculum : undefined,
        objectives: objectives.length > 0 ? objectives : undefined,
        features: features.length > 0 ? features : undefined,
        lectureCode: courseId,
        isCompleted,
      };
    } catch (error) {
      logger.error(`Failed to parse course detail for ${courseId}:`, error);
      return null;
    }
  }

  // URL 정규화
  private static normalizeUrl(url: string, baseUrl: string = 'https://www.megastudy.net'): string {
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

  // 가격 파싱
  private static parsePrice(text: string): number | undefined {
    if (!text) return undefined;
    const match = text.replace(/[^\d]/g, '');
    const price = parseInt(match);
    return !isNaN(price) && price > 0 ? price : undefined;
  }
}
