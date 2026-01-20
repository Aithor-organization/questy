/**
 * 탐구 과목 세분화 스크립트 (로컬 SQLite용)
 * "탐구"로 통합된 강좌들을 세부 과목으로 분류
 *
 * 사용법:
 * cd packages/backend && bun scripts/classify-tamgu-sqlite.ts
 */

import { Database } from 'bun:sqlite';
import * as path from 'path';

// 과목 매핑 (제목에서 추출한 값 → 정규화된 과목명)
const SUBJECT_MAPPING: Record<string, string> = {
  // 과학탐구
  '물리학I': '물리학Ⅰ',
  '물리학Ⅰ': '물리학Ⅰ',
  '물리학II': '물리학Ⅱ',
  '물리학Ⅱ': '물리학Ⅱ',
  '화학I': '화학Ⅰ',
  '화학Ⅰ': '화학Ⅰ',
  '화학II': '화학Ⅱ',
  '화학Ⅱ': '화학Ⅱ',
  '생명과학I': '생명과학Ⅰ',
  '생명과학Ⅰ': '생명과학Ⅰ',
  '생명과학II': '생명과학Ⅱ',
  '생명과학Ⅱ': '생명과학Ⅱ',
  '지구과학I': '지구과학Ⅰ',
  '지구과학Ⅰ': '지구과학Ⅰ',
  '지구과학II': '지구과학Ⅱ',
  '지구과학Ⅱ': '지구과학Ⅱ',
  // 사회탐구
  '생활과윤리': '생활과윤리',
  '윤리와사상': '윤리와사상',
  '한국지리': '한국지리',
  '세계지리': '세계지리',
  '동아시아사': '동아시아사',
  '세계사': '세계사',
  '경제': '경제',
  '정치와법': '정치와법',
  '사회문화': '사회문화',
};

// 제목에서 과목 추출 (예: "[화학I] 베테랑의 개념완성" → "화학I")
function extractSubjectFromTitle(title: string): string | null {
  const match = title.match(/^\[(.+?)\]/);
  if (!match) return null;
  return match[1];
}

// 추출된 과목을 정규화 (예: "화학I" → "화학Ⅰ")
function normalizeSubject(rawSubject: string): string | null {
  return SUBJECT_MAPPING[rawSubject] || null;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('   탐구 과목 세분화 스크립트 (SQLite)');
  console.log('═══════════════════════════════════════════════════\n');

  const dbPath = path.join(process.cwd(), 'questybook.db');
  console.log(`📂 DB 경로: ${dbPath}\n`);

  const db = new Database(dbPath);

  // 1. "탐구" 과목인 강좌 조회
  console.log('📋 "탐구" 과목 강좌 조회 중...');
  const courses = db.prepare(`
    SELECT id, name, subject FROM courses WHERE subject = '탐구'
  `).all() as Array<{ id: number; name: string; subject: string }>;

  if (courses.length === 0) {
    console.log('✅ "탐구" 과목 강좌가 없습니다. 이미 분류되었을 수 있습니다.');
    db.close();
    return;
  }

  console.log(`   총 ${courses.length}개 강좌 발견\n`);

  // 2. 분류 및 업데이트
  const updateStmt = db.prepare(`UPDATE courses SET subject = ? WHERE id = ?`);
  const subjectCounts: Record<string, number> = {};
  let successCount = 0;
  let unclassifiedCount = 0;

  for (const course of courses) {
    const rawSubject = extractSubjectFromTitle(course.name);
    if (!rawSubject) {
      console.log(`   ⚠️  분류 불가: [${course.id}] ${course.name}`);
      unclassifiedCount++;
      continue;
    }

    const newSubject = normalizeSubject(rawSubject);
    if (!newSubject) {
      console.log(`   ⚠️  매핑 없음: [${course.id}] ${rawSubject} - ${course.name}`);
      unclassifiedCount++;
      continue;
    }

    updateStmt.run(newSubject, course.id);
    subjectCounts[newSubject] = (subjectCounts[newSubject] || 0) + 1;
    successCount++;
  }

  db.close();

  // 3. 결과 출력
  console.log('\n📊 분류 결과:');
  console.log('─────────────────────────────────────────────');
  const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
  for (const [subject, count] of sortedSubjects) {
    console.log(`   ${subject}: ${count}개`);
  }
  console.log('─────────────────────────────────────────────');
  console.log(`   ✅ 업데이트 성공: ${successCount}개`);
  if (unclassifiedCount > 0) {
    console.log(`   ⚠️  분류 불가: ${unclassifiedCount}개`);
  }
  console.log('');
}

main().catch(console.error);
