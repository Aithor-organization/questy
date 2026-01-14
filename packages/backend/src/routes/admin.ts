/**
 * Admin Routes
 * 강좌 및 강사 관리 API
 */

import { Hono } from 'hono';
import {
  getAllCourses,
  getCoursesByTeacher,
  getCourse,
  upsertCourse,
  updateCourseCurriculum,
  updateTeacherInfo,
  updateCourseMetadata,
} from '../db/index.js';
import { getMegastudyCrawler, getMimacCrawler } from '../crawlers/index.js';

/**
 * URL에서 플랫폼 감지
 */
function detectPlatformFromUrl(url: string): 'megastudy' | 'mimac' {
  if (url.includes('mimacstudy.com')) {
    return 'mimac';
  }
  return 'megastudy';
}

/**
 * URL에 맞는 크롤러 가져오기
 */
function getCrawlerForUrl(url: string) {
  const platform = detectPlatformFromUrl(url);
  if (platform === 'mimac') {
    return getMimacCrawler();
  }
  return getMegastudyCrawler();
}

export const adminRoutes = new Hono();

/**
 * 커리큘럼 문자열을 JSON 객체로 파싱
 * 크롤러 출력: "1. 제목 (30분)" 또는 "1. 미적분 (I) (30분)"
 * → { num: "1", title: "제목", duration: "30분" }
 */
function parseCurriculumItem(item: string, idx: number): { num: string; title: string; duration: string } {
  // 마지막 괄호만 시간으로 인식 (제목에 괄호가 있어도 처리 가능)
  // 예: "1. 미적분 (I) (30분)" → num=1, title="미적분 (I)", duration="30분"
  const lastParenMatch = item.match(/^(\d+)\.\s*(.+)\s+\(([^)]+)\)$/);
  if (lastParenMatch) {
    return {
      num: lastParenMatch[1],
      title: lastParenMatch[2].trim(),
      duration: lastParenMatch[3],
    };
  }

  // 괄호 없는 경우: "1. 제목"
  const noParenMatch = item.match(/^(\d+)\.\s*(.+)$/);
  if (noParenMatch) {
    return {
      num: noParenMatch[1],
      title: noParenMatch[2].trim(),
      duration: '',
    };
  }

  // 매칭 실패 시 폴백
  return { num: String(idx + 1), title: item, duration: '' };
}

// 1. 강사 목록 조회 (distinct)
adminRoutes.get('/teachers', async (c) => {
  try {
    const courses = getAllCourses();

    // 강사별로 그룹화
    const teacherMap = new Map<string, {
      name: string;
      platform: string;
      subjects: Set<string>;
      courseCount: number;
    }>();

    for (const course of courses) {
      const key = course.teacher;
      if (!teacherMap.has(key)) {
        teacherMap.set(key, {
          name: course.teacher,
          platform: course.platform || 'megastudy',
          subjects: new Set(),
          courseCount: 0,
        });
      }
      const teacher = teacherMap.get(key)!;
      teacher.courseCount++;
      if (course.subject) {
        teacher.subjects.add(course.subject);
      }
    }

    // 배열로 변환
    const teachers = Array.from(teacherMap.values()).map((t) => ({
      name: t.name,
      platform: t.platform,
      subjects: Array.from(t.subjects),
      courseCount: t.courseCount,
    }));

    // 강좌 수 기준 정렬
    teachers.sort((a, b) => b.courseCount - a.courseCount);

    console.log(`[admin] Found ${teachers.length} teachers`);

    return c.json({
      success: true,
      data: { teachers },
    });
  } catch (error: any) {
    console.error('[admin] teachers error:', error);
    return c.json({
      success: false,
      error: error.message || '강사 목록 조회 실패',
    }, 500);
  }
});

