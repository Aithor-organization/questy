/**
 * Course Queries
 * 강좌 CRUD 함수
 */

import { eq, sql } from 'drizzle-orm';
import { db, sqlite } from '../connection.js';
import * as schema from '../schema.js';

export function searchCourses(options: {
  query?: string;
  subject?: string;
  teacher?: string;
  limit?: number;
}) {
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

export function getCourse(id: string) {
  const result = db.select().from(schema.courses).where(eq(schema.courses.id, id)).limit(1).all();
  return result[0] || null;
}

export function getCoursesByTeacher(teacher: string) {
  return db.select().from(schema.courses)
    .where(sql`teacher LIKE ${'%' + teacher + '%'}`)
    .all();
}

export function getAllCourses() {
  return db.select().from(schema.courses).all();
}

export function getCoursesCount() {
  const result = db.select({
    count: sql<number>`COUNT(*)`,
  }).from(schema.courses).all();
  return result[0]?.count || 0;
}

export function getIncompleteCourses() {
  const stmt = sqlite.prepare(`
    SELECT * FROM courses
    WHERE is_completed = 0 OR is_completed IS NULL
    ORDER BY updated_at ASC
  `);
  return stmt.all() as schema.Course[];
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
