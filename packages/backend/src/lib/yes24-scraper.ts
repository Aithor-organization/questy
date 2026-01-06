/**
 * Yes24 미리보기 스크래퍼
 * 문제집 목차 및 학습계획표 추출
 */

export interface Yes24Book {
  productId: string;
  title: string;
  author: string;
  publisher: string;
  previewUrl: string;
  thumbnailUrl: string;
  // 교재 메타데이터 (수능 학습용)
  metadata?: BookMetadata;
}

// 수능 학습에 유용한 교재 메타데이터
export interface BookMetadata {
  subject?: string;       // 과목: 수학, 국어, 영어, 과학탐구 등
  targetGrade?: string;   // 대상: 고1, 고2, 고3, N수생, 전학년
  bookType?: string;      // 유형: 개념서, 유형서, 기출문제집, 모의고사
  category?: string;      // Yes24 카테고리
  description?: string;   // 간략 설명 (100자 이내)
}

export interface PreviewPage {
  pageNumber: number;
  imageUrl: string;
}

// Yes24 검색 결과 파싱
export async function searchBooks(query: string): Promise<Yes24Book[]> {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodedQuery}`;

  try {
    const response = await fetch(searchUrl);
    const html = await response.text();

    // 검색 결과에서 책 정보 추출
    const books: Yes24Book[] = [];

    // 미리보기 버튼이 있는 상품만 추출 (정규식 패턴)
    const productPattern = /openPreviewCheck\((\d+)\)/g;
    const titlePattern = /<a[^>]*class="[^"]*gd_name[^"]*"[^>]*>([^<]+)<\/a>/g;

    let match;
    const productIds: string[] = [];

    while ((match = productPattern.exec(html)) !== null) {
      productIds.push(match[1]);
    }

    // 고유 상품 ID만 유지
    const uniqueIds = [...new Set(productIds)].slice(0, 20);

    for (const productId of uniqueIds) {
      books.push({
        productId,
        title: '', // 상세 정보는 별도 API로 가져옴
        author: '',
        publisher: '',
        previewUrl: `https://www.yes24.com/Product/Viewer/Preview/${productId}`,
        thumbnailUrl: `https://image.yes24.com/goods/${productId}/L`,
      });
    }

    return books;
  } catch (error) {
    console.error('Yes24 검색 실패:', error);
    return [];
  }
}

// 미리보기 페이지에서 이미지 URL 추출
export async function getPreviewImages(productId: string): Promise<PreviewPage[]> {
  const previewUrl = `https://www.yes24.com/Product/Viewer/Preview/${productId}`;

  try {
    const response = await fetch(previewUrl);
    const html = await response.text();

    const pages: PreviewPage[] = [];

    // pagedomain 추출 (이미지 기본 URL)
    const domainMatch = html.match(/'pagedomain':\s*"([^"]+)"/);
    if (!domainMatch) {
      console.error('pagedomain을 찾을 수 없습니다');
      return [];
    }
    const pagedomain = domainMatch[1];

    // PAGE 배열에서 이미지 파일명 추출
    const pagesMatch = html.match(/'PAGE'\s*:\s*\[([\s\S]*?)\]\s*\}/);
    if (!pagesMatch) {
      console.error('PAGE 데이터를 찾을 수 없습니다');
      return [];
    }

    try {
      // JSON 파싱을 위해 배열 부분만 추출
      const pagesJson = `[${pagesMatch[1]}]`;
      const pagesData = JSON.parse(pagesJson);

      for (const page of pagesData) {
        // LargeImage 사용 (가장 큰 이미지)
        const imageName = page.LargeImage?.Name || page.MiddleImage?.Name || page.SmallImage?.Name;
        if (imageName) {
          pages.push({
            pageNumber: page.OrderNo,
            imageUrl: `${pagedomain}/${imageName}`,
          });
        }
      }
    } catch (parseError) {
      console.error('PAGE JSON 파싱 실패:', parseError);
      return [];
    }

    return pages;
  } catch (error) {
    console.error('미리보기 이미지 추출 실패:', error);
    return [];
  }
}

