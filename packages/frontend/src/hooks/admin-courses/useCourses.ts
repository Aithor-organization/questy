/**
 * Admin Courses - useCourses Hook
 * 강좌 관련 훅
 */

import { useState, useCallback } from 'react';
import { supabase, retryQuery } from '../../lib/supabase';
import {
  CRAWL_API_BASE,
  defaultHeaders,
  mapCourseFromSupabase,
  type Course,
} from './types';

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

  // 강사별 강좌 목록 조회
  const fetchCoursesByTeacher = useCallback(async (teacher: string) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // AbortError 발생 시 자동 재시도
      const { data, error: fetchError } = await retryQuery<CourseRow[]>(() =>
        supabase!
          .from('courses')
          .select('*')
          .eq('teacher_name', teacher)
          .order('created_at', { ascending: false })
      );

      if (fetchError) throw fetchError;

      setCourses((data || []).map(mapCourseFromSupabase));
    } catch (err: any) {
      console.error('[useCourses] fetchCoursesByTeacher error:', err);
      setError(err.message || '강좌 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 강좌 추가 (URL 크롤링)
  const addCourse = useCallback(async (url: string, teacher?: string, subject?: string) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 백엔드에서 크롤링
      const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || '강좌 정보를 가져올 수 없습니다');
        return null;
      }

      const { courseId, title, lecturer, curriculum, isCompleted, platform } = json.data;

      // Supabase에 강좌 저장 (AbortError 재시도)
      const courseData = {
        id: courseId || `course-${Date.now()}`,
        name: title || '제목 없음',
        teacher_name: teacher || lecturer || '미지정',
        subject: subject || null,
        platform: platform || 'megastudy',
        url,
        lectures: curriculum || [],
        lecture_count: curriculum?.length || 0,
        is_completed: isCompleted || false,
        last_crawled_at: new Date().toISOString(),
      };

      const { data: savedCourse, error: upsertError } = await retryQuery<CourseRow>(() =>
        supabase!
          .from('courses')
          .upsert(courseData, { onConflict: 'id' })
          .select()
          .single()
      );

      if (upsertError) throw upsertError;

      // 강사 목록 갱신
      if (onTeachersUpdate) await onTeachersUpdate();

      return mapCourseFromSupabase(savedCourse);
    } catch (err: any) {
      console.error('[useCourses] addCourse error:', err);
      setError(err.message || '강좌 추가 실패');
      return null;
    } finally {
      setLoading(false);
    }
  }, [onTeachersUpdate]);

  // 강좌 업데이트 (재크롤링)
  const updateCourse = useCallback(async (courseId: string) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 기존 강좌 정보 조회 (AbortError 재시도)
      const { data: existingCourse, error: fetchError } = await retryQuery<CourseRow>(() =>
        supabase!
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single()
      );

      if (fetchError || !existingCourse) {
        setError('강좌를 찾을 수 없습니다');
        return null;
      }

      if (!existingCourse.url) {
        setError('강좌 URL이 없어 업데이트할 수 없습니다');
        return null;
      }

      const prevLectureCount = existingCourse.lecture_count || 0;

      // 백엔드에서 재크롤링
      const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: existingCourse.url }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || '강좌 정보를 가져올 수 없습니다');
        return null;
      }

      const { curriculum, isCompleted } = json.data;

      // Supabase 업데이트 (AbortError 재시도)
      const { data: updatedCourse, error: updateError } = await retryQuery<CourseRow>(() =>
        supabase!
          .from('courses')
          .update({
            lectures: curriculum || [],
            lecture_count: curriculum?.length || 0,
            is_completed: isCompleted || false,
            last_crawled_at: new Date().toISOString(),
          })
          .eq('id', courseId)
          .select()
          .single()
      );

      if (updateError) throw updateError;

      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? mapCourseFromSupabase(updatedCourse) : c))
      );

      const newLectureCount = curriculum?.length || 0;
      return {
        prevLectureCount,
        newLectureCount,
        diff: newLectureCount - prevLectureCount,
        isCompleted: isCompleted || false,
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

  // 전체 강좌 목록 조회
  const getAllCourses = useCallback(async () => {
    if (!supabase) return [];

    try {
      // AbortError 재시도
      const { data, error: fetchError } = await retryQuery<CourseRow[]>(() =>
        supabase!
          .from('courses')
          .select('*')
          .order('teacher_name')
      );

      if (fetchError) throw fetchError;
      return (data || []).map(mapCourseFromSupabase);
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
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return { success: 0, failed: urls.length, results: [] };
    }

    setLoading(true);
    setError(null);

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
        // 백엔드에서 크롤링
        const res = await fetch(`${CRAWL_API_BASE}/api/admin/crawl`, {
          method: 'POST',
          headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
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

        const { courseId, title, lecturer, curriculum, isCompleted, platform } = json.data;

        // Supabase에 강좌 저장 (AbortError 재시도)
        const courseData = {
          id: courseId || `course-${Date.now()}-${i}`,
          name: title || '제목 없음',
          teacher_name: lecturer || '미지정',
          subject: null,
          platform: platform || 'megastudy',
          url,
          lectures: curriculum || [],
          lecture_count: curriculum?.length || 0,
          is_completed: isCompleted || false,
          last_crawled_at: new Date().toISOString(),
        };

        const { data: savedCourse, error: upsertError } = await retryQuery<CourseRow>(() =>
          supabase!
            .from('courses')
            .upsert(courseData, { onConflict: 'id' })
            .select()
            .single()
        );

        if (upsertError) throw upsertError;

        const mappedCourse = mapCourseFromSupabase(savedCourse);
        successCount++;
        results.push({ url, success: true, course: mappedCourse });

        onProgress?.({
          total: urls.length,
          completed: i + 1,
          success: successCount,
          failed: failedCount,
          current: { url, success: true, name: mappedCourse.name },
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
