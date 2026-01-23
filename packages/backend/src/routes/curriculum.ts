// Curriculum Routes
// 로컬 DB를 사용한 인강 강좌 검색 및 퀘스트 생성

import { Hono } from 'hono';
import {
  searchCourses as searchCoursesFromDB,
  getCourse,
  getIncompleteCourses,
  getAllCourses,
} from '../db/index.js';
import { getMegastudyCrawler } from '../crawlers/index.js';
import { detectCompletion } from '../crawlers/megastudy/models.js';
import { getCurriculumUpdater } from '../services/curriculum-updater.js';
import {
  createCurriculumAgentService,
  type CourseContent,
  type ExistingPlan,
} from '../services/curriculum-agent/index.js';
// LLM 기반 커리큘럼 생성을 위한 PlannerAgent import
import { PlannerAgent } from '@questy/coach-agent';

export const curriculumRoutes = new Hono();

// 1. 강좌 검색 API (Bun: SQLite, Node.js: Supabase)
curriculumRoutes.post('/search-courses', async (c) => {
  try {
    const body = await c.req.json();
    const { query, subject, lecturer, limit = 20 } = body;

    // query에 강사명이 포함된 경우 lecturer로 사용
    const effectiveLecturer = lecturer || (query && subject ? query : undefined);

    console.log(`[curriculum] Search courses: query="${query || ''}", subject="${subject || ''}", lecturer="${effectiveLecturer || ''}"`);

    // DB에서 검색 (Bun: SQLite, Node.js: Supabase 자동 선택)
    const coursesResult = searchCoursesFromDB({
      query: query || undefined,
      subject: subject || undefined,
      teacher: effectiveLecturer || undefined,
      limit
    });

    // Promise인 경우 await (Supabase 폴백)
    const courses = Array.isArray(coursesResult) ? coursesResult : await coursesResult;

    // 응답 형식 변환
    const normalizedCourses = courses.map((course) => {
      // lectures JSON 파싱
      let chapters: any[] = [];
      try {
        if (course.lectures) {
          chapters = JSON.parse(course.lectures);
        }
      } catch { }

      return {
        id: course.id,
        courseName: course.name,
        lecturer: course.teacher,
        subject: course.subject,
        chapters: chapters,
        platform: course.platform,
        category: course.category,
        lectureCount: course.lectureCount,
        totalDuration: course.totalDuration,
      };
    });

    console.log(`[curriculum] Found ${normalizedCourses.length} courses from local DB`);

    return c.json({
      success: true,
      data: {
        courses: normalizedCourses,
        count: normalizedCourses.length
      }
    });
  } catch (error: any) {
    console.error('[curriculum] search-courses error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 검색 중 오류가 발생했습니다'
    }, 500);
  }
});