// 제목에서 과목 추출
function extractSubject(title: string, category: string): string | undefined {
  const text = `${title} ${category}`.toLowerCase();
  if (text.includes('수학') || text.includes('미적분') || text.includes('기하') || text.includes('확률과 통계')) return '수학';
  if (text.includes('국어') || text.includes('문학') || text.includes('독서') || text.includes('화법과 작문')) return '국어';
  if (text.includes('영어') || text.includes('english')) return '영어';
  if (text.includes('물리')) return '물리학';
  if (text.includes('화학')) return '화학';
  if (text.includes('생명과학') || text.includes('생물')) return '생명과학';
  if (text.includes('지구과학')) return '지구과학';
  if (text.includes('한국사')) return '한국사';
  if (text.includes('사회') || text.includes('윤리') || text.includes('정치') || text.includes('경제') || text.includes('지리')) return '사회탐구';
  if (text.includes('과학탐구') || text.includes('과탐')) return '과학탐구';
  return undefined;
}

// 제목에서 대상 학년 추출
function extractTargetGrade(title: string): string | undefined {
  if (title.includes('고1') || title.includes('고등 1')) return '고1';
  if (title.includes('고2') || title.includes('고등 2')) return '고2';
  if (title.includes('고3') || title.includes('고등 3') || title.includes('수능')) return '고3';
  if (title.includes('N수') || title.includes('재수')) return 'N수생';
  if (title.includes('전학년') || title.includes('고등')) return '전학년';
  return undefined;
}

// 제목에서 교재 유형 추출
function extractBookType(title: string): string | undefined {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('개념') || lowerTitle.includes('정석') || lowerTitle.includes('기본')) return '개념서';
  if (lowerTitle.includes('유형') || lowerTitle.includes('쎈') || lowerTitle.includes('라이트')) return '유형서';
  if (lowerTitle.includes('기출') || lowerTitle.includes('수능완성') || lowerTitle.includes('수능특강')) return '기출문제집';
  if (lowerTitle.includes('모의고사') || lowerTitle.includes('모의')) return '모의고사';
  if (lowerTitle.includes('실전') || lowerTitle.includes('파이널')) return '실전서';
  if (lowerTitle.includes('문제') || lowerTitle.includes('연습')) return '문제집';
  return undefined;
}

// 상품 상세 정보 가져오기
export async function getBookDetails(productId: string): Promise<Yes24Book | null> {
  const detailUrl = `https://www.yes24.com/Product/Goods/${productId}`;

  try {
    const response = await fetch(detailUrl);
    const html = await response.text();

    // 제목 추출
    const titleMatch = html.match(/<h2[^>]*class="[^"]*gd_name[^"]*"[^>]*>([^<]+)<\/h2>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 저자 추출
    const authorMatch = html.match(/저자\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/);
    const author = authorMatch ? authorMatch[1].trim() : '';

    // 출판사 추출
    const publisherMatch = html.match(/출판사\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/);
    const publisher = publisherMatch ? publisherMatch[1].trim() : '';

    // 카테고리 추출 (breadcrumb)
    const categoryMatch = html.match(/class="[^"]*yesAlertLi[^"]*"[^>]*>([^<]+)<\/a>/g);
    const category = categoryMatch ? categoryMatch.map(m => m.replace(/<[^>]+>/g, '').trim()).join(' > ') : '';

    // 책 소개 추출 (간략하게)
    const descMatch = html.match(/<div[^>]*class="[^"]*infoWrap_txt[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let description = '';
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 100);
    }

    // 메타데이터 추출
    const metadata: BookMetadata = {
      subject: extractSubject(title, category),
      targetGrade: extractTargetGrade(title),
      bookType: extractBookType(title),
      category: category || undefined,
      description: description || undefined,
    };

    return {
      productId,
      title,
      author,
      publisher,
      previewUrl: `https://www.yes24.com/Product/Viewer/Preview/${productId}`,
      thumbnailUrl: `https://image.yes24.com/goods/${productId}/L`,
      metadata,
    };
  } catch (error) {
    console.error('상품 상세 정보 가져오기 실패:', error);
    return null;
  }
}
