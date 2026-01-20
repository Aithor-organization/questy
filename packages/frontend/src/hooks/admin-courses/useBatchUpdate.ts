/**
 * Admin Courses - useBatchUpdate Hook
 * 배치 업데이트 훅
 */

import { useCallback } from 'react';
import { supabase, retryQuery } from '../../lib/supabase';
import { ensureValidSession } from '../../lib/session-guard';
import {
  CRAWL_API_BASE,
  defaultHeaders,
  type BatchUpdateOptions,
  type BatchProgressData,
} from './types';

export function useBatchUpdate() {
  // 배치 업데이트: Supabase에서 강좌 목록 조회 → 백엔드 크롤링 → Supabase 저장
  const batchUpdateCourses = useCallback(async (
    options: BatchUpdateOptions,
    onProgress: (data: BatchProgressData) => void
  ) => {
    if (!supabase) {
      onProgress({ type: 'error', error: 'Supabase가 설정되지 않았습니다' });
      return;
    }

    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      onProgress({ type: 'error', error: '세션이 만료되었습니다. 페이지를 새로고침해주세요.' });
      return;
    }

    try {
      // Supabase에서 업데이트할 강좌 목록 조회
      let query = supabase
        .from('courses')
        .select('*')
        .not('url', 'is', null);

      if (options.skipCompleted !== false) {
        query = query.eq('is_completed', false);
      }

      if (options.onlyOutdated) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.or(`last_crawled_at.is.null,last_crawled_at.lt.${sevenDaysAgo}`);
      }

      // AbortError 재시도 로직 적용
      const { data: allCourses, error: fetchError } = await retryQuery(() =>
        query
          .order('teacher_name')
          .limit(options.maxCourses || 50)
      );

      if (fetchError) throw fetchError;

      const coursesToUpdate = allCourses || [];
      const total = coursesToUpdate.length;

      onProgress({ type: 'start', total, skipped: 0 });

      let completed = 0;
      let updated = 0;
      let failed = 0;

      // 각 강좌를 순차적으로 크롤링 및 업데이트
      for (const course of coursesToUpdate) {
        try {
          const prevLectureCount = course.lecture_count || 0;

          // 백엔드에서 크롤링
          const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl`, {
            method: 'POST',
            headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: course.url }),
          });

          const json = await res.json();

          if (!json.success) {
            failed++;
            completed++;
            onProgress({
              type: 'progress',
              completed,
              total,
              current: {
                id: course.id,
                name: course.name,
                success: false,
                error: json.error,
              },
            });
            continue;
          }

          const { curriculum, isCompleted } = json.data;

          // Supabase 업데이트 (AbortError 재시도)
          await retryQuery(() =>
            supabase!
              .from('courses')
              .update({
                lectures: curriculum || [],
                lecture_count: curriculum?.length || 0,
                is_completed: isCompleted || false,
                last_crawled_at: new Date().toISOString(),
              })
              .eq('id', course.id)
          );

          const newLectureCount = curriculum?.length || 0;
          const diff = newLectureCount - prevLectureCount;

          updated++;
          completed++;

          onProgress({
            type: 'progress',
            completed,
            total,
            current: {
              id: course.id,
              name: course.name,
              teacher: course.teacher_name,
              success: true,
              diff,
              isCompleted: isCompleted || false,
            },
          });

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err: any) {
          failed++;
          completed++;
          onProgress({
            type: 'progress',
            completed,
            total,
            current: {
              id: course.id,
              name: course.name,
              success: false,
              error: err.message,
            },
          });
        }
      }

      onProgress({
        type: 'complete',
        total,
        updated,
        failed,
        skipped: 0,
      });

    } catch (err: any) {
      console.error('[useBatchUpdate] batchUpdateCourses error:', err);
      onProgress({ type: 'error', error: err.message });
    }
  }, []);

  return {
    batchUpdateCourses,
  };
}
