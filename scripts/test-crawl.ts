/**
 * 단일 URL 크롤링 테스트 스크립트
 * 사용법: npx tsx scripts/test-crawl.ts
 */

// iconv-lite import
import * as iconvLite from 'iconv-lite';

// 강좌 상세 페이지 (구매 정보)
const DETAIL_URL = 'https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=58265&TEC_CD=megakdw';

// 커리큘럼 페이지 (강의 목록) - JavaScript로 AJAX 로딩됨
const CURRICULUM_URL = 'https://www.megastudy.net/teacher_v2/curriculum/curriculum.asp?CHR_CD=58265&tec_cd=megakdw';

// AJAX 엔드포인트 - 선생님 전체 커리큘럼 표
const CURRICULUM_AJAX_URL = 'https://www.megastudy.net/teacher_v2/curriculum/curriculum_tbl_ax.asp?tec_cd=megakdw&dom_cd=1&HomeCd=148&MainFlg=N';

// AJAX 엔드포인트 - 특정 강좌의 강의 목록 (CHR_CD=58265)
const COURSE_DETAIL_AJAX_URL = 'https://www.megastudy.net/teacher_v2/curriculum/Tbl_ChrDtl_Ax.asp?row_no=1&chr_cd=58265';

const TEST_URL = COURSE_DETAIL_AJAX_URL;  // 특정 강좌 강의 목록 테스트

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

  // 강의 목록 영역 찾기 (디버깅)
  console.log('\n🔍 강의 목록 영역 검색:');

  // 커리큘럼/강의목록 관련 키워드 검색
  const keywords = ['curriculum', 'lecture_list', 'lec_list', 'chr_list', '강의목록', '커리큘럼'];
  keywords.forEach(kw => {
    const idx = html.toLowerCase().indexOf(kw.toLowerCase());
    if (idx !== -1) {
      console.log(`  📍 "${kw}" 발견 위치: ${idx}`);
      console.log(`     주변 내용: ${html.substring(idx, idx + 200).replace(/\s+/g, ' ')}`);
    }
  });

  // class에 list가 포함된 div/ul 찾기
  const listPattern = /<(div|ul|table)[^>]*class="[^"]*list[^"]*"[^>]*>/gi;
  let listMatch;
  console.log('\n📋 list 관련 태그:');
  let count = 0;
  while ((listMatch = listPattern.exec(html)) !== null && count < 5) {
    console.log(`  ${listMatch[0].substring(0, 100)}`);
    count++;
  }

  // AJAX로 강의 목록을 불러오는지 확인
  const ajaxPattern = /(?:ajax|fetch|load)\s*\([^)]*(?:curriculum|lecture|chr)[^)]*\)/gi;
  let ajaxMatch;
  console.log('\n🌐 AJAX 호출 패턴:');
  while ((ajaxMatch = ajaxPattern.exec(html)) !== null) {
    console.log(`  ${ajaxMatch[0]}`);
  }

  // 강좌 정보 관련 변수 찾기
  const varPattern = /var\s+(?:chr|lec|course|curriculum)[^;]*;/gi;
  let varMatch;
  console.log('\n📦 관련 JavaScript 변수:');
  count = 0;
  while ((varMatch = varPattern.exec(html)) !== null && count < 10) {
    console.log(`  ${varMatch[0].substring(0, 150)}`);
    count++;
  }

  // 강좌명 찾기 (다양한 패턴)
  console.log('\n📚 강좌명 검색:');
  const coursePatterns = [
    /class="[^"]*lec[_-]?(?:name|tit|title)[^"]*"[^>]*>([^<]+)</gi,
    /class="[^"]*chr[_-]?(?:name|tit|title)[^"]*"[^>]*>([^<]+)</gi,
    /class="[^"]*course[_-]?(?:name|tit|title)[^"]*"[^>]*>([^<]+)</gi,
    /<h[1-4][^>]*>([^<]{10,100})<\/h[1-4]>/gi,
  ];
  coursePatterns.forEach((pattern, idx) => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1].trim();
      if (text.length > 5 && !text.includes('메가스터디')) {
        console.log(`  패턴${idx + 1}: ${text.substring(0, 80)}`);
      }
    }
  });

  // CHR_CD (강좌코드) 관련 검색
  console.log('\n🔢 CHR_CD 관련:');
  const chrPattern = /CHR_CD['":\s=]*['"]?(\d+)['"]?/gi;
  let chrMatch;
  const chrCodes = new Set<string>();
  while ((chrMatch = chrPattern.exec(html)) !== null) {
    chrCodes.add(chrMatch[1]);
  }
  console.log(`  발견된 CHR_CD: ${Array.from(chrCodes).join(', ')}`);

  // detail_view 또는 lecture 관련 div 찾기
  console.log('\n📦 주요 컨텐츠 영역:');
  const contentPattern = /<div[^>]*(?:id|class)="[^"]*(?:detail|content|lecture|info)[^"]*"[^>]*>/gi;
  let contentMatch;
  let contentCount = 0;
  while ((contentMatch = contentPattern.exec(html)) !== null && contentCount < 8) {
    const startIdx = contentMatch.index;
    console.log(`  ${contentMatch[0].substring(0, 80)}`);
    // 해당 div 내용 일부 출력
    const snippet = html.substring(startIdx, startIdx + 300).replace(/\s+/g, ' ');
    console.log(`    → ${snippet.substring(0, 150)}...`);
    contentCount++;
  }

  // HTML 중간 부분 (강좌 정보가 있을 가능성)
  console.log('\n📜 HTML 중간 부분 (50000-52000자):\n');
  console.log(html.substring(50000, 52000));
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
