// QuestManager - 퀘스트 생성 및 관리
// Python curriculum-agent/handlers/quest_manager.py의 TypeScript 변환

import { v4 as uuidv4 } from 'uuid';
import {
  Quest,
  QuestSchedule,
  QuestStatus,
  QuestType,
  QuestPriority,
  CourseContent,
  QuestItem,
  GenerateQuestsParams,
  StudyTips,
  ChapterData,
} from './types.js';

// 퀘스트 유형별 기본 소요 시간 (분)
const DEFAULT_MINUTES: Record<QuestType, number> = {
  [QuestType.LECTURE]: 45,
  [QuestType.PROBLEM_SET]: 60,
  [QuestType.REVIEW]: 30,
  [QuestType.PRACTICE]: 0,
  [QuestType.MOCK_EXAM]: 90,
  [QuestType.CONCEPT]: 20,
};

// 학습 전략 상수
const BUFFER_RATIO = 0.80; // 80% 법칙
const MAX_LECTURE_RATIO_SINGLE = 0.60; // 단일 강좌: 최대 60%
const MAX_LECTURE_RATIO_MULTI = 0.45; // 복수 강좌: 최대 45%
const MIN_SELF_STUDY_RATIO = 0.30; // 자습 시간 최소 30%

// OT 강의 판별 키워드
const OT_KEYWORDS = ['OT', '오리엔테이션', 'orientation', '오티', '소개', '커리큘럼 소개', '강좌 소개'];

// 중요도 키워드
const HIGH_IMPORTANCE_KEYWORDS = ['킬러', '고난도', '필수', '핵심', '기출', '자주 출제', '3점', '4점', '합격', '만점', '비킬러', '준킬러'];
const CONCEPT_KEYWORDS = ['개념', '정의', '공식', '원리', '기초', '기본'];
const APPLICATION_KEYWORDS = ['적용', '응용', '심화', '실전', '문제풀이', '유형'];

// 과목별 복습 비율
const REVIEW_RATIOS: Record<string, number> = {
  '수학': 0.35,
  '영어': 0.30,
  '탐구': 0.30,
  '사회탐구': 0.30,
  '과학탐구': 0.30,
  '국어': 0.25,
  '한국사': 0.25,
};

export class QuestManager {
  private quests: Map<string, Quest> = new Map();
  private schedules: Map<string, QuestSchedule> = new Map();

  /**
   * 강의 시간 문자열을 분으로 변환
   */
  private parseDurationToMinutes(durationStr?: string): number {
    if (!durationStr) return 45;

    try {
      const parts = durationStr.trim().split(':');
      if (parts.length === 2) {
        // MM:SS 형식
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        const totalMinutes = minutes + (seconds >= 30 ? 1 : 0);
        return Math.max(5, Math.min(180, totalMinutes));
      } else if (parts.length === 3) {
        // H:MM:SS 형식
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        const totalMinutes = hours * 60 + minutes + (seconds >= 30 ? 1 : 0);
        return Math.max(5, Math.min(180, totalMinutes));
      }
    } catch {
      // 파싱 오류 시 기본값
    }
    return 45;
  }

  /**
   * 일일 인강 시간 제한 계산
   */
  private calculateDailyLectureLimit(totalDailyMinutes: number, numCourses: number): number {
    const maxRatio = numCourses <= 1 ? MAX_LECTURE_RATIO_SINGLE : MAX_LECTURE_RATIO_MULTI;
    const maxLectureMinutes = Math.floor(totalDailyMinutes * maxRatio);
    const minSelfStudy = Math.floor(totalDailyMinutes * MIN_SELF_STUDY_RATIO);
    const maxAllowed = totalDailyMinutes - minSelfStudy;
    return Math.min(maxLectureMinutes, maxAllowed);
  }

  /**
   * 복습 시간 계산
   */
  private calculateReviewDuration(lectureMinutes: number, subject: string): number {
    const ratio = REVIEW_RATIOS[subject] || 0.25;
    let reviewMinutes = lectureMinutes * ratio;
    // 5분 단위로 반올림
    reviewMinutes = Math.round(reviewMinutes / 5) * 5;
    // 최소 10분, 최대 45분
    return Math.max(10, Math.min(45, Math.floor(reviewMinutes)));
  }

  /**
   * OT 강의 여부 판별
   */
  private isOtLecture(title: string): boolean {
    const titleLower = title.toLowerCase();
    return OT_KEYWORDS.some(kw => titleLower.includes(kw.toLowerCase()));
  }

