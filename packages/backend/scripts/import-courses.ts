/**
 * Import megastudy courses data into questyBook database
 *
 * Usage: npx tsx scripts/import-courses.ts
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { courses } from '../src/db/schema';
import * as fs from 'fs';
import * as path from 'path';

// megastudy 데이터 경로
const MEGASTUDY_DATA_PATH = '/Users/seohun/Documents/에이전트/infiniteAgent/questy-back/data/courses/megastudy';

// DB 연결
const sqlite = new Database('./questybook.db');
const db = drizzle(sqlite);

interface Lecture {
  num: number;
  title: string;
  duration: string;
  rawContent?: string;
}

interface CourseData {
  code: string;
  name: string;
  url: string;
  teacher: string;
  subject: string;
  extractedAt: string;
  lectures: Lecture[];
  elementFound?: boolean;
}

// 시간 문자열을 분으로 변환 (예: "1:30:45" -> 90.75)
function durationToMinutes(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  } else if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  return 0;
}

// 강사별 과목 매핑 (강좌명에서 과목 추출 불가한 경우 fallback)
const teacherSubjectMap: Record<string, string> = {
  // 국어
  '강민철': '국어',
  '김동욱': '국어',
  // 영어
  '조정식': '영어',
};

// 과목명 정규화 (강좌명에서 과목 추출 우선)
function normalizeSubject(subject: string, teacher?: string, courseName?: string): string {
  // 1. 강좌명에서 과목 추출 (가장 정확)
  if (courseName) {
    // [과목명] 패턴에서 추출
    const bracketMatch = courseName.match(/\[([\w가-힣]+)\]/);
    if (bracketMatch) {
      const extracted = bracketMatch[1];
      // 과학탐구 과목
      if (/물리학/.test(extracted)) return '탐구';
      if (/화학/.test(extracted)) return '탐구';
      if (/생명과학/.test(extracted)) return '탐구';
      if (/지구과학/.test(extracted)) return '탐구';
      if (/한국지리|세계지리/.test(extracted)) return '탐구';
      if (/생활과\s?윤리|윤리와\s?사상/.test(extracted)) return '탐구';
      if (/사회문화|사회\s?문화/.test(extracted)) return '탐구';
      if (/정치와\s?법/.test(extracted)) return '탐구';
      if (/경제/.test(extracted)) return '탐구';
      if (/동아시아사|세계사/.test(extracted)) return '탐구';
      // 국어 과목
      if (/화법과\s?작문|언어와\s?매체|독서|문학/.test(extracted)) return '국어';
      // 한국사
      if (/한국사/.test(extracted)) return '한국사';
    }

    // 수학 키워드 확인
    if (/수학[IⅠⅡ12]|미적분|확률과\s?통계|기하/.test(courseName)) return '수학';
    // 수분감, 뉴런 등 현우진 강좌 패턴
    if (/수분감|뉴런/.test(courseName)) return '수학';
  }

  // 2. 강사명으로 매핑 (데이터에 과목 정보가 없는 경우)
  if (teacher && teacherSubjectMap[teacher]) {
    return teacherSubjectMap[teacher];
  }

  // 3. subject 필드 매핑
  const subjectMap: Record<string, string> = {
    '수학I': '수학',
    '수학II': '수학',
    '수학1': '수학',
    '수학2': '수학',
    '미적분': '수학',
    '기하': '수학',
    '확률과 통계': '수학',
    '화법과 작문': '국어',
    '언어와 매체': '국어',
    '독서': '국어',
    '문학': '국어',
    '영어I': '영어',
    '영어II': '영어',
    '영어': '영어',
    '한국사': '한국사',
    '한국지리': '탐구',
    '세계지리': '탐구',
    '생활과 윤리': '탐구',
    '윤리와 사상': '탐구',
    '사회문화': '탐구',
    '정치와 법': '탐구',
    '경제': '탐구',
    '물리학I': '탐구',
    '물리학II': '탐구',
    '화학I': '탐구',
    '화학II': '탐구',
    '생명과학I': '탐구',
    '생명과학II': '탐구',
    '지구과학I': '탐구',
    '지구과학II': '탐구',
  };

  return subjectMap[subject] || '기타';
}

async function importCourses() {
  console.log('🚀 Starting megastudy courses import...\n');

  // _complete.json 또는 _complete_final.json 파일들 찾기
  const dirs = fs.readdirSync(MEGASTUDY_DATA_PATH);
  let totalCourses = 0;
  let totalLectures = 0;

  for (const dir of dirs) {
    const dirPath = path.join(MEGASTUDY_DATA_PATH, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;

    // _complete.json 또는 _complete_final.json 파일 찾기
    let completeFile = path.join(dirPath, `${dir}_complete.json`);
    if (!fs.existsSync(completeFile)) {
      completeFile = path.join(dirPath, `${dir}_complete_final.json`);
    }
    if (!fs.existsSync(completeFile)) {
      console.log(`⏭️  Skipping ${dir}: no complete file found`);
      continue;
    }

    console.log(`📁 Processing: ${dir} (${path.basename(completeFile)})`);

    const data: CourseData[] = JSON.parse(fs.readFileSync(completeFile, 'utf-8'));

    for (const course of data) {
      // 총 강의 시간 계산
      const totalMinutes = course.lectures.reduce((sum, lec) =>
        sum + durationToMinutes(lec.duration), 0
      );
      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      const totalDuration = `${hours}시간 ${mins}분`;

      // 카테고리 추출 (강좌명에서)
      let category = '';
      if (course.name.includes('기출')) category = '기출분석';
      else if (course.name.includes('개념')) category = '개념완성';
      else if (course.name.includes('실전')) category = '실전대비';
      else if (course.name.includes('파이널')) category = '파이널';
      else if (course.name.includes('모의')) category = '모의고사';

      // lectures에서 필요한 정보만 추출
      const lecturesJson = course.lectures.map(lec => ({
        num: lec.num,
        title: lec.title,
        duration: lec.duration
      }));

      // 과목 정규화 (강좌명에서 추출 우선)
      const normalizedSubject = normalizeSubject(course.subject, course.teacher, course.name);

      try {
        await db.insert(courses).values({
          id: course.code,
          name: course.name,
          teacher: course.teacher,
          subject: normalizedSubject,
          platform: 'megastudy',
          url: course.url,
          lectures: JSON.stringify(lecturesJson),
          lectureCount: course.lectures.length,
          totalDuration,
          category,
          year: 2027,  // 대부분 2027 수능 대비
        }).onConflictDoUpdate({
          target: courses.id,
          set: {
            name: course.name,
            teacher: course.teacher,
            subject: normalizedSubject,
            url: course.url,
            lectures: JSON.stringify(lecturesJson),
            lectureCount: course.lectures.length,
            totalDuration,
            category,
            updatedAt: new Date(),
          }
        });

        totalCourses++;
        totalLectures += course.lectures.length;

        console.log(`  ✅ ${course.teacher} - ${course.name} (${course.lectures.length}강)`);
      } catch (error) {
        console.error(`  ❌ Error importing ${course.code}:`, error);
      }
    }
  }

  console.log(`\n✨ Import complete!`);
  console.log(`   Total courses: ${totalCourses}`);
  console.log(`   Total lectures: ${totalLectures}`);

  sqlite.close();
}

importCourses().catch(console.error);