// 2. 퀘스트 생성 API
curriculumRoutes.post('/generate-quests', async (c) => {
  try {
    const body = await c.req.json();
    const {
      selectedCourseIds,
      courseContents, // 프론트엔드에서 직접 전달하는 경우
      targetDate,
      dailyStudyHours,
      subjectRatio,
      // 새로운 옵션들
      subjectHours,
      subjectDays, // 과목별 요일 설정
      options,
      // 학습 전략 옵션 (PlannerAgent 전략 통합)
      learningStrategies, // 학습 전략 설정
      // 기존 플랜 정보 (가용 시간 계산용)
      existingPlans,
    } = body;

    console.log(`[curriculum] Generate quests: ${selectedCourseIds?.length || 0} courses, target=${targetDate}`);
    console.log(`[curriculum] Existing plans: ${existingPlans?.length || 0} plans`);
    console.log(`[curriculum] Options: includeOT=${options?.includeOT}, review=${options?.reviewSettings?.enabled}, customRules=${options?.customSchedule?.length || 0}`);
    console.log(`[curriculum] Learning strategies: buffer=${learningStrategies?.applyBuffer ?? true}`);
    console.log(`[curriculum] Subject days configured: ${subjectDays ? Object.keys(subjectDays).length : 0} subjects`);

    // 입력 검증
    if (!selectedCourseIds?.length && !courseContents?.length) {
      return c.json({
        success: false,
        error: '강좌를 선택해주세요'
      }, 400);
    }

    if (!targetDate) {
      return c.json({
        success: false,
        error: '목표일을 설정해주세요'
      }, 400);
    }

    // 목표일 검증 (오늘 이후)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    if (target <= today) {
      return c.json({
        success: false,
        error: '목표일은 오늘 이후여야 합니다'
      }, 400);
    }

    // TypeScript 커리큘럼 에이전트 서비스 사용
    const agentService = createCurriculumAgentService();
    const result = agentService.generateQuests({
      courseIds: selectedCourseIds || [],
      courseContents: (courseContents || []) as CourseContent[],
      targetDate,
      dailyStudyHours: dailyStudyHours || 10,
      subjectRatio: subjectRatio || {
        '국어': 20,
        '영어': 25,
        '수학': 35,
        '한국사': 5,
        '탐구1': 7.5,
        '탐구2': 7.5,
      },
      subjectHours: subjectHours || undefined,
      subjectDays: subjectDays || undefined,
      options: {
        includeOt: options?.includeOT ?? options?.include_ot ?? false,
        reviewSettings: {
          enabled: options?.reviewSettings?.enabled ?? true,
          sameDayReview: options?.reviewSettings?.same_day_review ?? options?.reviewSettings?.sameDayReview ?? true,
          reviewDuration: options?.reviewSettings?.review_duration ?? options?.reviewSettings?.reviewDuration ?? 15,
        },
        customSchedule: options?.customSchedule || options?.custom_schedule || [],
      },
      learningStrategies: {
        applyBuffer: learningStrategies?.applyBuffer ?? learningStrategies?.apply_buffer ?? true,
        fiveDayCycle: learningStrategies?.fiveDayCycle ?? learningStrategies?.five_day_cycle ?? false,
      },
      existingPlans: (existingPlans || []) as ExistingPlan[],
    });

    if (!result.success) {
      // 검증 실패 시 상세 정보 포함
      return c.json({
        success: false,
        error: result.error || '퀘스트 생성에 실패했습니다',
        validation: result.validation || null,
      }, 400);
    }

    // 검증 경고가 있는 경우에도 포함
    return c.json({
      success: true,
      data: {
        quests: result.quests || [],
        summary: result.summary || {},
        validation: result.validation || null,
      }
    });
  } catch (error: any) {
    console.error('[curriculum] generate-quests error:', error);
    return c.json({
      success: false,
      error: error.message || '퀘스트 생성 중 오류가 발생했습니다'
    }, 500);
  }
});