  /**
   * 학습 팁 생성
   */
  private generateStudyTips(
    chapterTitle: string,
    sectionTitle?: string,
    subject = '',
    chapterIndex = 1,
    totalChapters = 1,
    isReview = false
  ): StudyTips {
    const title = sectionTitle || chapterTitle;
    const titleLower = title.toLowerCase();

    // 중요도 판별
    let importance = '일반';
    if (HIGH_IMPORTANCE_KEYWORDS.some(kw => titleLower.includes(kw))) {
      importance = '중요도 높음';
    } else if (chapterIndex <= 3) {
      importance = '기초 개념';
    } else if (chapterIndex >= totalChapters - 2) {
      importance = '마무리 단원';
    }

    // 핵심 포인트 생성
    let keyPoints: string[] = [];
    if (CONCEPT_KEYWORDS.some(kw => titleLower.includes(kw))) {
      keyPoints = ['개념 정확히 이해하기', '공식/원리 암기보다 이해 중심'];
    } else if (APPLICATION_KEYWORDS.some(kw => titleLower.includes(kw))) {
      keyPoints = ['다양한 유형의 문제에 적용 연습', '오답 노트 정리 필수'];
    } else {
      keyPoints = [`${subject} - ${title}`];
    }

    // 학습 방법 추천
    let studyMethod = '인강 시청';
    if (isReview) {
      studyMethod = '복습';
      keyPoints = ['오늘 배운 내용 정리', '이해 안 되는 부분 체크', '핵심 개념 3가지 요약'];
    } else if (titleLower.includes('문제') || titleLower.includes('풀이')) {
      studyMethod = '문제 풀이';
      keyPoints.push('시간 재면서 풀기');
    } else {
      keyPoints.push('필기하면서 시청');
    }

    // 자주 하는 실수
    let commonMistakes: string | undefined;
    if (subject === '수학') {
      commonMistakes = '계산 실수 주의, 조건 빠뜨리지 않기';
    } else if (subject === '영어') {
      commonMistakes = '문맥 파악 후 선택지 검토, 시간 배분 주의';
    } else if (subject === '국어') {
      commonMistakes = '지문 꼼꼼히 읽기, 선택지 함정 주의';
    }

    return {
      importance,
      keyPoints: keyPoints.slice(0, 3),
      studyMethod,
      commonMistakes,
    };
  }

