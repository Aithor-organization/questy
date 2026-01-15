/**
 * Supabase 연결 테스트 스크립트
 * 실행: cd packages/backend && npx tsx scripts/test-supabase.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testConnection() {
  console.log('\n========================================');
  console.log('  Supabase 연결 테스트');
  console.log('========================================\n');

  // 환경변수 확인
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('1. 환경변수 확인:');
  console.log(`   SUPABASE_URL: ${url ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${key ? '✅ 설정됨 (' + key.slice(0, 20) + '...)' : '❌ 없음'}`);

  if (!url || !key) {
    console.log('\n❌ 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
    process.exit(1);
  }

  // Supabase 클라이언트 생성
  const supabase = createClient(url, key);

  // 테이블 조회 테스트
  console.log('\n2. 테이블 연결 테스트:');

  const tables = ['students', 'conversations', 'learning_memories', 'student_progress', 'courses', 'teachers', 'plans'];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ${table}: ❌ ${error.message}`);
      } else {
        console.log(`   ${table}: ✅ 연결됨 (${count ?? 0}개 레코드)`);
      }
    } catch (err) {
      console.log(`   ${table}: ❌ ${err}`);
    }
  }

  // 쓰기 테스트
  console.log('\n3. 쓰기/읽기 테스트:');

  try {
    // 테스트 학생 생성
    const testSessionId = `test-${Date.now()}`;
    const { data: inserted, error: insertError } = await supabase
      .from('students')
      .insert({ session_id: testSessionId, name: '테스트 학생' })
      .select()
      .single();

    if (insertError) {
      console.log(`   INSERT: ❌ ${insertError.message}`);
    } else {
      console.log(`   INSERT: ✅ 학생 생성됨 (id: ${inserted.id})`);

      // 삭제
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', inserted.id);

      if (deleteError) {
        console.log(`   DELETE: ❌ ${deleteError.message}`);
      } else {
        console.log(`   DELETE: ✅ 테스트 데이터 삭제됨`);
      }
    }
  } catch (err) {
    console.log(`   쓰기 테스트 실패: ${err}`);
  }

  console.log('\n========================================');
  console.log('  ✅ Supabase 연결 테스트 완료!');
  console.log('========================================\n');
}

testConnection().catch(console.error);
