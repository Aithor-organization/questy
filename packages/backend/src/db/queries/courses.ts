/**
 * Course Queries
 * 강좌 CRUD 함수
 *
 * NOTE: Bun 환경에서는 SQLite, Node.js(Railway)에서는 Supabase 사용
 */

import { eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../connection.js';
import { supabase } from '../supabase.js';
import * as schema from '../schema.js';

// Supabase 응답을 SQLite 스키마 형식으로 변환
function mapSupabaseCourse(course: any): schema.Course {
  return {
    id: course.id,
    name: course.name,
    teacher: course.teacher_name,
    subject: course.subject,
    platform: course.platform,
    url: course.url,
    lectures: typeof course.lectures === 'string'
      ? course.lectures
      : JSON.stringify(course.lectures || []),
    lectureCount: course.lecture_count,
    totalDuration: course.total_duration,
    category: null,
    year: null,
    isCompleted: course.is_completed,
    lastCrawledAt: course.last_crawled_at ? new Date(course.last_crawled_at).getTime() / 1000 : null,
    createdAt: course.created_at ? new Date(course.created_at).getTime() / 1000 : null,
    updatedAt: course.updated_at ? new Date(course.updated_at).getTime() / 1000 : null,
  };
}

// Supabase 폴백: 강좌 검색
async function searchCoursesSupabase(options: {
  query?: string;
  subject?: string;
  teacher?: string;
  limit?: number;
}): Promise<schema.Course[]> {
  if (!supabase) {
    console.error('[courses] Supabase client not available');
    return [];
  }

  const { query, subject, teacher, limit = 20 } = options;

  let queryBuilder = supabase
    .from('courses')
    .select('*')
    .order('teacher_name')
    .order('name')
    .limit(limit);

  if (teacher) {
    queryBuilder = queryBuilder.ilike('teacher_name', `%${teacher}%`);
  }

  if (subject) {
    queryBuilder = queryBuilder.eq('subject', subject);
  }

  if (query && !teacher) {
    // name 또는 teacher_name에 검색어 포함
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,teacher_name.ilike.%${query}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[courses] Supabase search error:', error);
    return [];
  }

  return (data || []).map(mapSupabaseCourse);
}

export function searchCourses(options: {
  query?: string;
  subject?: string;
  teacher?: string;
  limit?: number;
}): schema.Course[] | Promise<schema.Course[]> {
  // SQLite가 사용 가능하면 SQLite 사용 (Bun 환경)
  if (sqlite) {
    const { query, subject, teacher, limit = 20 } = options;

    let whereClause = '1=1';
    const params: string[] = [];

    if (teacher) {
      whereClause += ' AND teacher LIKE ?';
      params.push(`%${teacher}%`);
    }

    if (subject) {
      whereClause += ' AND subject = ?';
      params.push(subject);
    }

    if (query && !teacher) {
      whereClause += ' AND (name LIKE ? OR teacher LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    const stmt = sqlite.prepare(`
      SELECT * FROM courses
      WHERE ${whereClause}
      ORDER BY teacher, name
      LIMIT ?
    `);

    return stmt.all(...params, limit) as schema.Course[];
  }

  // SQLite가 없으면 Supabase 사용 (Node.js/Railway 환경)
  console.log('[courses] Using Supabase fallback for searchCourses');
  return searchCoursesSupabase(options);
}

// Supabase 폴백: 단일 강좌 조회
async function getCourseSupabase(id: string): Promise<schema.Course | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapSupabaseCourse(data);
}

export function getCourse(id: string): schema.Course | null | Promise<schema.Course | null> {
  if (db) {
    const result = db.select().from(schema.courses).where(eq(schema.courses.id, id)).limit(1).all();
    return result[0] || null;
  }
  return getCourseSupabase(id);
}

// Supabase 폴백: 강사별 강좌 조회
async function getCoursesByTeacherSupabase(teacher: string): Promise<schema.Course[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .ilike('teacher_name', `%${teacher}%`);

  if (error || !data) return [];
  return data.map(mapSupabaseCourse);
}

export function getCoursesByTeacher(teacher: string): schema.Course[] | Promise<schema.Course[]> {
  if (db) {
    return db.select().from(schema.courses)
      .where(sql`teacher LIKE ${'%' + teacher + '%'}`)
      .all();
  }
  return getCoursesByTeacherSupabase(teacher);
}

// Supabase 폴백: 전체 강좌 조회
async function getAllCoursesSupabase(): Promise<schema.Course[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*');

  if (error || !data) return [];
  return data.map(mapSupabaseCourse);
}

export function getAllCourses(): schema.Course[] | Promise<schema.Course[]> {
  if (db) {
    return db.select().from(schema.courses).all();
  }
  return getAllCoursesSupabase();
}

// Supabase 폴백: 강좌 수 조회
async function getCoursesCountSupabase(): Promise<number> {
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}

export function getCoursesCount(): number | Promise<number> {
  if (db) {
    const result = db.select({
      count: sql<number>`COUNT(*)`,
    }).from(schema.courses).all();
    return result[0]?.count || 0;
  }
  return getCoursesCountSupabase();
}

// Supabase 폴백: 미완강 강좌 조회
async function getIncompleteCoursesSupabase(): Promise<schema.Course[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .or('is_completed.eq.false,is_completed.is.null')
    .order('updated_at', { ascending: true });

  if (error || !data) return [];
  return data.map(mapSupabaseCourse);
}

export function getIncompleteCourses(): schema.Course[] | Promise<schema.Course[]> {
  if (sqlite) {
    const stmt = sqlite.prepare(`
      SELECT * FROM courses
      WHERE is_completed = 0 OR is_completed IS NULL
      ORDER BY updated_at ASC
    `);
    return stmt.all() as schema.Course[];
  }
  return getIncompleteCoursesSupabase();
}

export function updateCourseCurriculum(
  id: string,
  data: {
    lectures: string;
    lectureCount: number;
    totalDuration?: string;
    isCompleted: boolean;
  }
) {
  const stmt = sqlite.prepare(`
    UPDATE courses
    SET lectures = ?,
        lecture_count = ?,
        total_duration = ?,
        is_completed = ?,
        last_crawled_at = unixepoch(),
        updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(
    data.lectures,
    data.lectureCount,
    data.totalDuration || null,
    data.isCompleted ? 1 : 0,
    id
  );
  return getCourse(id);
}

export function upsertCourse(data: {
  id: string;
  name: string;
  teacher: string;
  subject?: string;
  platform?: string;
  url?: string;
  lectures?: string;
  lectureCount?: number;
  totalDuration?: string;
  category?: string;
  year?: number;
  isCompleted?: boolean;
}) {
  const existing = getCourse(data.id);

  if (existing) {
    const stmt = sqlite.prepare(`
      UPDATE courses
      SET name = ?, teacher = ?, subject = COALESCE(?, subject),
          platform = COALESCE(?, platform), url = COALESCE(?, url),
          lectures = COALESCE(?, lectures), lecture_count = COALESCE(?, lecture_count),
          total_duration = COALESCE(?, total_duration), category = COALESCE(?, category),
          year = COALESCE(?, year), is_completed = COALESCE(?, is_completed),
          updated_at = unixepoch()
      WHERE id = ?
    `);
    stmt.run(
      data.name, data.teacher, data.subject || null, data.platform || null,
      data.url || null, data.lectures || null, data.lectureCount ?? null,
      data.totalDuration || null, data.category || null, data.year ?? null,
      data.isCompleted !== undefined ? (data.isCompleted ? 1 : 0) : null, data.id
    );
  } else {
    const stmt = sqlite.prepare(`
      INSERT INTO courses (id, name, teacher, subject, platform, url, lectures,
        lecture_count, total_duration, category, year, is_completed, last_crawled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `);
    stmt.run(
      data.id, data.name, data.teacher, data.subject || null,
      data.platform || 'megastudy', data.url || null, data.lectures || null,
      data.lectureCount ?? 0, data.totalDuration || null, data.category || null,
      data.year ?? null, data.isCompleted ? 1 : 0
    );
  }

  return getCourse(data.id);
}

export function updateTeacherInfo(
  oldName: string,
  newData: { name?: string; subject?: string; platform?: string; }
) {
  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (newData.name && newData.name !== oldName) {
    updates.push('teacher = ?');
    params.push(newData.name);
  }
  if (newData.subject !== undefined) {
    updates.push('subject = ?');
    params.push(newData.subject || null);
  }
  if (newData.platform) {
    updates.push('platform = ?');
    params.push(newData.platform);
  }

  if (updates.length === 0) {
    return getCoursesByTeacher(oldName);
  }

  updates.push('updated_at = unixepoch()');
  params.push(oldName);

  const stmt = sqlite.prepare(`
    UPDATE courses SET ${updates.join(', ')} WHERE teacher = ?
  `);
  stmt.run(...params);

  return getCoursesByTeacher(newData.name || oldName);
}

export function updateCourseMetadata(
  id: string,
  data: { name?: string; teacher?: string; subject?: string; platform?: string; isCompleted?: boolean; }
) {
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
  if (data.teacher !== undefined) { updates.push('teacher = ?'); params.push(data.teacher); }
  if (data.subject !== undefined) { updates.push('subject = ?'); params.push(data.subject || null); }
  if (data.platform !== undefined) { updates.push('platform = ?'); params.push(data.platform); }
  if (data.isCompleted !== undefined) { updates.push('is_completed = ?'); params.push(data.isCompleted ? 1 : 0); }

  if (updates.length === 0) return getCourse(id);

  updates.push('updated_at = unixepoch()');
  params.push(id);

  const stmt = sqlite.prepare(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params);

  return getCourse(id);
}
