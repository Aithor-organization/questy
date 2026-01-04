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
}

export interface PreviewPage {
  pageNumber: number;
  imageUrl: string;
}

export interface TableOfContents {
  productId: string;
  title: string;
  sections: TOCSection[];
  totalPages: number;
  previewPages: PreviewPage[];
}

export interface TOCSection {
  number: string;
  title: string;
  items: TOCItem[];
}

export interface TOCItem {
  title: string;
  pageStart?: number;
  pageEnd?: number;
  topics?: string[];
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

    return {
      productId,
      title,
      author,
      publisher,
      previewUrl: `https://www.yes24.com/Product/Viewer/Preview/${productId}`,
      thumbnailUrl: `https://image.yes24.com/goods/${productId}/L`,
    };
  } catch (error) {
    console.error('상품 상세 정보 가져오기 실패:', error);
    return null;
  }
}

// Vision API로 목차 이미지 분석 (OpenRouter 사용)
export async function analyzeTableOfContents(
  imageUrls: string[],
  apiKey: string
): Promise<TableOfContents | null> {
  try {
    const imageContents = imageUrls.slice(0, 5).map(url => ({
      type: 'image_url' as const,
      image_url: { url },
    }));

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `이 이미지들은 문제집의 목차입니다. 다음 JSON 형식으로 목차를 추출해주세요:
{
  "sections": [
    {
      "number": "I",
      "title": "섹션 제목",
      "items": [
        {
          "title": "항목 제목",
          "pageStart": 10,
          "pageEnd": 15,
          "topics": ["주제1", "주제2"]
        }
      ]
    }
  ],
  "totalPages": 300
}

JSON만 출력하세요.`,
              },
              ...imageContents,
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      const parsed = JSON.parse(content);
      return {
        productId: '',
        title: '',
        sections: parsed.sections || [],
        totalPages: parsed.totalPages || 0,
        previewPages: [],
      };
    }

    return null;
  } catch (error) {
    console.error('목차 분석 실패:', error);
    return null;
  }
}

// 전체 플로우: 검색 → 미리보기 → 목차 분석
export async function scrapeBookData(
  productId: string,
  apiKey: string
): Promise<TableOfContents | null> {
  // 1. 책 상세 정보 가져오기
  const bookDetails = await getBookDetails(productId);
  if (!bookDetails) return null;

  // 2. 미리보기 이미지 가져오기
  const previewImages = await getPreviewImages(productId);
  if (previewImages.length === 0) return null;

  // 3. 목차 이미지 분석 (처음 5페이지 정도가 목차)
  const tocImageUrls = previewImages.slice(1, 6).map(p => p.imageUrl);
  const toc = await analyzeTableOfContents(tocImageUrls, apiKey);

  if (toc) {
    toc.productId = productId;
    toc.title = bookDetails.title;
    toc.previewPages = previewImages;
  }

  return toc;
}
