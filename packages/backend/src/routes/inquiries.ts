/**
 * Inquiry Routes
 * 1:1 문의 API
 *
 * SQLite (Bun) 및 Supabase (Node.js) 환경 모두 지원
 */

import { Hono } from 'hono';
import {
  getAllInquiries,
  getInquiry,
  getUserInquiries,
  createInquiry,
  updateInquiryStatus,
  deleteInquiry,
  getAllInquiriesAsync,
  getInquiryAsync,
  getUserInquiriesAsync,
  createInquiryAsync,
  updateInquiryStatusAsync,
  deleteInquiryAsync,
  useSupabase,
} from '../db/index.js';

// 간단한 ID 생성 함수
function generateId(): string {
  return `inq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const inquiryRoutes = new Hono();

// 모든 문의 조회 (관리자용)
inquiryRoutes.get('/', async (c) => {
  try {
    const inquiries = useSupabase
      ? await getAllInquiriesAsync()
      : getAllInquiries();
    return c.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('[Inquiries] Get all error:', error);
    return c.json({ success: false, error: '문의 목록 조회 실패' }, 500);
  }
});

// 사용자별 문의 조회 (본인 문의 목록)
inquiryRoutes.get('/user/:email', async (c) => {
  try {
    const email = decodeURIComponent(c.req.param('email'));

    if (!email) {
      return c.json({ success: false, error: '이메일이 필요합니다' }, 400);
    }

    // 이메일로 문의 조회 (userId가 없을 수 있으므로 이메일로 조회)
    const allInquiries = useSupabase
      ? await getAllInquiriesAsync()
      : getAllInquiries();

    // 이메일로 필터링
    const userInquiries = allInquiries.filter(
      (inq: { userEmail: string }) => inq.userEmail === email
    );

    console.log(`[Inquiries] User inquiries for ${email}: ${userInquiries.length}`);
    return c.json({ success: true, data: userInquiries });
  } catch (error) {
    console.error('[Inquiries] Get user inquiries error:', error);
    return c.json({ success: false, error: '문의 목록 조회 실패' }, 500);
  }
});

// 특정 문의 조회
inquiryRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const inquiry = useSupabase
      ? await getInquiryAsync(id)
      : getInquiry(id);

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

    const inquiryData = {
      id: generateId(),
      userId: userId || null,
      userEmail,
      userName,
      category,
      title,
      content,
      status: 'pending',
    };

    const inquiry = useSupabase
      ? await createInquiryAsync(inquiryData)
      : createInquiry(inquiryData);

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

    const inquiry = useSupabase
      ? await updateInquiryStatusAsync(id, status, adminNote)
      : updateInquiryStatus(id, status, adminNote);

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

    const inquiry = useSupabase
      ? await getInquiryAsync(id)
      : getInquiry(id);

    if (!inquiry) {
      return c.json({ success: false, error: '문의를 찾을 수 없습니다' }, 404);
    }

    if (useSupabase) {
      await deleteInquiryAsync(id);
    } else {
      deleteInquiry(id);
    }

    console.log(`[Inquiries] Deleted: ${id}`);

    return c.json({ success: true, message: '문의가 삭제되었습니다' });
  } catch (error) {
    console.error('[Inquiries] Delete error:', error);
    return c.json({ success: false, error: '문의 삭제 실패' }, 500);
  }
});