// 2. 강사 추가
adminRoutes.post('/teachers', async (c) => {
  try {
    const body = await c.req.json();
    const { name, platform, subject } = body;

    if (!name) {
      return c.json({
        success: false,
        error: '강사명은 필수입니다',
      }, 400);
    }

    // 강사는 강좌를 통해 암묵적으로 추가됨
    // 여기서는 빈 placeholder 강좌 생성 (나중에 실제 강좌 추가 시 업데이트)
    const teacherId = `teacher-${name}-${Date.now()}`;

    console.log(`[admin] Teacher registered: ${name} (${platform})`);

    return c.json({
      success: true,
      data: {
        teacher: {
          name,
          platform: platform || 'megastudy',
          subject: subject || null,
        },
      },
    });
  } catch (error: any) {
    console.error('[admin] add teacher error:', error);
    return c.json({
      success: false,
      error: error.message || '강사 추가 실패',
    }, 500);
  }
});

// 2.5 강사 정보 수정 (해당 강사의 모든 강좌 업데이트)
adminRoutes.put('/teachers/:name', async (c) => {
  try {
    const oldName = decodeURIComponent(c.req.param('name'));
    const body = await c.req.json();
    const { name, subject, platform } = body;

    console.log(`[admin] Updating teacher: ${oldName} -> ${name || oldName}`);

    // 해당 강사의 모든 강좌 업데이트
    const updatedCourses = updateTeacherInfo(oldName, {
      name,
      subject,
      platform,
    });

    console.log(`[admin] Teacher updated: ${updatedCourses.length} courses affected`);

    return c.json({
      success: true,
      data: {
        teacher: {
          name: name || oldName,
          platform: platform || updatedCourses[0]?.platform || 'megastudy',
          subjects: [...new Set(updatedCourses.map(c => c.subject).filter(Boolean))],
          courseCount: updatedCourses.length,
        },
        coursesUpdated: updatedCourses.length,
      },
    });
  } catch (error: any) {
    console.error('[admin] update teacher error:', error);
    return c.json({
      success: false,
      error: error.message || '강사 수정 실패',
    }, 500);
  }
});

// 3. 강사별 강좌 목록
adminRoutes.get('/courses/:teacher', async (c) => {
  try {
    const teacher = decodeURIComponent(c.req.param('teacher'));

    console.log(`[admin] Fetching courses for teacher: ${teacher}`);

    const courses = getCoursesByTeacher(teacher);

    // 응답 형식 변환
    const normalizedCourses = courses.map((course) => {
      let chapters: any[] = [];
      try {
        if (course.lectures) {
          chapters = JSON.parse(course.lectures);
        }
      } catch {}

      return {
        id: course.id,
        name: course.name,
        teacher: course.teacher,
        subject: course.subject,
        platform: course.platform,
        url: course.url,
        lectureCount: course.lectureCount || chapters.length,
        totalDuration: course.totalDuration,
        isCompleted: course.isCompleted || false,
        lastCrawledAt: course.lastCrawledAt,
        chapters,
      };
    });

    console.log(`[admin] Found ${normalizedCourses.length} courses for ${teacher}`);

    return c.json({
      success: true,
      data: { courses: normalizedCourses },
    });
  } catch (error: any) {
    console.error('[admin] courses by teacher error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 목록 조회 실패',
    }, 500);
  }
});