// 2.5. LLM 기반 퀘스트 생성 API (PlannerAgent 사용)
// Memory Lane 통합으로 개인화된 학습 스케줄 생성
curriculumRoutes.post('/generate-quests-ai', async (c) => {
  try {
    const body = await c.req.json();
    const {
      studentId,
      courseContents,
      targetDate,
      dailyStudyHours,
      subjectHours,
      subjectDays,
      options,
    } = body;

    console.log(`[curriculum-ai] Generate AI-powered quests for student: ${studentId}`);
    console.log(`[curriculum-ai] Courses: ${courseContents?.length || 0}, Target: ${targetDate}`);

    // 입력 검증
    if (!courseContents?.length) {
      return c.json({
        success: false,
        error: '강좌를 선택해주세요'
      }, 400);
    }

    if (!targetDate) {
      return c.json({
        success: false,
        error: '목표일을 설정해주세요'
      }, 400);
    }

    // 목표일 검증 (오늘 이후)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    if (target <= today) {
      return c.json({
        success: false,
        error: '목표일은 오늘 이후여야 합니다'
      }, 400);
    }

    // PlannerAgent를 사용한 LLM 기반 커리큘럼 생성
    const plannerAgent = new PlannerAgent();

    // CourseContent를 CurriculumCourse 형식으로 변환
    const courses = courseContents.map((course: any) => ({
      id: course.id,
      courseName: course.courseName || course.title || '',
      lecturer: course.lecturer || course.lecturerName || '',
      subject: course.subject || '',
      chapters: (course.chapters || course.tableOfContents || []).map((ch: any, idx: number) => ({
        num: ch.num || idx + 1,
        title: ch.title || ch.name || `강의 ${idx + 1}`,
        duration: ch.duration,
        sections: ch.sections || ch.lectures,
      })),
      startFromChapter: course.startFromChapter,
    }));

    const result = await plannerAgent.generateCurriculum({
      studentId: studentId || 'anonymous',
      courses,
      targetDate,
      dailyStudyHours: dailyStudyHours || 10,
      subjectHours: subjectHours || undefined,
      subjectDays: subjectDays || undefined,
      options: {
        includeOt: options?.includeOT ?? options?.include_ot ?? false,
        reviewSettings: {
          enabled: options?.reviewSettings?.enabled ?? true,
          sameDayReview: options?.reviewSettings?.same_day_review ?? options?.reviewSettings?.sameDayReview ?? true,
          reviewDuration: options?.reviewSettings?.review_duration ?? options?.reviewSettings?.reviewDuration ?? 15,
        },
      },
      // @ts-ignore: PlannerAgent가 existingPlans를 지원하는지 확실치 않으므로 무시
      existingPlans: body.existingPlans,
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: result.message || '퀘스트 생성에 실패했습니다',
        validation: result.validation || null,
      }, 400);
    }

    // 프론트엔드 CurriculumQuest 형식으로 변환
    const formattedQuests = result.quests.map((quest) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      questType: quest.questType,
      subject: quest.subject,
      courseId: quest.courseId,
      courseName: quest.courseName,
      lecturer: quest.lecturer || '',
      chapter: quest.chapter,
      section: quest.section,
      scheduledDate: quest.scheduledDate,
      estimatedMinutes: quest.estimatedMinutes,
      originalDuration: quest.originalDuration,
      status: quest.status,
      priority: quest.priority,
      studyTips: quest.studyTips,
      editable: quest.editable,
      practiceNote: quest.practiceNote,
      relatedLectures: quest.relatedLectures,
    }));

    console.log(`[curriculum-ai] Generated ${formattedQuests.length} quests with AI`);

    return c.json({
      success: true,
      data: {
        quests: formattedQuests,
        summary: result.summary,
        validation: result.validation || null,
      }
    });
  } catch (error: any) {
    console.error('[curriculum-ai] generate-quests-ai error:', error);
    return c.json({
      success: false,
      error: error.message || '퀘스트 생성 중 오류가 발생했습니다'
    }, 500);
  }
});

// 3. 스케줄 재조정 API
curriculumRoutes.post('/reschedule', async (c) => {
  try {
    const body = await c.req.json();
    const {
      questIds,
      targetDate,
      dailyStudyHours,
      strategy = 'smart',
      // 다른 플랜 정보 (스마트 스케줄링 - 충돌 방지)
      existingPlans,
    } = body;

    console.log(`[curriculum] Reschedule: ${questIds?.length || 0} quests, strategy=${strategy}`);
    console.log(`[curriculum] Existing plans for reschedule: ${existingPlans?.length || 0} plans`);

    // TypeScript 커리큘럼 에이전트 서비스 사용
    const agentService = createCurriculumAgentService();
    const result = agentService.rescheduleQuests({
      questIds: questIds || [],
      targetDate,
      dailyStudyHours: dailyStudyHours || 10,
      strategy,
      existingPlans: (existingPlans || []) as ExistingPlan[],
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '스케줄 재조정에 실패했습니다'
      }, 400);
    }

    return c.json({
      success: true,
      data: {
        message: result.message,
        rescheduledCount: result.rescheduledCount || 0,
        rescheduledQuests: result.rescheduledQuests || [],
        newSchedule: result.newSchedule || {}
      }
    });
  } catch (error: any) {
    console.error('[curriculum] reschedule error:', error);
    return c.json({
      success: false,
      error: error.message || '스케줄 재조정 중 오류가 발생했습니다'
    }, 500);
  }
});

