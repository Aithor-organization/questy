/**
 * useAdminCourses
 * 관리자 강좌/강사 관리 훅
 */

import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

// ngrok 무료 버전 경고 페이지 우회용 헤더
const defaultHeaders: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
};

// 강사 타입
export interface Teacher {
  name: string;
  platform: string;
  subjects: string[];
  courseCount: number;
}

// 강좌 타입
export interface Course {
  id: string;
  name: string;
  teacher: string;
  subject: string | null;
  platform: string;
  url: string | null;
  lectureCount: number;
  totalDuration: string | null;
  isCompleted: boolean;
  lastCrawledAt: string | null;
  chapters: Array<{
    num: string;
    title: string;
    duration: string;
  }>;
}

// API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useAdminCourses() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 강사 목록 조회
  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers`, {
        headers: defaultHeaders,
      });
      const json: ApiResponse<{ teachers: Teacher[] }> = await res.json();

      if (json.success && json.data) {
        setTeachers(json.data.teachers);
      } else {
        setError(json.error || '강사 목록 조회 실패');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  // 강사 추가
  const addTeacher = useCallback(async (name: string, platform: string, subject?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, platform, subject }),
      });
      const json: ApiResponse<{ teacher: Teacher }> = await res.json();

      if (json.success) {
        await fetchTeachers(); // 목록 갱신
        return true;
      } else {
        setError(json.error || '강사 추가 실패');
        return false;
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

  // 강사별 강좌 목록 조회
  const fetchCoursesByTeacher = useCallback(async (teacher: string) => {
    setLoading(true);
    setError(null);
    try {
      const encodedTeacher = encodeURIComponent(teacher);
      const res = await fetch(`${API_BASE}/api/admin/courses/${encodedTeacher}`, {
        headers: defaultHeaders,
      });
      const json: ApiResponse<{ courses: Course[] }> = await res.json();

      if (json.success && json.data) {
        setCourses(json.data.courses);
      } else {
        setError(json.error || '강좌 목록 조회 실패');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  // 강좌 추가 (URL 크롤링)
  const addCourse = useCallback(async (url: string, teacher?: string, subject?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/courses`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, teacher, subject }),
      });
      const json: ApiResponse<{ course: Course }> = await res.json();

      if (json.success && json.data) {
        // 강사 목록 갱신 (새 강사가 추가되었을 수 있음)
        await fetchTeachers();
        return json.data.course;
      } else {
        setError(json.error || '강좌 추가 실패');
        return null;
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

  // 강좌 업데이트 (재크롤링)
  const updateCourse = useCallback(async (courseId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
      });
      const json: ApiResponse<{
        course: Course;
        changes: {
          prevLectureCount: number;
          newLectureCount: number;
          diff: number;
          isCompleted: boolean;
        };
      }> = await res.json();

      if (json.success && json.data) {
        // 현재 강좌 목록 업데이트
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? json.data!.course : c))
        );
        return json.data.changes;
      } else {
        setError(json.error || '강좌 업데이트 실패');
        return null;
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 강사 정보 수정
  const editTeacher = useCallback(async (
    oldName: string,
    newData: { name?: string; subject?: string; platform?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      const json: ApiResponse<{ teacher: Teacher; coursesUpdated: number }> = await res.json();

      if (json.success) {
        await fetchTeachers();
        return true;
      } else {
        setError(json.error || '강사 수정 실패');
        return false;
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<{ course: Course }> = await res.json();

      if (json.success && json.data) {
        // 현재 강좌 목록 업데이트
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? json.data!.course : c))
        );
        // 강사 목록도 갱신 (강사가 변경되었을 수 있음)
        await fetchTeachers();
        return json.data.course;
      } else {
        setError(json.error || '강좌 수정 실패');
        return null;
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchTeachers]);

  // 에러 초기화
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    teachers,
    courses,
    loading,
    error,
    fetchTeachers,
    addTeacher,
    editTeacher,
    fetchCoursesByTeacher,
    addCourse,
    editCourse,
    updateCourse,
    clearError,
  };
}

export default useAdminCourses;