// 4. 강좌 추가 (URL 크롤링)
adminRoutes.post('/courses', async (c) => {
  try {
    const body = await c.req.json();
    const { url, teacher, subject } = body;

    if (!url) {
      return c.json({
        success: false,
        error: 'URL은 필수입니다',
      }, 400);
    }

    console.log(`[admin] Adding course from URL: ${url}`);

    // URL에서 플랫폼 감지 및 크롤러 선택
    const platform = detectPlatformFromUrl(url);
    const crawler = getCrawlerForUrl(url);
    console.log(`[admin] Detected platform: ${platform}`);

    const result = await crawler.getCurriculumFromUrl(url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '강좌 정보를 가져올 수 없습니다',
      }, 400);
    }

    // 목차를 JSON으로 변환 (개선된 파싱 함수 사용)
    const lecturesJson = JSON.stringify(
      result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || []
    );

    const courseId = result.courseId || `course-${Date.now()}`;

    // 기존 강좌 확인 - 있으면 목차만 업데이트, 없으면 새로 생성
    const existingCourse = getCourse(courseId);

    let course;
    if (existingCourse) {
      // 기존 강좌가 있으면 목차(lectures)만 업데이트하고 이름/선생님은 유지
      console.log(`[admin] Course ${courseId} exists, updating lectures only (preserving name: ${existingCourse.name}, teacher: ${existingCourse.teacher})`);
      course = updateCourseCurriculum(courseId, {
        lectures: lecturesJson,
        lectureCount: result.curriculum?.length || 0,
        isCompleted: result.isCompleted || false,
      });
    } else {
      // 새 강좌 생성
      course = upsertCourse({
        id: courseId,
        name: result.title || '제목 없음',
        teacher: teacher || result.lecturer || '미지정',
        subject: subject || null,
        platform,
        url,
        lectures: lecturesJson,
        lectureCount: result.curriculum?.length || 0,
        isCompleted: result.isCompleted || false,
      });
    }

    console.log(`[admin] Course ${existingCourse ? 'updated' : 'added'}: ${course?.name} (${course?.lectureCount} lectures)`);

    // 응답 형식 변환 (GET 엔드포인트와 동일하게 chapters 포함)
    let chapters: any[] = [];
    try {
      if (course?.lectures) {
        chapters = JSON.parse(course.lectures);
      }
    } catch {}

    const normalizedCourse = {
      id: course?.id,
      name: course?.name,
      teacher: course?.teacher,
      subject: course?.subject,
      platform: course?.platform,
      url: course?.url,
      lectureCount: course?.lectureCount || chapters.length,
      totalDuration: course?.totalDuration,
      isCompleted: course?.isCompleted || false,
      lastCrawledAt: course?.lastCrawledAt,
      chapters,
    };

    return c.json({
      success: true,
      data: { course: normalizedCourse, isUpdate: !!existingCourse },
    });
  } catch (error: any) {
    console.error('[admin] add course error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 추가 실패',
    }, 500);
  }
});

// 5. 강좌 업데이트 (재크롤링)
adminRoutes.put('/courses/:id', async (c) => {
  try {
    const courseId = c.req.param('id');

    console.log(`[admin] Updating course: ${courseId}`);

    // 기존 강좌 조회
    const existingCourse = getCourse(courseId);
    if (!existingCourse) {
      return c.json({
        success: false,
        error: '강좌를 찾을 수 없습니다',
      }, 404);
    }

    // URL이 없으면 업데이트 불가
    if (!existingCourse.url) {
      return c.json({
        success: false,
        error: '강좌 URL이 없어 업데이트할 수 없습니다',
      }, 400);
    }

    // 이전 강의 수 저장
    const prevLectureCount = existingCourse.lectureCount || 0;

    // 크롤러로 최신 정보 가져오기 (URL에서 플랫폼 감지)
    const crawler = getCrawlerForUrl(existingCourse.url);
    const result = await crawler.getCurriculumFromUrl(existingCourse.url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '강좌 정보를 가져올 수 없습니다',
      }, 400);
    }

    // 목차를 JSON으로 변환 (개선된 파싱 함수 사용)
    const lecturesJson = JSON.stringify(
      result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || []
    );

    // DB 업데이트 (크롤러가 반환한 isCompleted 사용 - 중복 감지 제거)
    const updatedCourse = updateCourseCurriculum(courseId, {
      lectures: lecturesJson,
      lectureCount: result.curriculum?.length || 0,
      isCompleted: result.isCompleted || false,
    });

    const newLectureCount = result.curriculum?.length || 0;
    const diff = newLectureCount - prevLectureCount;

    console.log(`[admin] Course updated: ${updatedCourse?.name} (${prevLectureCount} → ${newLectureCount}, diff: ${diff > 0 ? '+' : ''}${diff})`);

    // 응답 형식 변환 (GET 엔드포인트와 동일하게 chapters 포함)
    let chapters: any[] = [];
    try {
      if (updatedCourse?.lectures) {
        chapters = JSON.parse(updatedCourse.lectures);
      }
    } catch {}

    const normalizedCourse = {
      id: updatedCourse?.id,
      name: updatedCourse?.name,
      teacher: updatedCourse?.teacher,
      subject: updatedCourse?.subject,
      platform: updatedCourse?.platform,
      url: updatedCourse?.url,
      lectureCount: updatedCourse?.lectureCount || chapters.length,
      totalDuration: updatedCourse?.totalDuration,
      isCompleted: updatedCourse?.isCompleted || false,
      lastCrawledAt: updatedCourse?.lastCrawledAt,
      chapters,
    };

    return c.json({
      success: true,
      data: {
        course: normalizedCourse,
        changes: {
          prevLectureCount,
          newLectureCount,
          diff,
          isCompleted: result.isCompleted || false,
        },
      },
    });
  } catch (error: any) {
    console.error('[admin] update course error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 업데이트 실패',
    }, 500);
  }
});

