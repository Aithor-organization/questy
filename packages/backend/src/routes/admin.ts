/**
 * Admin Routes
 * 크롤링 전용 API (데이터 저장은 Supabase에서 처리)
 */

import { Hono } from 'hono';
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
 * 크롤링 전용 API
 * POST /api/admin/crawl
 *
 * 프론트엔드에서 URL을 전달하면 크롤링 결과만 반환
 * 데이터 저장은 프론트엔드에서 Supabase로 직접 처리
 */
adminRoutes.post('/crawl', async (c) => {
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
 * 배치 크롤링 API (SSE)
 * POST /api/admin/crawl/batch
 *
 * 여러 URL을 순차적으로 크롤링하고 결과를 SSE로 전송
 */
adminRoutes.post('/crawl/batch', async (c) => {
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