// 4. URL에서 강좌 목차 가져오기 API (DB 우선 확인, 없으면 크롤링)
curriculumRoutes.post('/crawl-curriculum', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({
        success: false,
        error: 'URL이 필요합니다'
      }, 400);
    }

    console.log(`[curriculum] Fetching curriculum from URL: ${url}`);

    // URL에서 courseId 추출
    const { MegastudyCrawler } = await import('../crawlers/index.js');
    const courseId = MegastudyCrawler.extractCourseIdFromUrl(url);

    // 1. DB에서 먼저 확인
    if (courseId) {
      const courseResult = getCourse(courseId);
      const dbCourse = courseResult instanceof Promise ? await courseResult : courseResult;
      if (dbCourse) {
        console.log(`[curriculum] Found course in DB: ${dbCourse.name}`);

        // lectures JSON 파싱
        let curriculum: string[] = [];
        try {
          if (dbCourse.lectures) {
            const lecturesData = JSON.parse(dbCourse.lectures);
            curriculum = lecturesData.map((lec: any) =>
              `${lec.num}. ${lec.title} (${lec.duration})`
            );
          }
        } catch { }

        // 완강 여부 감지 (마지막 강의 제목에 "완강" 포함 여부)
        const isCompleted = detectCompletion(curriculum);

        return c.json({
          success: true,
          data: {
            courseId: dbCourse.id,
            title: dbCourse.name,
            lecturer: dbCourse.teacher,
            subject: dbCourse.subject,
            curriculum,
            lectureCount: dbCourse.lectureCount || curriculum.length,
            totalDuration: dbCourse.totalDuration,
            isCompleted,
            source: 'database'
          }
        });
      }
    }

    // 2. DB에 없으면 크롤링 시도
    console.log(`[curriculum] Course not in DB, attempting to crawl...`);

    const crawler = getMegastudyCrawler();
    const result = await crawler.getCurriculumFromUrl(url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '목차를 가져오는데 실패했습니다'
      }, 400);
    }

    console.log(`[curriculum] Successfully crawled: ${result.title} (${result.curriculum?.length || 0} lectures, completed: ${result.isCompleted})`);

    return c.json({
      success: true,
      data: {
        courseId: result.courseId,
        title: result.title,
        lecturer: result.lecturer,
        curriculum: result.curriculum,
        lectureCount: result.curriculum?.length || 0,
        isCompleted: result.isCompleted,
        source: 'crawled'
      }
    });
  } catch (error: any) {
    console.error('[curriculum] crawl-curriculum error:', error);
    return c.json({
      success: false,
      error: error.message || '목차를 가져오는 중 오류가 발생했습니다'
    }, 500);
  }
});

// 5. 강좌 코드로 상세 정보 가져오기 API
curriculumRoutes.get('/course-detail/:courseId', async (c) => {
  try {
    const courseId = c.req.param('courseId');

    console.log(`[curriculum] Fetching course detail: ${courseId}`);

    const crawler = getMegastudyCrawler();
    const detail = await crawler.getCourseDetail(courseId);

    if (!detail) {
      return c.json({
        success: false,
        error: '강좌를 찾을 수 없습니다'
      }, 404);
    }

    return c.json({
      success: true,
      data: detail
    });
  } catch (error: any) {
    console.error('[curriculum] course-detail error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 정보를 가져오는 중 오류가 발생했습니다'
    }, 500);
  }
});

// ===================== 커리큘럼 자동 업데이트 API =====================

