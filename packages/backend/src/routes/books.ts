import { Hono } from 'hono';
import { searchBooks, getBookDetails, getPreviewImages, scrapeBookData } from '../lib/yes24-scraper';

const books = new Hono();

// 이미지 프록시 (CORS 우회) - /:productId 보다 먼저 정의해야 함
books.get('/proxy-image', async (c) => {
  const imageUrl = c.req.query('url');

  if (!imageUrl) {
    return c.json({ success: false, error: '이미지 URL이 필요합니다' }, 400);
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.yes24.com/',
      },
    });

    if (!response.ok) {
      return c.json({ success: false, error: '이미지를 가져올 수 없습니다' }, 404);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return c.json({
      success: true,
      data: {
        base64,
        contentType,
        url: imageUrl,
      },
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    return c.json({ success: false, error: '이미지 프록시 실패' }, 500);
  }
});

// Yes24 책 검색
books.get('/search', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json({ success: false, error: '검색어를 입력해주세요' }, 400);
  }

  try {
    const results = await searchBooks(query);

    // 각 책의 상세 정보 가져오기 (병렬 처리)
    const detailedBooks = await Promise.all(
      results.slice(0, 10).map(async (book) => {
        const details = await getBookDetails(book.productId);
        return details || book;
      })
    );

    return c.json({
      success: true,
      data: detailedBooks.filter(b => b.title), // 제목이 있는 것만
    });
  } catch (error) {
    console.error('검색 오류:', error);
    return c.json({ success: false, error: '검색 중 오류가 발생했습니다' }, 500);
  }
});

// 책 상세 정보
books.get('/:productId', async (c) => {
  const productId = c.req.param('productId');

  try {
    const book = await getBookDetails(productId);

    if (!book) {
      return c.json({ success: false, error: '책을 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: book });
  } catch (error) {
    return c.json({ success: false, error: '상세 정보 조회 실패' }, 500);
  }
});

// 미리보기 이미지 목록
books.get('/:productId/preview', async (c) => {
  const productId = c.req.param('productId');

  try {
    const images = await getPreviewImages(productId);

    return c.json({
      success: true,
      data: {
        productId,
        totalPages: images.length,
        images,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: '미리보기 조회 실패' }, 500);
  }
});

// 목차 분석 (Vision AI 사용)
books.post('/:productId/analyze', async (c) => {
  const productId = c.req.param('productId');
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return c.json({ success: false, error: 'API 키가 설정되지 않았습니다' }, 500);
  }

  try {
    const toc = await scrapeBookData(productId, apiKey);

    if (!toc) {
      return c.json({ success: false, error: '목차 분석 실패' }, 500);
    }

    return c.json({ success: true, data: toc });
  } catch (error) {
    console.error('목차 분석 오류:', error);
    return c.json({ success: false, error: '목차 분석 중 오류가 발생했습니다' }, 500);
  }
});

export default books;
