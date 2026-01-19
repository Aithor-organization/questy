/**
 * Admin Routes
 * 크롤링 전용 API (데이터 저장은 Supabase에서 처리)
 *
 * 관리자 전용 - adminOnly 미들웨어 적용
 */

import { Hono } from 'hono';
import { getMegastudyCrawler, getMimacCrawler, getEtoosCrawler } from '../crawlers/index.js';
import { adminOnly } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

/**
 * URL에서 플랫폼 감지
 */
function detectPlatformFromUrl(url: string): 'megastudy' | 'mimac' | 'etoos' {
  if (url.includes('mimacstudy.com')) {
    return 'mimac';
  }
  if (url.includes('etoos.com')) {
    return 'etoos';
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
  if (platform === 'etoos') {
    return getEtoosCrawler();
  }
  return getMegastudyCrawler();
}

/**
 * 커리큘럼 문자열을 JSON 객체로 파싱
 */
function parseCurriculumItem(item: string, idx: number): { num: string; title: string; duration: string } {
  const lastParenMatch = item.match(/^(\d+)\.\s*(.+)\s+\(([^)]+)\)$/);
  if (lastParenMatch) {
    return {
      num: lastParenMatch[1],
      title: lastParenMatch[2].trim(),
      duration: lastParenMatch[3],
    };
  }

  const noParenMatch = item.match(/^(\d+)\.\s*(.+)$/);
  if (noParenMatch) {
    return {
      num: noParenMatch[1],
      title: noParenMatch[2].trim(),
      duration: '',
    };
  }

  return { num: String(idx + 1), title: item, duration: '' };
}

export const adminRoutes = new Hono();

/**
 * 크롤링 전용 API (관리자 전용)
 * POST /api/admin/crawl
 *
 * 프론트엔드에서 URL을 전달하면 크롤링 결과만 반환
 * 데이터 저장은 프론트엔드에서 Supabase로 직접 처리
 */
adminRoutes.post('/crawl', adminOnly, async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({
        success: false,
        error: 'URL은 필수입니다',
      }, 400);
    }

    console.log(`[admin/crawl] Crawling URL: ${url}`);

    const platform = detectPlatformFromUrl(url);
    const crawler = getCrawlerForUrl(url);

    const result = await crawler.getCurriculumFromUrl(url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '강좌 정보를 가져올 수 없습니다',
      }, 400);
    }

    // 커리큘럼 파싱
    const curriculum = result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || [];

    console.log(`[admin/crawl] Success: ${result.title} (${curriculum.length} lectures)`);

    return c.json({
      success: true,
      data: {
        courseId: result.courseId,
        title: result.title,
        lecturer: result.lecturer,
        platform,
        curriculum,
        lectureCount: curriculum.length,
        isCompleted: result.isCompleted || false,
      },
    });
  } catch (error: any) {
    console.error('[admin/crawl] Error:', error);
    return c.json({
      success: false,
      error: error.message || '크롤링 실패',
    }, 500);
  }
});

/**
 * 배치 크롤링 API (SSE) - 관리자 전용
 * POST /api/admin/crawl/batch
 *
 * 여러 URL을 순차적으로 크롤링하고 결과를 SSE로 전송
 */
/**
 * 크롤링 + 저장 통합 API (관리자 전용)
 * POST /api/admin/crawl-and-save
 *
 * 크롤링 결과를 백엔드에서 직접 Supabase에 저장
 * 데이터 무결성 보장 (P1 - 브라우저 종료 시 데이터 손실 방지)
 */
adminRoutes.post('/crawl-and-save', adminOnly, async (c) => {
  try {
    const body = await c.req.json();
    const { url, teacher, subject } = body;

    if (!url) {
      return c.json({
        success: false,
        error: 'URL은 필수입니다',
      }, 400);
    }

    if (!supabase) {
      return c.json({
        success: false,
        error: 'Supabase가 설정되지 않았습니다',
      }, 500);
    }

    console.log(`[admin/crawl-and-save] Crawling URL: ${url}`);

    const platform = detectPlatformFromUrl(url);
    const crawler = getCrawlerForUrl(url);

    const result = await crawler.getCurriculumFromUrl(url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '강좌 정보를 가져올 수 없습니다',
      }, 400);
    }

    // 커리큘럼 파싱
    const curriculum = result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || [];

    // Supabase에 저장 (upsert)
    const courseData = {
      id: result.courseId || `course-${Date.now()}`,
      name: result.title || '제목 없음',
      teacher_name: teacher || result.lecturer || '미지정',
      subject: subject || null,
      platform,
      url,
      lectures: curriculum,
      lecture_count: curriculum.length,
      is_completed: result.isCompleted || false,
      last_crawled_at: new Date().toISOString(),
    };

    const { data: savedCourse, error: upsertError } = await supabase
      .from('courses')
      .upsert(courseData, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      console.error('[admin/crawl-and-save] Supabase error:', upsertError);
      return c.json({
        success: false,
        error: upsertError.message || 'Supabase 저장 실패',
      }, 500);
    }

    console.log(`[admin/crawl-and-save] Success: ${result.title} (${curriculum.length} lectures) saved`);

    return c.json({
      success: true,
      data: {
        id: savedCourse.id,
        name: savedCourse.name,
        teacherName: savedCourse.teacher_name,
        subject: savedCourse.subject,
        platform: savedCourse.platform,
        url: savedCourse.url,
        lectures: savedCourse.lectures,
        lectureCount: savedCourse.lecture_count,
        isCompleted: savedCourse.is_completed,
        lastCrawledAt: savedCourse.last_crawled_at,
      },
    });
  } catch (error: any) {
    console.error('[admin/crawl-and-save] Error:', error);
    return c.json({
      success: false,
      error: error.message || '크롤링 및 저장 실패',
    }, 500);
  }
});