// 5.5 강좌 메타데이터 수정 (크롤링 없이)
adminRoutes.patch('/courses/:id', async (c) => {
  try {
    const courseId = c.req.param('id');
    const body = await c.req.json();
    const { name, teacher, subject, platform, isCompleted } = body;

    console.log(`[admin] Editing course metadata: ${courseId}`);

    // 기존 강좌 확인
    const existingCourse = getCourse(courseId);
    if (!existingCourse) {
      return c.json({
        success: false,
        error: '강좌를 찾을 수 없습니다',
      }, 404);
    }

    // 메타데이터 업데이트
    const updatedCourse = updateCourseMetadata(courseId, {
      name,
      teacher,
      subject,
      platform,
      isCompleted,
    });

    console.log(`[admin] Course metadata updated: ${updatedCourse?.name}`);

    // 응답 형식 변환
    let chapters: any[] = [];
    try {
      if (updatedCourse?.lectures) {
        chapters = JSON.parse(updatedCourse.lectures);
      }
    } catch {}

    const normalizedCourse = {
      id: updatedCourse?.id,
      name: updatedCourse?.name,
      teacher: updatedCourse?.teacher,
      subject: updatedCourse?.subject,
      platform: updatedCourse?.platform,
      url: updatedCourse?.url,
      lectureCount: updatedCourse?.lectureCount || chapters.length,
      totalDuration: updatedCourse?.totalDuration,
      isCompleted: updatedCourse?.isCompleted || false,
      lastCrawledAt: updatedCourse?.lastCrawledAt,
      chapters,
    };

    return c.json({
      success: true,
      data: { course: normalizedCourse },
    });
  } catch (error: any) {
    console.error('[admin] edit course error:', error);
    return c.json({
      success: false,
      error: error.message || '강좌 수정 실패',
    }, 500);
  }
});