  /**
   * 강좌에서 퀘스트 항목 추출
   */
  private extractQuestItems(
    course: CourseContent,
    includeOt: boolean,
    reviewEnabled: boolean
  ): QuestItem[] {
    const items: QuestItem[] = [];
    const courseId = course.id;
    const courseName = course.courseName || course.title || '';
    const lecturer = course.lecturer || course.lecturerName || '';
    const subject = course.subject || '';
    const chapters = course.chapters || course.tableOfContents || [];
    const startFromChapter = course.startFromChapter;

    // 목차가 없는 경우
    if (!chapters || chapters.length === 0) {
      const chapterName = (course as any).category || courseName;
      if (this.isOtLecture(chapterName) && !includeOt) {
        return items;
      }

      items.push({
        courseId,
        courseName,
        lecturer,
        subject,
        chapter: chapterName,
        chapterIndex: 1,
        questType: QuestType.LECTURE,
        estimatedMinutes: DEFAULT_MINUTES[QuestType.LECTURE],
        isOt: this.isOtLecture(chapterName),
      });

      if (reviewEnabled && !this.isOtLecture(chapterName)) {
        items.push({
          courseId,
          courseName,
          lecturer,
          subject,
          chapter: chapterName,
          chapterIndex: 1,
          section: '복습',
          questType: QuestType.REVIEW,
          estimatedMinutes: this.calculateReviewDuration(DEFAULT_MINUTES[QuestType.LECTURE], subject),
          isOt: false,
          isReviewOfIndex: items.length - 1,
        });
      }
      return items;
    }

    const totalChapters = chapters.length;

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      // 이어듣기: 시작 챕터 이전은 건너뜀
      if (startFromChapter !== undefined && chIdx < startFromChapter) {
        continue;
      }

      const chapter = chapters[chIdx];

      // 문자열인 경우
      if (typeof chapter === 'string') {
        let durationMinutes = DEFAULT_MINUTES[QuestType.LECTURE];
        // 문자열에서 duration 추출 시도
        const match = chapter.match(/\((\d+:\d+(?::\d+)?)\)/);
        if (match) {
          durationMinutes = this.parseDurationToMinutes(match[1]);
        }

        if (this.isOtLecture(chapter) && !includeOt) {
          continue;
        }

        items.push({
          courseId,
          courseName,
          lecturer,
          subject,
          chapter,
          chapterIndex: chIdx + 1,
          questType: QuestType.LECTURE,
          estimatedMinutes: durationMinutes,
          isOt: this.isOtLecture(chapter),
          totalChapters,
        });

        if (reviewEnabled && !this.isOtLecture(chapter)) {
          items.push({
            courseId,
            courseName,
            lecturer,
            subject,
            chapter,
            chapterIndex: chIdx + 1,
            section: '복습',
            questType: QuestType.REVIEW,
            estimatedMinutes: this.calculateReviewDuration(durationMinutes, subject),
            isOt: false,
            isReviewOfIndex: items.length - 1,
            totalChapters,
          });
        }
      } else if (typeof chapter === 'object') {
        const chapterObj = chapter as ChapterData;

        // DB에서 온 강의 데이터: {num, title, duration} 형식
        if ('num' in chapterObj && 'duration' in chapterObj) {
          const chapterTitle = chapterObj.title || `강의 ${chIdx + 1}`;
          const durationMinutes = this.parseDurationToMinutes(chapterObj.duration);

          if (this.isOtLecture(chapterTitle) && !includeOt) {
            continue;
          }

          items.push({
            courseId,
            courseName,
            lecturer,
            subject,
            chapter: chapterTitle,
            chapterIndex: chIdx + 1,
            questType: QuestType.LECTURE,
            estimatedMinutes: durationMinutes,
            isOt: this.isOtLecture(chapterTitle),
            totalChapters,
            originalDuration: chapterObj.duration,
          });

          if (reviewEnabled && !this.isOtLecture(chapterTitle)) {
            items.push({
              courseId,
              courseName,
              lecturer,
              subject,
              chapter: chapterTitle,
              chapterIndex: chIdx + 1,
              section: '복습',
              questType: QuestType.REVIEW,
              estimatedMinutes: this.calculateReviewDuration(durationMinutes, subject),
              isOt: false,
              isReviewOfIndex: items.length - 1,
              totalChapters,
            });
          }
        } else {
          // 기존 구조화된 챕터 (sections 포함)
          const chapterTitle = chapterObj.title || chapterObj.name || `Chapter ${chIdx + 1}`;
          const sections = chapterObj.sections || chapterObj.lectures || [];

          if (this.isOtLecture(chapterTitle) && !includeOt) {
            continue;
          }

          if (sections.length > 0) {
            for (let secIdx = 0; secIdx < sections.length; secIdx++) {
              const section = sections[secIdx];
              const secTitle = typeof section === 'string' ? section : (section.title || '');
              const duration = typeof section === 'object' ? (section.duration || DEFAULT_MINUTES[QuestType.LECTURE]) : DEFAULT_MINUTES[QuestType.LECTURE];

              if (this.isOtLecture(secTitle) && !includeOt) {
                continue;
              }

              items.push({
                courseId,
                courseName,
                lecturer,
                subject,
                chapter: chapterTitle,
                chapterIndex: chIdx + 1,
                section: secTitle,
                sectionIndex: secIdx + 1,
                questType: QuestType.LECTURE,
                estimatedMinutes: duration,
                isOt: this.isOtLecture(secTitle),
              });

              if (reviewEnabled && !this.isOtLecture(secTitle)) {
                items.push({
                  courseId,
                  courseName,
                  lecturer,
                  subject,
                  chapter: chapterTitle,
                  chapterIndex: chIdx + 1,
                  section: `${secTitle} - 복습`,
                  questType: QuestType.REVIEW,
                  estimatedMinutes: this.calculateReviewDuration(duration, subject),
                  isOt: false,
                  isReviewOfIndex: items.length - 1,
                });
              }
            }
          } else {
            items.push({
              courseId,
              courseName,
              lecturer,
              subject,
              chapter: chapterTitle,
              chapterIndex: chIdx + 1,
              questType: QuestType.LECTURE,
              estimatedMinutes: DEFAULT_MINUTES[QuestType.LECTURE],
              isOt: this.isOtLecture(chapterTitle),
            });

            if (reviewEnabled && !this.isOtLecture(chapterTitle)) {
              items.push({
                courseId,
                courseName,
                lecturer,
                subject,
                chapter: chapterTitle,
                chapterIndex: chIdx + 1,
                section: '복습',
                questType: QuestType.REVIEW,
                estimatedMinutes: this.calculateReviewDuration(DEFAULT_MINUTES[QuestType.LECTURE], subject),
                isOt: false,
                isReviewOfIndex: items.length - 1,
              });
            }
          }
        }
      }
    }