/**
 * 강좌 업데이트 (재크롤링 + 저장) API (관리자 전용)
 * POST /api/admin/crawl-and-update/:courseId
 *
 * 기존 강좌를 재크롤링하고 업데이트된 커리큘럼을 저장
 */
adminRoutes.post('/crawl-and-update/:courseId', adminOnly, async (c) => {
  try {
    const courseId = c.req.param('courseId');

    if (!supabase) {
      return c.json({
        success: false,
        error: 'Supabase가 설정되지 않았습니다',
      }, 500);
    }

    // 기존 강좌 조회
    const { data: existingCourse, error: fetchError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (fetchError || !existingCourse) {
      return c.json({
        success: false,
        error: '강좌를 찾을 수 없습니다',
      }, 404);
    }

    if (!existingCourse.url) {
      return c.json({
        success: false,
        error: '강좌 URL이 없어 업데이트할 수 없습니다',
      }, 400);
    }

    const prevLectureCount = existingCourse.lecture_count || 0;

    console.log(`[admin/crawl-and-update] Re-crawling course: ${courseId}`);

    const crawler = getCrawlerForUrl(existingCourse.url);
    const result = await crawler.getCurriculumFromUrl(existingCourse.url);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || '강좌 정보를 가져올 수 없습니다',
      }, 400);
    }

    // 커리큘럼 파싱
    const curriculum = result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || [];

    // Supabase 업데이트
    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({
        lectures: curriculum,
        lecture_count: curriculum.length,
        is_completed: result.isCompleted || false,
        last_crawled_at: new Date().toISOString(),
      })
      .eq('id', courseId)
      .select()
      .single();

    if (updateError) {
      console.error('[admin/crawl-and-update] Supabase error:', updateError);
      return c.json({
        success: false,
        error: updateError.message || 'Supabase 업데이트 실패',
      }, 500);
    }

    const newLectureCount = curriculum.length;
    console.log(`[admin/crawl-and-update] Success: ${updatedCourse.name} (${prevLectureCount} → ${newLectureCount} lectures)`);

    return c.json({
      success: true,
      data: {
        id: updatedCourse.id,
        name: updatedCourse.name,
        teacherName: updatedCourse.teacher_name,
        platform: updatedCourse.platform,
        lectureCount: newLectureCount,
        prevLectureCount,
        diff: newLectureCount - prevLectureCount,
        isCompleted: updatedCourse.is_completed,
        lastCrawledAt: updatedCourse.last_crawled_at,
      },
    });
  } catch (error: any) {
    console.error('[admin/crawl-and-update] Error:', error);
    return c.json({
      success: false,
      error: error.message || '크롤링 및 업데이트 실패',
    }, 500);
  }
});

adminRoutes.post('/crawl/batch', adminOnly, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { urls, batchSize = 5, delay = 2000 } = body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return c.json({
      success: false,
      error: 'URLs 배열이 필요합니다',
    }, 400);
  }

  console.log(`[admin/crawl/batch] Starting batch crawl for ${urls.length} URLs`);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({
        type: 'start',
        total: urls.length,
      });

      let completed = 0;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(async (url: string) => {
            try {
              const platform = detectPlatformFromUrl(url);
              const crawler = getCrawlerForUrl(url);
              const result = await crawler.getCurriculumFromUrl(url);

              if (!result.success) {
                return { url, success: false, error: result.error };
              }

              const curriculum = result.curriculum?.map((item, idx) => parseCurriculumItem(item, idx)) || [];

              return {
                url,
                success: true,
                data: {
                  courseId: result.courseId,
                  title: result.title,
                  lecturer: result.lecturer,
                  platform,
                  curriculum,
                  lectureCount: curriculum.length,
                  isCompleted: result.isCompleted || false,
                },
              };
            } catch (err: any) {
              return { url, success: false, error: err.message };
            }
          })
        );

        for (const settledResult of batchResults) {
          completed++;

          if (settledResult.status === 'fulfilled') {
            const result = settledResult.value;
            if (result.success) {
              success++;
            } else {
              failed++;
            }

            sendEvent({
              type: 'progress',
              completed,
              total: urls.length,
              current: result,
            });
          } else {
            failed++;
            sendEvent({
              type: 'progress',
              completed,
              total: urls.length,
              current: {
                success: false,
                error: settledResult.reason?.message || 'Unknown error',
              },
            });
          }
        }

        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      sendEvent({
        type: 'complete',
        total: urls.length,
        success,
        failed,
      });

      console.log(`[admin/crawl/batch] Complete: ${success} success, ${failed} failed`);

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
