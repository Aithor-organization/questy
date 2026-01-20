/**
 * 탐구 과목 세분화 스크립트
 * "탐구"로 통합된 강좌들을 세부 과목으로 분류
 *
 * 사용법:
 * cd packages/backend && npx tsx scripts/classify-tamgu-subjects.ts
 *
 * 옵션:
 * --dry-run: 실제 업데이트 없이 미리보기만
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

interface Course {
  id: number;
  name: string;
  subject: string;
}

interface ClassificationResult {
  id: number;
  name: string;
  oldSubject: string;
  newSubject: string;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('   탐구 과목 세분화 스크립트');
  console.log('═══════════════════════════════════════════════════\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN 모드 - 실제 업데이트 없이 미리보기만 합니다.\n');
  }

  // 1. "탐구" 과목인 강좌 모두 조회
  console.log('📋 "탐구" 과목 강좌 조회 중...');
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, name, subject')
    .eq('subject', '탐구');

  if (error) {
    console.error('❌ 강좌 조회 실패:', error.message);
    process.exit(1);
  }

  if (!courses || courses.length === 0) {
    console.log('✅ "탐구" 과목 강좌가 없습니다. 이미 분류되었을 수 있습니다.');
    return;
  }

  console.log(`   총 ${courses.length}개 강좌 발견\n`);

  // 2. 각 강좌의 새 과목 결정
  const toUpdate: ClassificationResult[] = [];
  const unclassified: Course[] = [];
  const subjectCounts: Record<string, number> = {};

  for (const course of courses) {
    const rawSubject = extractSubjectFromTitle(course.name);

    if (!rawSubject) {
      unclassified.push(course);
      continue;
    }

    const newSubject = normalizeSubject(rawSubject);

    if (!newSubject) {
      unclassified.push(course);
      continue;
    }

    toUpdate.push({
      id: course.id,
      name: course.name,
      oldSubject: course.subject,
      newSubject,
    });

    subjectCounts[newSubject] = (subjectCounts[newSubject] || 0) + 1;
  }

  // 3. 분류 결과 출력
  console.log('📊 분류 결과:');
  console.log('─────────────────────────────────────────────');

  const sortedSubjects = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
  for (const [subject, count] of sortedSubjects) {
    console.log(`   ${subject}: ${count}개`);
  }
  console.log('─────────────────────────────────────────────');
  console.log(`   총 분류됨: ${toUpdate.length}개`);
  console.log(`   분류 불가: ${unclassified.length}개\n`);

  if (unclassified.length > 0) {
    console.log('⚠️  분류되지 않은 강좌:');
    for (const course of unclassified) {
      console.log(`   - [${course.id}] ${course.name}`);
    }
    console.log('');
  }

  // 4. 업데이트 미리보기
  if (toUpdate.length > 0) {
    console.log('📝 업데이트 예정:');
    for (const item of toUpdate.slice(0, 10)) {
      console.log(`   [${item.id}] "${item.oldSubject}" → "${item.newSubject}": ${item.name.substring(0, 50)}...`);
    }
    if (toUpdate.length > 10) {
      console.log(`   ... 외 ${toUpdate.length - 10}개`);
    }
    console.log('');
  }

  // 5. 실제 업데이트
  if (!isDryRun && toUpdate.length > 0) {
    console.log('🚀 Supabase 업데이트 시작...\n');

    let successCount = 0;
    let failCount = 0;

    for (const item of toUpdate) {
      const { error: updateError } = await supabase
        .from('courses')
        .update({ subject: item.newSubject })
        .eq('id', item.id);

      if (updateError) {
        console.error(`   ❌ [${item.id}] 업데이트 실패: ${updateError.message}`);
        failCount++;
      } else {
        successCount++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('   업데이트 완료');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   ✅ 성공: ${successCount}개`);
    if (failCount > 0) {
      console.log(`   ❌ 실패: ${failCount}개`);
    }
  } else if (isDryRun) {
    console.log('💡 실제 업데이트를 실행하려면 --dry-run 옵션을 제거하세요:');
    console.log('   npx tsx scripts/classify-tamgu-subjects.ts');
  }

  console.log('');
}

main().catch(console.error);
