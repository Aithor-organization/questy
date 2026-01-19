/**
 * Admin Courses - useTeachers Hook
 * 강사 관련 훅
 */

import { useState, useCallback } from 'react';
import { supabase, retryQuery } from '../../lib/supabase';
import type { Teacher } from './types';

export function useTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 강사 목록 조회 (courses 테이블에서 집계)
  const fetchTeachers = useCallback(async () => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // AbortError 재시도
      const { data, error: fetchError } = await retryQuery<Array<{
        teacher_name: string;
        platform: string | null;
        subject: string | null;
      }>>(() =>
        supabase!
          .from('courses')
          .select('teacher_name, platform, subject')
      );

      if (fetchError) throw fetchError;

      // 강사별로 그룹화
      const teacherMap = new Map<string, {
        name: string;
        platform: string;
        subjects: Set<string>;
        courseCount: number;
      }>();

      for (const course of data || []) {
        const key = course.teacher_name;
        if (!teacherMap.has(key)) {
          teacherMap.set(key, {
            name: course.teacher_name,
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

      // 배열로 변환 및 정렬
      const teacherList = Array.from(teacherMap.values())
        .map((t) => ({
          name: t.name,
          platform: t.platform,
          subjects: Array.from(t.subjects),
          courseCount: t.courseCount,
        }))
        .sort((a, b) => b.courseCount - a.courseCount);

      setTeachers(teacherList);
    } catch (err: any) {
      // AbortError는 React StrictMode 또는 빠른 언마운트로 인한 정상적인 취소
      if (err?.name === 'AbortError') {
        console.log('[useTeachers] fetchTeachers cancelled');
        return;
      }
      console.error('[useTeachers] fetchTeachers error:', err);
      setError(err.message || '강사 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 강사 추가
  const addTeacher = useCallback(async (name: string, platform: string, subject?: string) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // AbortError 재시도
      const { error: insertError } = await retryQuery<null>(() =>
        supabase!
          .from('teachers')
          .upsert({
            name,
            platform: platform || 'megastudy',
            subjects: subject ? [subject] : [],
          }, { onConflict: 'name,platform' })
      );

      if (insertError) throw insertError;

      await fetchTeachers();
      return true;
    } catch (err: any) {
      console.error('[useTeachers] addTeacher error:', err);
      setError(err.message || '강사 추가 실패');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

  // 강사 정보 수정
  const editTeacher = useCallback(async (
    oldName: string,
    newData: { name?: string; subject?: string; platform?: string }
  ) => {
    if (!supabase) {
      setError('Supabase가 설정되지 않았습니다');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const updateFields: any = {};
      if (newData.name) updateFields.teacher_name = newData.name;
      if (newData.subject !== undefined) updateFields.subject = newData.subject;
      if (newData.platform) updateFields.platform = newData.platform;

      // AbortError 재시도
      const { error: updateError } = await retryQuery<null>(() =>
        supabase!
          .from('courses')
          .update(updateFields)
          .eq('teacher_name', oldName)
      );

      if (updateError) throw updateError;

      await fetchTeachers();
      return true;
    } catch (err: any) {
      console.error('[useTeachers] editTeacher error:', err);
      setError(err.message || '강사 수정 실패');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    teachers,
    loading,
    error,
    fetchTeachers,
    addTeacher,
    editTeacher,
    clearError,
  };
}