    return items;
  }

  /**
   * 과목별 그룹화
   */
  private groupBySubject(items: QuestItem[]): Record<string, QuestItem[]> {
    const grouped: Record<string, QuestItem[]> = {};
    for (const item of items) {
      const subject = item.subject || '기타';
      if (!grouped[subject]) {
        grouped[subject] = [];
      }
      grouped[subject].push(item);
    }
    return grouped;
  }

  /**
   * Quest 객체 생성
   */
  private createQuest(
    item: QuestItem,
    scheduledDate: Date,
    courseInfo?: CourseContent
  ): Quest {
    const questType = item.questType;
    const chapter = item.chapter;
    const section = item.section;
    const isReview = questType === QuestType.REVIEW;

    // 제목 생성
    const title = section
      ? `[${item.subject}] ${chapter} - ${section}`
      : `[${item.subject}] ${chapter}`;

    // 설명 생성
    let description = '';
    if (questType === QuestType.LECTURE) {
      description = `${item.lecturer || ''} 선생님의 ${item.courseName} 강의를 시청하세요.`;
    } else if (questType === QuestType.REVIEW) {
      description = `지금까지 배운 ${chapter} 내용을 복습하세요.`;
    } else if (questType === QuestType.PRACTICE) {
      description = `오늘 학습한 내용 관련 문제를 풀어보세요.`;
    } else if (questType === QuestType.MOCK_EXAM) {
      description = '실전 모의고사를 풀고 시간 관리 연습을 하세요.';
    } else if (questType === QuestType.CONCEPT) {
      description = `${chapter} 핵심 개념을 정리하세요.`;
    } else {
      description = '학습을 진행하세요.';
    }

    // 우선순위 결정
    let priority = QuestPriority.MEDIUM;
    if (questType === QuestType.MOCK_EXAM) {
      priority = QuestPriority.HIGH;
    } else if (questType === QuestType.REVIEW) {
      priority = QuestPriority.MEDIUM;
    } else if (item.chapterIndex === 1) {
      priority = QuestPriority.HIGH;
    }

    // 학습 팁 생성
    const studyTips = this.generateStudyTips(
      chapter,
      section,
      item.subject,
      item.chapterIndex,
      item.totalChapters || 1,
      isReview
    );

    return {
      id: uuidv4(),
      title,
      description,
      questType,
      subject: item.subject,
      courseId: item.courseId,
      chapter,
      section,
      scheduledDate: this.formatDate(scheduledDate),
      estimatedMinutes: item.estimatedMinutes || DEFAULT_MINUTES[questType] || 45,
      status: QuestStatus.PENDING,
      priority,
      lecturer: item.lecturer,
      lectureUrl: courseInfo?.url,
      dependencies: [],
      metadata: {
        courseName: item.courseName,
        chapterIndex: item.chapterIndex,
        sectionIndex: item.sectionIndex,
        originalDuration: item.originalDuration,
        studyTips,
      },
    };
  }

  /**
   * 문제풀이 퀘스트 생성
   */
  private createPracticeQuest(
    subject: string,
    scheduledDate: Date,
    durationMinutes: number,
    relatedLectures: string[] = []
  ): Quest {
    let description: string;
    if (relatedLectures.length > 0) {
      const lectureNames = relatedLectures.slice(0, 3).join(', ');
      const extra = relatedLectures.length > 3 ? ` 외 ${relatedLectures.length - 3}개` : '';
      description = `오늘 학습한 ${lectureNames}${extra} 관련 문제 풀이`;
    } else {
      description = `${subject} 관련 문제 풀이 시간`;
    }

    return {
      id: uuidv4(),
      title: `[${subject}] 문제풀이`,
      description,
      questType: QuestType.PRACTICE,
      subject,
      chapter: '문제풀이',
      scheduledDate: this.formatDate(scheduledDate),
      estimatedMinutes: 0, // 자습/문제풀이는 예상 시간 없음 (타이머로만 사용)
      status: QuestStatus.PENDING,
      priority: QuestPriority.MEDIUM,
      dependencies: [],
      metadata: {
        editable: true,
        relatedLectures,
        practiceType: 'daily',
        practiceNote: '',
        isPractice: true,
      },
    };
  }

  /**
   * 날짜 포맷팅 (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 날짜 파싱
   */
  private parseDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  /**
   * 과목별 일일 학습 시간 계산
   */
  private calculateSubjectDailyMinutes(
    dailyTotalMinutes: number,
    subjectRatio: Record<string, number>,
    applyBuffer: boolean
  ): Record<string, number> {
    const effectiveMinutes = applyBuffer
      ? Math.floor(dailyTotalMinutes * BUFFER_RATIO)
      : dailyTotalMinutes;
    const totalRatio = Object.values(subjectRatio).reduce((sum, r) => sum + r, 0);

    const result: Record<string, number> = {};
    for (const [subject, ratio] of Object.entries(subjectRatio)) {
      result[subject] = Math.floor(effectiveMinutes * ratio / totalRatio);
    }
    return result;
  }

  /**
   * 퀘스트 생성
   */
  generateQuestsFromCurriculum(params: GenerateQuestsParams): Quest[] {
    const {
      courseContents,
      targetDate,
      dailyStudyHours = 10,
      subjectRatio = { '수학': 30, '영어': 25, '국어': 25, '탐구': 15, '한국사': 5 },
      subjectHours,
      includeOt = false,
      reviewSettings = { enabled: true, sameDayReview: true, reviewDuration: 15 },
      customSchedule = [],
      learningStrategies = { applyBuffer: true, fiveDayCycle: false },
      dailyExistingUsage = {},
    } = params;

    const quests: Quest[] = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = this.parseDate(targetDate);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
      throw new Error('목표일은 오늘 이후여야 합니다.');
    }

    // 일일 총 학습 시간 (분)
    const dailyTotalMinutes = dailyStudyHours * 60;

    // 과목별 일일 가용 시간 계산
    let subjectDailyMinutes: Record<string, number>;
    if (subjectHours && Object.values(subjectHours).some(v => v !== null && v !== undefined && v > 0)) {
      subjectDailyMinutes = {};
      for (const [subject, hours] of Object.entries(subjectHours)) {
        if (hours !== null && hours !== undefined && hours > 0) {
          let mins = Math.floor(hours * 60);
          if (learningStrategies.applyBuffer) {
            mins = Math.floor(mins * BUFFER_RATIO);
          }
          subjectDailyMinutes[subject] = mins;
        } else {
          subjectDailyMinutes[subject] = 0;
        }
      }
    } else {
      subjectDailyMinutes = this.calculateSubjectDailyMinutes(
        dailyTotalMinutes,
        subjectRatio,
        learningStrategies.applyBuffer
      );
    }

    // 강좌 목차에서 퀘스트 항목 추출
    const allQuestItems: QuestItem[] = [];
    for (const course of courseContents) {
      const items = this.extractQuestItems(course, includeOt, reviewSettings.enabled);
      allQuestItems.push(...items);
    }

    // 과목별 그룹화
    const subjectItems = this.groupBySubject(allQuestItems);

    // 과목별 퀘스트 큐 분리 (강의와 복습)
    const subjectLectureQueues: Record<string, QuestItem[]> = {};
    const subjectReviewQueues: Record<string, QuestItem[]> = {};

    for (const [subject, items] of Object.entries(subjectItems)) {
      const lectures = items.filter(item => item.questType !== QuestType.REVIEW);
      lectures.sort((a, b) => {
        if (a.courseId !== b.courseId) return a.courseId.localeCompare(b.courseId);
        return a.chapterIndex - b.chapterIndex;
      });
      subjectLectureQueues[subject] = lectures;
      subjectReviewQueues[subject] = items.filter(item => item.questType === QuestType.REVIEW);
    }

    // 일별 가용 시간 계산 (기존 플랜 시간 차감)
    const dailyAvailableMinutes: Record<number, number> = {};
    const totalDailyMinutesSum = Object.values(subjectDailyMinutes).reduce((sum, m) => sum + m, 0);
    for (let day = 0; day < totalDays; day++) {
      const dateStr = this.formatDate(new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000));
      const existingUsage = dailyExistingUsage[dateStr] || 0;
      dailyAvailableMinutes[day] = Math.max(0, totalDailyMinutesSum - existingUsage);
    }

    // 강좌 수
    const numCourses = courseContents.length || 1;

    // 일별 인강 시간 제한 계산
    const dailyLectureLimits: Record<number, number> = {};
    for (let day = 0; day < totalDays; day++) {
      const available = dailyAvailableMinutes[day] || totalDailyMinutesSum;
      dailyLectureLimits[day] = this.calculateDailyLectureLimit(available, numCourses);
    }

    // 과목별 일일 강의 수 계산
    const subjectLecturesPerDay: Record<string, number> = {};
    for (const [subject, dailyMins] of Object.entries(subjectDailyMinutes)) {
      if (dailyMins > 0) {
        let avgLectureTime = 45;
        const lectureQueue = subjectLectureQueues[subject];
        if (lectureQueue && lectureQueue.length > 0) {
          const totalTime = lectureQueue.reduce((sum, l) => sum + (l.estimatedMinutes || 45), 0);
          avgLectureTime = totalTime / lectureQueue.length;
        }
        subjectLecturesPerDay[subject] = Math.max(1, Math.floor(dailyMins / avgLectureTime));
      } else {
        subjectLecturesPerDay[subject] = 0;
      }
    }

    // 배치 추적
    const placedLectures: Array<{ quest: Quest; dayIndex: number; subject: string; originalItem: QuestItem }> = [];
    const subjectNextLecture: Record<string, number> = {};
    for (const subject of Object.keys(subjectLectureQueues)) {
      subjectNextLecture[subject] = 0;
    }

    // 일별 인강 시간 추적
    const dailyLectureMinutes: Record<number, number> = {};
    const dailyTotalQuestMinutes: Record<number, number> = {};
    for (let day = 0; day < totalDays; day++) {
      dailyLectureMinutes[day] = 0;
      dailyTotalQuestMinutes[day] = 0;
    }

    // 커스텀 스케줄 패턴 파싱
    const customPatterns = this.parseCustomSchedule(customSchedule, totalDays);

    // 순차적 배분
    for (let day = 0; day < totalDays; day++) {
      const scheduledDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const availableToday = dailyAvailableMinutes[day] || totalDailyMinutesSum;

      if (availableToday <= 0) continue;

      for (const subject of Object.keys(subjectDailyMinutes)) {
        const lecturesToday = subjectLecturesPerDay[subject] || 0;
        const queue = subjectLectureQueues[subject] || [];
        let nextIdx = subjectNextLecture[subject] || 0;

        // 커스텀 패턴 확인
        if (customPatterns[subject] && !customPatterns[subject].days.has(day)) {
          continue;
        }

        let placedCount = 0;
        const dailyLimit = dailyLectureLimits[day] || totalDailyMinutesSum;

        while (placedCount < lecturesToday && nextIdx < queue.length) {
          const item = queue[nextIdx];
          const lectureDuration = item.estimatedMinutes || 45;

          // 가용 시간 체크
          if (dailyTotalQuestMinutes[day] + lectureDuration > availableToday) {
            break;
          }

          // 인강 시간 제한 체크
          if (dailyLectureMinutes[day] + lectureDuration > dailyLimit) {
            break;
          }

          const courseInfo = courseContents.find(c => c.id === item.courseId);
          const quest = this.createQuest(item, scheduledDate, courseInfo);
          quests.push(quest);
          placedLectures.push({ quest, dayIndex: day, subject, originalItem: item });

          dailyLectureMinutes[day] += lectureDuration;
          dailyTotalQuestMinutes[day] += lectureDuration;

          nextIdx++;
          placedCount++;
        }

        subjectNextLecture[subject] = nextIdx;
      }
    }

    // 남은 강의 순차 배치
    for (const subject of Object.keys(subjectDailyMinutes)) {
      const queue = subjectLectureQueues[subject] || [];
      let nextIdx = subjectNextLecture[subject] || 0;
      const remainingLectures = queue.slice(nextIdx);

      if (remainingLectures.length > 0) {
        let currentDay = 0;
        for (const item of remainingLectures) {
          const lectureDuration = item.estimatedMinutes || 45;

          // 배치 가능한 날 찾기
          let dayToPlace: number | null = null;
          for (let searchDay = currentDay; searchDay < totalDays; searchDay++) {
            const availableToday = dailyAvailableMinutes[searchDay] || totalDailyMinutesSum;
            const dailyLimit = dailyLectureLimits[searchDay] || totalDailyMinutesSum;

            if (dailyTotalQuestMinutes[searchDay] + lectureDuration > availableToday) {
              continue;
            }

            if (dailyLectureMinutes[searchDay] + lectureDuration <= dailyLimit) {
              dayToPlace = searchDay;
              break;
            }
          }

          // 배치 가능한 날이 없으면 마지막 날에 강제 배치
          if (dayToPlace === null) {
            dayToPlace = totalDays - 1;
          }

          const scheduledDate = new Date(startDate.getTime() + dayToPlace * 24 * 60 * 60 * 1000);
          const courseInfo = courseContents.find(c => c.id === item.courseId);
          const quest = this.createQuest(item, scheduledDate, courseInfo);
          quests.push(quest);
          placedLectures.push({ quest, dayIndex: dayToPlace, subject, originalItem: item });

          dailyLectureMinutes[dayToPlace] += lectureDuration;
          dailyTotalQuestMinutes[dayToPlace] += lectureDuration;
          currentDay = dayToPlace;
        }
      }
    }

    // 복습 퀘스트 배치
    for (const { quest: lectureQuest, dayIndex, subject, originalItem } of placedLectures) {
      const reviewQueue = subjectReviewQueues[subject] || [];
      const reviewItem = reviewQueue.find(
        r => r.chapter === originalItem.chapter && r.section?.includes('복습')
      );

      if (reviewItem) {
        // 큐에서 제거
        const idx = reviewQueue.indexOf(reviewItem);
        if (idx > -1) reviewQueue.splice(idx, 1);

        const reviewDay = reviewSettings.sameDayReview
          ? dayIndex
          : Math.min(dayIndex + 1, totalDays - 1);

        const reviewDate = new Date(startDate.getTime() + reviewDay * 24 * 60 * 60 * 1000);
        const courseInfo = courseContents.find(c => c.id === reviewItem.courseId);
        const reviewQuest = this.createQuest(reviewItem, reviewDate, courseInfo);
        quests.push(reviewQuest);
      }
    }

    // 문제풀이 퀘스트 생성
    const practiceQuests = this.generatePracticeQuests(
      quests,
      subjectDailyMinutes,
      totalDays,
      startDate
    );
    quests.push(...practiceQuests);

    // 퀘스트 저장 및 스케줄 생성
    for (const quest of quests) {
      this.quests.set(quest.id, quest);
    }

    this.buildSchedules(quests, dailyTotalMinutes);

    return quests;
  }

  /**
   * 커스텀 스케줄 규칙 파싱
   */
  private parseCustomSchedule(
    customSchedule: Array<{ subject: string; type: string; hoursPerSession: number }>,
    totalDays: number
  ): Record<string, { days: Set<number>; minutesPerSession: number }> {
    const patterns: Record<string, { days: Set<number>; minutesPerSession: number }> = {};

    for (const rule of customSchedule) {
      const subject = rule.subject;
      const scheduleType = rule.type || 'daily';
      const hoursPerSession = rule.hoursPerSession || 2;

      let allowedDays: Set<number>;
      if (scheduleType === 'daily') {
        allowedDays = new Set(Array.from({ length: totalDays }, (_, i) => i));
      } else if (scheduleType === 'alternate') {
        allowedDays = new Set(Array.from({ length: Math.ceil(totalDays / 2) }, (_, i) => i * 2));
      } else if (scheduleType === 'weekly') {
        allowedDays = new Set(Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => i * 7));
      } else {
        allowedDays = new Set(Array.from({ length: totalDays }, (_, i) => i));
      }

      patterns[subject] = {
        days: allowedDays,
        minutesPerSession: hoursPerSession * 60,
      };
    }

    return patterns;
  }

  /**
   * 문제풀이 퀘스트 생성
   */
  private generatePracticeQuests(
    quests: Quest[],
    subjectDailyMinutes: Record<string, number>,
    totalDays: number,
    startDate: Date
  ): Quest[] {
    const practiceQuests: Quest[] = [];

    // 일별, 과목별 시간 분석
    const dailyAnalysis: Record<string, Record<string, { lecture: number; review: number; total: number }>> = {};
    const dailyLectures: Record<string, Record<string, string[]>> = {};

    for (const quest of quests) {
      const date = quest.scheduledDate;
      const subject = quest.subject;

      if (!dailyAnalysis[date]) {
        dailyAnalysis[date] = {};
        dailyLectures[date] = {};
      }

      if (!dailyAnalysis[date][subject]) {
        dailyAnalysis[date][subject] = { lecture: 0, review: 0, total: 0 };
        dailyLectures[date][subject] = [];
      }

      if (quest.questType === QuestType.LECTURE) {
        dailyAnalysis[date][subject].lecture += quest.estimatedMinutes;
        dailyLectures[date][subject].push(quest.chapter);
      } else if (quest.questType === QuestType.REVIEW) {
        dailyAnalysis[date][subject].review += quest.estimatedMinutes;
      }

      dailyAnalysis[date][subject].total += quest.estimatedMinutes;
    }

    // 각 날짜별, 과목별로 자습 시간 계산
    for (let day = 0; day < totalDays; day++) {
      const scheduledDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dateStr = this.formatDate(scheduledDate);

      for (const [subject, dailyAllocation] of Object.entries(subjectDailyMinutes)) {
        if (dailyAllocation <= 0) continue;

        const analysis = dailyAnalysis[dateStr]?.[subject] || { lecture: 0, review: 0, total: 0 };
        const lectureMinutes = analysis.lecture;
        const reviewMinutes = analysis.review;
        const usedMinutes = analysis.total;

        // 50:50 비율 적용
        let requiredSelfStudy = lectureMinutes - reviewMinutes;
        let remainingInAllocation = dailyAllocation - usedMinutes;
        let selfStudyMinutes = Math.max(requiredSelfStudy, 0);

        if (remainingInAllocation > selfStudyMinutes) {
          selfStudyMinutes = remainingInAllocation;
        }

        // 최소 10분 이상인 경우에만 자습 퀘스트 생성
        if (selfStudyMinutes >= 10) {
          const relatedLectures = dailyLectures[dateStr]?.[subject] || [];
          const practiceQuest = this.createPracticeQuest(
            subject,
            scheduledDate,
            selfStudyMinutes,
            relatedLectures
          );
          practiceQuests.push(practiceQuest);
        }
      }
    }

    return practiceQuests;
  }

  /**
   * 스케줄 구축
   */
  private buildSchedules(quests: Quest[], dailyMinutes: number): void {
    const dateQuests: Record<string, Quest[]> = {};

    for (const quest of quests) {
      const date = quest.scheduledDate;
      if (!dateQuests[date]) {
        dateQuests[date] = [];
      }
      dateQuests[date].push(quest);
    }

    for (const [date, dayQuests] of Object.entries(dateQuests)) {
      const totalMinutes = dayQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
      const utilization = dailyMinutes > 0 ? totalMinutes / dailyMinutes : 0;

      this.schedules.set(date, {
        date,
        quests: dayQuests,
        totalMinutes,
        availableMinutes: dailyMinutes,
        utilizationRate: Math.round(utilization * 100) / 100,
        isOverloaded: totalMinutes > dailyMinutes,
      });
    }
  }

  /**
   * 특정 날짜의 퀘스트 조회
   */
  getQuestsByDate(date: string): Quest[] {
    const schedule = this.schedules.get(date);
    return schedule?.quests || [];
  }

  /**
   * 미완료 퀘스트 조회
   */
  getPendingQuests(): Quest[] {
    return Array.from(this.quests.values()).filter(q => q.status === QuestStatus.PENDING);
  }

  /**
   * 기한 초과 퀘스트 조회
   */
  getOverdueQuests(): Quest[] {
    const today = this.formatDate(new Date());
    return Array.from(this.quests.values()).filter(
      q => q.scheduledDate < today && q.status === QuestStatus.PENDING
    );
  }

  /**
   * 퀘스트 완료 처리
   */
  completeQuest(questId: string, actualMinutes?: number): Quest {
    const quest = this.quests.get(questId);
    if (!quest) {
      throw new Error(`Quest not found: ${questId}`);
    }

    quest.status = QuestStatus.COMPLETED;
    quest.completedAt = new Date().toISOString();
    quest.actualMinutes = actualMinutes || quest.estimatedMinutes;

    return quest;
  }

  /**
   * 퀘스트 건너뛰기
   */
  skipQuest(questId: string): Quest {
    const quest = this.quests.get(questId);
    if (!quest) {
      throw new Error(`Quest not found: ${questId}`);
    }

    quest.status = QuestStatus.SKIPPED;
    return quest;
  }

  /**
   * 완료 통계 조회
   */
  getCompletionStats(): Record<string, any> {
    const allQuests = Array.from(this.quests.values());
    const total = allQuests.length;
    const completed = allQuests.filter(q => q.status === QuestStatus.COMPLETED).length;
    const pending = allQuests.filter(q => q.status === QuestStatus.PENDING).length;
    const skipped = allQuests.filter(q => q.status === QuestStatus.SKIPPED).length;
    const overdue = this.getOverdueQuests().length;

    return {
      total,
      completed,
      pending,
      skipped,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
      onTrack: overdue === 0,
    };
  }

  /**
   * 스케줄 내보내기
   */
  exportSchedule(): Record<string, any> {
    const schedulesObj: Record<string, any> = {};
    for (const [date, schedule] of this.schedules.entries()) {
      schedulesObj[date] = {
        ...schedule,
        quests: schedule.quests.map(q => ({ ...q })),
      };
    }

    return {
      schedules: schedulesObj,
      stats: this.getCompletionStats(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 내부 상태 접근자
   */
  getQuests(): Map<string, Quest> {
    return this.quests;
  }

  getSchedules(): Map<string, QuestSchedule> {
    return this.schedules;
  }
}
