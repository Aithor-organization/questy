/**
 * Admin Courses - useCourses Hook
 * 강좌 관련 훅
 */

import { useState, useCallback } from 'react';
import { supabase, retryQuery } from '../../lib/supabase';
import { isCacheStale, setToCache, getFromCache, invalidateCacheByPrefix } from '../../lib/cache';
import { ensureValidSession } from '../../lib/session-guard';
import {
  CRAWL_API_BASE,
  defaultHeaders,
  mapCourseFromSupabase,
  type Course,
} from './types';

/**
 * Supabase 액세스 토큰을 포함한 인증 헤더 생성
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return defaultHeaders;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return defaultHeaders;

  return {
    ...defaultHeaders,
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// P3: 캐시 설정
const COURSES_CACHE_KEY = 'courses_by_teacher_';
const ALL_COURSES_CACHE_KEY = 'all_courses';
const STALE_TIME = 5 * 60 * 1000; // 5분

// Supabase courses 테이블 타입
interface CourseRow {
  id: string;
  name: string;
  teacher_name: string;
  subject: string | null;
  platform: string;
  url: string | null;
  lectures: any[];
  lecture_count: number;
  is_completed: boolean;
  last_crawled_at: string | null;
  created_at: string;
}

export function useCourses(onTeachersUpdate?: () => Promise<void>) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 강사별 강좌 목록 조회 (P3: 캐시 적용)
  const fetchCoursesByTeacher = useCallback(async (teacher: string, forceRefresh = false) => {
    console.log(`%c[Admin] 📡 강좌 조회 시작: ${teacher}`, 'color: #06b6d4; font-weight: bold;');

    if (!supabase) {
      console.warn('[Admin] ⚠️ Supabase 클라이언트 없음');
      setError('Supabase가 설정되지 않았습니다');
      return;
    }

    const cacheKey = `${COURSES_CACHE_KEY}${teacher}`;

    // P3: 캐시가 fresh하고 강제 새로고침이 아니면 캐시 사용
    if (!forceRefresh && !isCacheStale(cacheKey, STALE_TIME)) {
      const cached = getFromCache<Course[]>(cacheKey);
      if (cached) {
        console.log(`%c[Admin] 📦 캐시 히트: ${teacher} (${cached.length}건)`, 'color: #22c55e;');
        setCourses(cached);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[Admin] 🔄 Supabase 쿼리 실행: courses.select(teacher_name=${teacher})`);

      // AbortError 발생 시 자동 재시도
      const { data, error: fetchError } = await retryQuery<CourseRow[]>(() =>
        supabase!
          .from('courses')
          .select('*')
          .eq('teacher_name', teacher)
          .order('created_at', { ascending: false })
      );

      if (fetchError) {
        console.error(`%c[Admin] ❌ 쿼리 실패: ${fetchError.message}`, 'color: #ef4444;');
        throw fetchError;
      }

      const mappedCourses = (data || []).map(mapCourseFromSupabase);
      console.log(`%c[Admin] ✅ 강좌 조회 완료: ${teacher} (${mappedCourses.length}건)`, 'color: #22c55e;');
      setCourses(mappedCourses);

      // P3: 캐시에 저장
      setToCache(cacheKey, mappedCourses);
    } catch (err: any) {
      console.error('[Admin] fetchCoursesByTeacher error:', err);
      setError(err.message || '강좌 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 강좌 추가 (URL 크롤링 + 백엔드 저장)
  // P1: 데이터 무결성 개선 - 백엔드에서 저장 처리
  const addCourse = useCallback(async (url: string, teacher?: string, subject?: string) => {
    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 인증 헤더 가져오기
      const authHeaders = await getAuthHeaders();

      // 백엔드에서 크롤링 + 저장 (통합 API)
      const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl-and-save`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, teacher, subject }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || '강좌 추가 실패');
        return null;
      }

      // 백엔드 응답을 Course 형식으로 변환
      const savedCourse: Course = {
        id: json.data.id,
        name: json.data.name,
        teacher: json.data.teacherName,
        subject: json.data.subject,
        platform: json.data.platform,
        url: json.data.url,
        lectureCount: json.data.lectureCount,
        totalDuration: null,
        isCompleted: json.data.isCompleted,
        lastCrawledAt: json.data.lastCrawledAt,
        chapters: json.data.lectures || [],
      };

      // P3: 캐시 무효화 (새 강좌 추가됨)
      invalidateCacheByPrefix(COURSES_CACHE_KEY);
      invalidateCacheByPrefix(ALL_COURSES_CACHE_KEY);

      // 강사 목록 갱신
      if (onTeachersUpdate) await onTeachersUpdate();

      return savedCourse;
    } catch (err: any) {
      console.error('[useCourses] addCourse error:', err);
      setError(err.message || '강좌 추가 실패');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onTeachersUpdate]);

  // 강좌 업데이트 (재크롤링 + 백엔드 저장)
  // P1: 데이터 무결성 개선 - 백엔드에서 저장 처리
  const updateCourse = useCallback(async (courseId: string) => {
    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 인증 헤더 가져오기
      const authHeaders = await getAuthHeaders();

      // 백엔드에서 재크롤링 + 저장 (통합 API)
      const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl-and-update/${courseId}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || '강좌 업데이트 실패');
        return null;
      }

      // 로컬 상태 업데이트 (필요한 경우)
      setCourses((prev) =>
        prev.map((c) => {
          if (c.id === courseId) {
            return {
              ...c,
              lectureCount: json.data.lectureCount,
              isCompleted: json.data.isCompleted,
              lastCrawledAt: json.data.lastCrawledAt,
            };
          }
          return c;
        })
      );

      // P3: 캐시 무효화 (강좌 업데이트됨)
      invalidateCacheByPrefix(COURSES_CACHE_KEY);
      invalidateCacheByPrefix(ALL_COURSES_CACHE_KEY);

      return {
        prevLectureCount: json.data.prevLectureCount,
        newLectureCount: json.data.lectureCount,
        diff: json.data.diff,
        isCompleted: json.data.isCompleted,
      };
    } catch (err: any) {
      console.error('[useCourses] updateCourse error:', err);
      setError(err.message || '강좌 업데이트 실패');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 강좌 메타데이터 수정 (크롤링 없이)
  const editCourse = useCallback(async (
    courseId: string,
    data: {
      name?: string;
      teacher?: string;
      subject?: string;
      platform?: string;
      isCompleted?: boolean;
    }
  ) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return null;
    }

    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const updateFields: any = {};
      if (data.name !== undefined) updateFields.name = data.name;
      if (data.teacher !== undefined) updateFields.teacher_name = data.teacher;
      if (data.subject !== undefined) updateFields.subject = data.subject;
      if (data.platform !== undefined) updateFields.platform = data.platform;
      if (data.isCompleted !== undefined) updateFields.is_completed = data.isCompleted;

      // AbortError 재시도
      const { data: updatedCourse, error: updateError } = await retryQuery<CourseRow>(() =>
        supabase!
          .from('courses')
          .update(updateFields)
          .eq('id', courseId)
          .select()
          .single()
      );

      if (updateError) throw updateError;

      const mappedCourse = mapCourseFromSupabase(updatedCourse);

      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? mappedCourse : c))
      );

      // P3: 캐시 무효화 (강좌 메타데이터 수정됨)
      invalidateCacheByPrefix(COURSES_CACHE_KEY);
      invalidateCacheByPrefix(ALL_COURSES_CACHE_KEY);

      if (onTeachersUpdate) await onTeachersUpdate();

      return mappedCourse;
    } catch (err: any) {
      console.error('[useCourses] editCourse error:', err);
      setError(err.message || '강좌 수정 실패');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onTeachersUpdate]);

  // 전체 강좌 목록 조회 (P3: 캐시 적용)
  const getAllCourses = useCallback(async (forceRefresh = false) => {
    if (!supabase) return [];

    // P3: 캐시가 fresh하고 강제 새로고침이 아니면 캐시 사용
    if (!forceRefresh && !isCacheStale(ALL_COURSES_CACHE_KEY, STALE_TIME)) {
      const cached = getFromCache<Course[]>(ALL_COURSES_CACHE_KEY);
      if (cached) {
        console.log('[useCourses] 캐시 히트: getAllCourses');
        return cached;
      }
    }

    try {
      // AbortError 재시도
      const { data, error: fetchError } = await retryQuery<CourseRow[]>(() =>
        supabase!
          .from('courses')
          .select('*')
          .order('teacher_name')
      );

      if (fetchError) throw fetchError;

      const mappedCourses = (data || []).map(mapCourseFromSupabase);

      // P3: 캐시에 저장
      setToCache(ALL_COURSES_CACHE_KEY, mappedCourses);

      return mappedCourses;
    } catch (err: any) {
      console.error('[useCourses] getAllCourses error:', err);
      return [];
    }
  }, []);

  // 강좌 삭제
  const deleteCourse = useCallback(async (courseId: string) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return false;
    }

    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 강좌 삭제
      const { error: deleteError } = await retryQuery<null>(() =>
        supabase!
          .from('courses')
          .delete()
          .eq('id', courseId)
      );

      if (deleteError) throw deleteError;

      // 로컬 상태에서도 제거
      setCourses((prev) => prev.filter((c) => c.id !== courseId));

      // P3: 캐시 무효화 (강좌 삭제됨)
      invalidateCacheByPrefix(COURSES_CACHE_KEY);
      invalidateCacheByPrefix(ALL_COURSES_CACHE_KEY);

      // 강사 목록 갱신 (강좌 수 변경 가능)
      if (onTeachersUpdate) await onTeachersUpdate();

      return true;
    } catch (err: any) {
      console.error('[useCourses] deleteCourse error:', err);
      setError(err.message || '강좌 삭제 실패');
      return false;
    } finally {
      setLoading(false);
    }
  }, [onTeachersUpdate]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 여러 강좌 일괄 추가 (URL 배열)
  // P1: 데이터 무결성 개선 - 백엔드에서 저장 처리
  const addCoursesBatch = useCallback(async (
    urls: string[],
    onProgress?: (progress: {
      total: number;
      completed: number;
      success: number;
      failed: number;
      current?: { url: string; success: boolean; name?: string; error?: string };
    }) => void
  ) => {
    // 세션 유효성 확인 (만료 시 알림 후 중단)
    if (!(await ensureValidSession())) {
      return { success: 0, failed: urls.length, results: [] };
    }

    setLoading(true);
    setError(null);

    // 인증 헤더 미리 가져오기 (루프 외부에서 한 번만)
    const authHeaders = await getAuthHeaders();

    const results: Array<{ url: string; success: boolean; course?: Course; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();
      if (!url) {
        failedCount++;
        results.push({ url, success: false, error: 'URL이 비어있습니다' });
        continue;
      }

      try {
        // 백엔드에서 크롤링 + 저장 (통합 API)
        const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl-and-save`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        const json = await res.json();

        if (!json.success) {
          failedCount++;
          results.push({ url, success: false, error: json.error || '크롤링 실패' });
          onProgress?.({
            total: urls.length,
            completed: i + 1,
            success: successCount,
            failed: failedCount,
            current: { url, success: false, error: json.error },
          });
          continue;
        }

        // 백엔드 응답을 Course 형식으로 변환
        const savedCourse: Course = {
          id: json.data.id,
          name: json.data.name,
          teacher: json.data.teacherName,
          subject: json.data.subject,
          platform: json.data.platform,
          url: json.data.url,
          lectureCount: json.data.lectureCount,
          totalDuration: null,
          isCompleted: json.data.isCompleted,
          lastCrawledAt: json.data.lastCrawledAt,
          chapters: json.data.lectures || [],
        };

        successCount++;
        results.push({ url, success: true, course: savedCourse });

        onProgress?.({
          total: urls.length,
          completed: i + 1,
          success: successCount,
          failed: failedCount,
          current: { url, success: true, name: savedCourse.name },
        });

      } catch (err: any) {
        console.error(`[useCourses] addCoursesBatch error for ${url}:`, err);
        failedCount++;
        results.push({ url, success: false, error: err.message || '저장 실패' });
        onProgress?.({
          total: urls.length,
          completed: i + 1,
          success: successCount,
          failed: failedCount,
          current: { url, success: false, error: err.message },
        });
      }

      // 요청 간 딜레이 (크롤링 서버 부하 방지)
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // P3: 캐시 무효화 (일괄 추가됨)
    if (successCount > 0) {
      invalidateCacheByPrefix(COURSES_CACHE_KEY);
      invalidateCacheByPrefix(ALL_COURSES_CACHE_KEY);
    }

    // 강사 목록 갱신
    if (onTeachersUpdate && successCount > 0) {
      await onTeachersUpdate();
    }

    setLoading(false);
    return { success: successCount, failed: failedCount, results };
  }, [onTeachersUpdate]);

  return {
    courses,
    loading,
    error,
    fetchCoursesByTeacher,
    addCourse,
    addCoursesBatch,
    updateCourse,
    editCourse,
    deleteCourse,
    getAllCourses,
    clearError,
  };
}