// 6. 전체 강좌 배치 업데이트 (SSE로 진행률 전송)
adminRoutes.post('/courses/batch-update', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const skipCompleted = body.skipCompleted !== false; // 기본값: true (완강 스킵)
  const onlyOutdated = body.onlyOutdated || false; // 7일 이상 업데이트 안 된 강좌만
  const maxCourses = body.maxCourses || 50; // 최대 처리 개수 (기본 50개, 안전장치)
  const batchSize = body.batchSize || 5; // 동시 처리 개수
  const delayBetweenBatches = body.delay || 2000; // 배치 간 딜레이 (ms)

  console.log(`[admin] Starting batch update (skipCompleted: ${skipCompleted}, onlyOutdated: ${onlyOutdated}, maxCourses: ${maxCourses}, batchSize: ${batchSize})`);

  // 모든 강좌 조회
  let allCourses = getAllCourses().filter(course => course.url);

  // 완강 스킵 옵션 적용
  if (skipCompleted) {
    allCourses = allCourses.filter(course => !course.isCompleted);
  }

  // 7일 이상 업데이트 안 된 강좌만 필터링
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  if (onlyOutdated) {
    allCourses = allCourses.filter(course => {
      if (!course.lastCrawledAt) return true; // 한 번도 업데이트 안 된 경우
      const lastUpdate = new Date(course.lastCrawledAt).getTime();
      return lastUpdate < sevenDaysAgo;
    });
  }

  // 최대 개수 제한 적용
  const coursesToUpdate = allCourses.slice(0, maxCourses);

  const total = coursesToUpdate.length;
  const skipped = allCourses.length - coursesToUpdate.length;

  console.log(`[admin] Batch update: ${total} courses to update, ${skipped} skipped (completed)`);

  // SSE 스트림 생성
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 초기 상태 전송
      sendEvent({
        type: 'start',
        total,
        skipped,
        skipCompleted,
      });
      let completed = 0;
      let failed = 0;
      let updated = 0;
      const results: any[] = [];

      // 배치 처리
      for (let i = 0; i < coursesToUpdate.length; i += batchSize) {
        const batch = coursesToUpdate.slice(i, i + batchSize);

        // 배치 내 병렬 처리
        const batchResults = await Promise.allSettled(
          batch.map(async (course) => {
            try {
              // URL에 맞는 크롤러 선택
              const crawler = getCrawlerForUrl(course.url!);
              const result = await crawler.getCurriculumFromUrl(course.url!);

              if (!result.success) {
                return { courseId: course.id, name: course.name, success: false, error: result.error };
              }

              const prevLectureCount = course.lectureCount || 0;
              const lecturesJson = JSON.stringify(
                result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || []
              );

              updateCourseCurriculum(course.id, {
                lectures: lecturesJson,
                lectureCount: result.curriculum?.length || 0,
                isCompleted: result.isCompleted || false,
              });

              const newLectureCount = result.curriculum?.length || 0;
              const diff = newLectureCount - prevLectureCount;

              return {
                courseId: course.id,
                name: course.name,
                teacher: course.teacher,
                success: true,
                diff,
                isCompleted: result.isCompleted || false,
                prevLectureCount,
                newLectureCount,
              };
            } catch (err: any) {
              return { courseId: course.id, name: course.name, success: false, error: err.message };
            }
          })
        );

        // 배치 결과 처리
        for (const settledResult of batchResults) {
          completed++;

          if (settledResult.status === 'fulfilled') {
            const result = settledResult.value;
            results.push(result);

            if (result.success) {
              updated++;
              sendEvent({
                type: 'progress',
                completed,
                total,
                current: {
                  id: result.courseId,
                  name: result.name,
                  teacher: result.teacher,
                  success: true,
                  diff: result.diff,
                  isCompleted: result.isCompleted,
                },
              });
            } else {
              failed++;
              sendEvent({
                type: 'progress',
                completed,
                total,
                current: {
                  id: result.courseId,
                  name: result.name,
                  success: false,
                  error: result.error,
                },
              });
            }
          } else {
            failed++;
            sendEvent({
              type: 'progress',
              completed,
              total,
              current: {
                success: false,
                error: settledResult.reason?.message || 'Unknown error',
              },
            });
          }
        }

        // 다음 배치 전 딜레이 (마지막 배치 제외)
        if (i + batchSize < coursesToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      // 완료 이벤트 전송
      sendEvent({
        type: 'complete',
        total,
        updated,
        failed,
        skipped,
        results,
      });

      console.log(`[admin] Batch update complete: ${updated} updated, ${failed} failed, ${skipped} skipped`);

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
