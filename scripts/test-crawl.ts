/**
 * 단일 URL 크롤링 테스트 스크립트
 * 사용법: npx tsx scripts/test-crawl.ts
 */

// iconv-lite import
import * as iconvLite from 'iconv-lite';

const TEST_URL = 'https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=58265&TEC_CD=megakdw';

async function fetchHtmlEucKr(url: string): Promise<string | null> {

  console.log(`\n🔍 크롤링 시도: ${url}\n`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`  ▶ 시도 ${attempt + 1}/3...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`  ✅ HTTP Status: ${response.status}`);
      console.log(`  📦 Content-Type: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const html = iconvLite.decode(Buffer.from(buffer), 'euc-kr');

      console.log(`  📄 HTML 길이: ${html.length} bytes`);

      return html;

    } catch (error: any) {
      console.log(`  ❌ 실패: ${error.message}`);
      if (attempt < 2) {
        console.log(`  ⏳ 2초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return null;
}

function parseHtml(html: string) {
  console.log('\n📊 HTML 파싱 결과:\n');

  // 제목 추출
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  console.log(`  📌 Title: ${titleMatch ? titleMatch[1].trim() : '찾지 못함'}`);

  // 강좌명 추출
  const courseNameMatch = html.match(/<h3[^>]*class="[^"]*tit[^"]*"[^>]*>([^<]+)<\/h3>/i)
    || html.match(/<span[^>]*class="[^"]*lec_tit[^"]*"[^>]*>([^<]+)<\/span>/i);
  console.log(`  📚 강좌명: ${courseNameMatch ? courseNameMatch[1].trim() : '찾지 못함'}`);

  // 강의 목록 파싱
  const curriculum: string[] = [];

  // 패턴 1: span.num + span.tit 구조
  const lecturePattern1 = /<li[^>]*>[\s\S]*?<span[^>]*class="[^"]*num[^"]*"[^>]*>(\d+)<\/span>[\s\S]*?<span[^>]*class="[^"]*tit[^"]*"[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = lecturePattern1.exec(html)) !== null) {
    curriculum.push(`${match[1]}. ${match[2].trim()}`);
  }

  // 패턴 2: 다른 구조 시도
  if (curriculum.length === 0) {
    const lecturePattern2 = /<td[^>]*class="[^"]*subject[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
    while ((match = lecturePattern2.exec(html)) !== null) {
      curriculum.push(match[1].trim());
    }
  }

  console.log(`  📝 강의 수: ${curriculum.length}개`);
  if (curriculum.length > 0) {
    console.log('\n  강의 목록 (처음 5개):');
    curriculum.slice(0, 5).forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item}`);
    });
    if (curriculum.length > 5) {
      console.log(`    ... 외 ${curriculum.length - 5}개`);
    }
  }

  // 완강 여부
  const isCompleted = /완강|종강|마감/i.test(html);
  console.log(`\n  🏁 완강 여부: ${isCompleted ? '완강' : '진행중'}`);

  // HTML 일부 출력 (디버깅용)
  console.log('\n📜 HTML 샘플 (처음 2000자):\n');
  console.log(html.substring(0, 2000));
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🧪 메가스터디 크롤링 테스트');
  console.log('=' .repeat(60));

  const html = await fetchHtmlEucKr(TEST_URL);

  if (html) {
    parseHtml(html);
    console.log('\n✅ 크롤링 성공!');
  } else {
    console.log('\n❌ 크롤링 실패 - HTML을 가져오지 못했습니다.');
  }

  console.log('\n' + '=' .repeat(60));
}

main().catch(console.error);
