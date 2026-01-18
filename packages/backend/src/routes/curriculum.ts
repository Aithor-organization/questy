// Curriculum Routes
// 로컬 DB를 사용한 인강 강좌 검색 및 퀘스트 생성

import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';
import {
  searchCourses as searchCoursesFromDB,
  getCourse,
  getIncompleteCourses,
  getAllCourses,
} from '../db/index.js';
import { getMegastudyCrawler } from '../crawlers/index.js';
import { detectCompletion } from '../crawlers/megastudy/models.js';
import { getCurriculumUpdater } from '../services/curriculum-updater.js';

export const curriculumRoutes = new Hono();

// Python 에이전트 호출 헬퍼
async function callPythonAgent(action: string, params: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const agentDir = path.resolve(__dirname, '../../../curriculum-agent');
    const agentScript = path.join(agentDir, 'main.py');

    console.log(`[curriculum] Calling Python agent: ${action}`);
    console.log(`[curriculum] Agent path: ${agentScript}`);

    const proc = spawn(pythonPath, [
      agentScript,
      '--action', action,
      '--params', JSON.stringify(params)
    ], {
      cwd: agentDir,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Python 경고 로그 (info level)
      if (!stderr.includes('Error') && !stderr.includes('error')) {
        console.log(`[curriculum] Python info: ${data.toString().trim()}`);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          // JSON 응답 파싱
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          console.error('[curriculum] JSON parse error:', parseError);
          resolve({ raw: stdout });
        }
      } else {
        console.error(`[curriculum] Python error (code ${code}):`, stderr);
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error('[curriculum] Spawn error:', err);
      reject(err);
    });
  });
}

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
      } catch {}

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

    const result = await callPythonAgent('generate_quests', {
      course_ids: selectedCourseIds || [],
      course_contents: courseContents || [],
      target_date: targetDate,
      daily_study_hours: dailyStudyHours || 10,  // 기본 10시간
      subject_ratio: subjectRatio || {
        '국어': 20,
        '영어': 25,
        '수학': 35,
        '한국사': 5,
        '탐구': 15
      },
      // 새로운 옵션들 전달
      subject_hours: subjectHours || null,
      options: options || {
        include_ot: false,
        review_settings: {
          enabled: true,
          same_day_review: true,
          review_duration: 15,
        },
        custom_schedule: [],
      },
      // 학습 전략 옵션 (PlannerAgent 전략 통합)
      learning_strategies: learningStrategies || {
        apply_buffer: true,     // 80% 법칙: 가용 시간의 80%만 계획
        five_day_cycle: false,  // 5일 단위 운영법
      },
      // 기존 플랜 정보 (가용 시간 계산용)
      existing_plans: existingPlans || [],
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '퀘스트 생성에 실패했습니다'
      }, 400);
    }

    return c.json({
      success: true,
      data: {
        quests: result.quests || [],
        summary: result.summary || {}
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

    const result = await callPythonAgent('reschedule_quests', {
      quest_ids: questIds || [],
      target_date: targetDate,
      daily_study_hours: dailyStudyHours || 10,  // 기본 10시간
      strategy,
      // 다른 플랜 정보 전달 (스마트 스케줄링)
      existing_plans: existingPlans || [],
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
        } catch {}

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
