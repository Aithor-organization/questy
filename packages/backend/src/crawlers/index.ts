/**
 * 크롤러 모듈 내보내기
 */

// Megastudy
export {
  MegastudyCrawler,
  getMegastudyCrawler,
} from './megastudy/crawler.js';
export { MegastudyParser } from './megastudy/parser.js';
export type {
  MegastudyLecturer,
  MegastudyCourse,
  MegastudyCourseDetail,
} from './megastudy/models.js';
export {
  detectCompletion as megastudyDetectCompletion,
} from './megastudy/models.js';

// Mimac
export {
  MimacCrawler,
  getMimacCrawler,
} from './mimac/crawler.js';
export { MimacParser } from './mimac/parser.js';
export type {
  MimacLecturer,
  MimacCourse,
  MimacCourseDetail,
} from './mimac/models.js';
export {
  detectCompletion as mimacDetectCompletion,
} from './mimac/models.js';

// Etoos
export {
  EtoosCrawler,
  getEtoosCrawler,
} from './etoos/crawler.js';
export { EtoosParser } from './etoos/parser.js';
export type {
  EtoosLecturer,
  EtoosCourse,
  EtoosCourseDetail,
  EtoosCurriculumItem,
} from './etoos/models.js';

// Base
export * from './base-crawler.js';
export { logger } from './logger.js';