// 6. 미완강 강좌 목록 조회 API
curriculumRoutes.get('/incomplete-courses', async (c) => {
  try {
    const coursesResult = getIncompleteCourses();
    const courses = Array.isArray(coursesResult) ? coursesResult : await coursesResult;

    return c.json({
      success: true,
      data: {
        courses: courses.map((course) => ({
          id: course.id,
          name: course.name,
          teacher: course.teacher,
          subject: course.subject,
          lectureCount: course.lectureCount || 0,
          isCompleted: course.isCompleted || false,
          lastCrawledAt: course.lastCrawledAt,
        })),
        count: courses.length,
      },
    });
  } catch (error: any) {
    console.error('[curriculum] incomplete-courses error:', error);
    return c.json({
      success: false,
      error: error.message || '미완강 강좌 조회 중 오류가 발생했습니다',
    }, 500);
  }
});

// 7. 단일 강좌 커리큘럼 업데이트 API
curriculumRoutes.post('/update-course/:courseId', async (c) => {
  try {
    const courseId = c.req.param('courseId');

    console.log(`[curriculum] Updating single course: ${courseId}`);

    const updater = getCurriculumUpdater();
    const result = await updater.updateCourse(courseId);

    return c.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error('[curriculum] update-course error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 업데이트 중 오류가 발생했습니다',
    }, 500);
  }
});

// 8. 배치 업데이트 API (모든 미완강 강좌)
curriculumRoutes.post('/batch-update', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { limit, teacherName } = body;

    console.log(`[curriculum] Starting batch update: limit=${limit}, teacher=${teacherName || 'all'}`);

    const updater = getCurriculumUpdater();

    let result;
    if (teacherName) {
      result = await updater.updateByTeacher(teacherName);
    } else {
      result = await updater.batchUpdate({ limit });
    }

    return c.json({
      success: true,
      data: {
        total: result.total,
        updated: result.updated,
        completed: result.completed,
        failed: result.failed,
        skipped: result.skipped,
        durationMs: result.durationMs,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        // 결과 요약 (전체 결과는 로그에만)
        summary: result.results.slice(0, 10).map((r) => ({
          courseId: r.courseId,
          success: r.success,
          isCompleted: r.isCompleted,
          lectureCount: r.lectureCount,
        })),
      },
    });
  } catch (error: any) {
    console.error('[curriculum] batch-update error:', error);
    return c.json({
      success: false,
      error: error.message || '배치 업데이트 중 오류가 발생했습니다',
    }, 500);
  }
});

// 9. 강좌 통계 조회 API
curriculumRoutes.get('/stats', async (c) => {
  try {
    const allCoursesResult = getAllCourses();
    const incompleteCoursesResult = getIncompleteCourses();

    const allCourses = Array.isArray(allCoursesResult) ? allCoursesResult : await allCoursesResult;
    const incompleteCourses = Array.isArray(incompleteCoursesResult) ? incompleteCoursesResult : await incompleteCoursesResult;

    const totalCourses = allCourses.length;
    const completedCourses = totalCourses - incompleteCourses.length;
    const totalLectures = allCourses.reduce(
      (sum, c) => sum + (c.lectureCount || 0),
      0
    );

    // 과목별 통계
    const subjectStats: Record<string, { total: number; completed: number }> = {};
    for (const course of allCourses) {
      const subject = course.subject || '기타';
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, completed: 0 };
      }
      subjectStats[subject].total++;
      if (course.isCompleted) {
        subjectStats[subject].completed++;
      }
    }

    return c.json({
      success: true,
      data: {
        totalCourses,
        completedCourses,
        incompleteCourses: incompleteCourses.length,
        totalLectures,
        completionRate: totalCourses > 0
          ? Math.round((completedCourses / totalCourses) * 100)
          : 0,
        bySubject: subjectStats,
      },
    });
  } catch (error: any) {
    console.error('[curriculum] stats error:', error);
    return c.json({
      success: false,
      error: error.message || '통계 조회 중 오류가 발생했습니다',
    }, 500);
  }
});
