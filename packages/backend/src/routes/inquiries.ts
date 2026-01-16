/**
 * Inquiry Routes
 * 1:1 문의 API
 */

import { Hono } from 'hono';
import {
  getAllInquiries,
  getInquiry,
  createInquiry,
  updateInquiryStatus,
  deleteInquiry,
} from '../db/index.js';

// 간단한 ID 생성 함수
function generateId(): string {
  return `inq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const inquiryRoutes = new Hono();

// 모든 문의 조회 (관리자용)
inquiryRoutes.get('/', async (c) => {
  try {
    const inquiries = getAllInquiries();
    return c.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('[Inquiries] Get all error:', error);
    return c.json({ success: false, error: '문의 목록 조회 실패' }, 500);
  }
});

// 특정 문의 조회
inquiryRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const inquiry = getInquiry(id);

    if (!inquiry) {
      return c.json({ success: false, error: '문의를 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[Inquiries] Get by id error:', error);
    return c.json({ success: false, error: '문의 조회 실패' }, 500);
  }
});

// 문의 생성
inquiryRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, userEmail, userName, category, title, content } = body;

    // 유효성 검사
    if (!userEmail || !userName || !category || !title || !content) {
      return c.json({ success: false, error: '필수 필드가 누락되었습니다' }, 400);
    }

    if (title.length < 5) {
      return c.json({ success: false, error: '제목은 최소 5자 이상이어야 합니다' }, 400);
    }

    if (content.length < 10) {
      return c.json({ success: false, error: '내용은 최소 10자 이상이어야 합니다' }, 400);
    }

    const inquiry = createInquiry({
      id: generateId(),
      userId: userId || null,
      userEmail,
      userName,
      category,
      title,
      content,
      status: 'pending',
    });

    console.log(`[Inquiries] New inquiry created: ${inquiry.id} from ${userEmail}`);

    return c.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[Inquiries] Create error:', error);
    return c.json({ success: false, error: '문의 등록 실패' }, 500);
  }
});

// 문의 상태 업데이트 (관리자용)
inquiryRoutes.patch('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status, adminNote } = body;

    // 유효한 상태 확인
    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: '유효하지 않은 상태입니다' }, 400);
    }

    const inquiry = updateInquiryStatus(id, status, adminNote);

    if (!inquiry) {
      return c.json({ success: false, error: '문의를 찾을 수 없습니다' }, 404);
    }

    console.log(`[Inquiries] Status updated: ${id} -> ${status}`);

    return c.json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[Inquiries] Update status error:', error);
    return c.json({ success: false, error: '상태 업데이트 실패' }, 500);
  }
});

// 문의 삭제 (관리자용)
inquiryRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const inquiry = getInquiry(id);
    if (!inquiry) {
      return c.json({ success: false, error: '문의를 찾을 수 없습니다' }, 404);
    }

    deleteInquiry(id);

    console.log(`[Inquiries] Deleted: ${id}`);

    return c.json({ success: true, message: '문의가 삭제되었습니다' });
  } catch (error) {
    console.error('[Inquiries] Delete error:', error);
    return c.json({ success: false, error: '문의 삭제 실패' }, 500);
  }
});
