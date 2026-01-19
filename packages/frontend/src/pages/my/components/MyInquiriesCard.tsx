/**
 * MyInquiriesCard
 * 내 문의 목록 카드 - 사용자가 자신의 문의와 관리자 답변을 볼 수 있음
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';

// 문의 타입
interface Inquiry {
  id: string;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 카테고리 라벨
const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  general: { label: '일반 문의', emoji: '💬' },
  bug: { label: '버그 신고', emoji: '🐛' },
  suggestion: { label: '기능 제안', emoji: '💡' },
  account: { label: '계정 문의', emoji: '👤' },
  payment: { label: '결제 문의', emoji: '💳' },
  other: { label: '기타', emoji: '📋' },
};

// 상태 라벨
const STATUS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '답변 대기', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  in_progress: { label: '처리 중', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  resolved: { label: '답변 완료', color: 'text-green-700', bgColor: 'bg-green-100' },
  closed: { label: '종료', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

interface MyInquiriesCardProps {
  userEmail: string | undefined;
}

export function MyInquiriesCard({ userEmail }: MyInquiriesCardProps) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 문의 목록 조회
  const fetchInquiries = async () => {
    if (!userEmail) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inquiries/user/${encodeURIComponent(userEmail)}`
      );
      const result = await response.json();

      if (result.success) {
        setInquiries(result.data);
      } else {
        setError(result.error || '문의 목록을 불러올 수 없습니다');
      }
    } catch (err) {
      console.error('[MyInquiries] Fetch error:', err);
      setError('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  // 목록 열 때 조회
  useEffect(() => {
    if (showList && userEmail) {
      fetchInquiries();
    }
  }, [showList, userEmail]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 답변 있는 문의 수
  const answeredCount = inquiries.filter(
    (i) => i.status === 'resolved' || i.status === 'closed'
  ).length;

  return (
    <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
      <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" /> 내 문의 내역
      </h2>

      {/* 문의 보기 토글 버튼 */}
      <button
        onClick={() => setShowList(!showList)}
        className="w-full py-3 px-4 bg-[var(--paper-cream)] hover:opacity-80 text-[var(--ink-black)] rounded-lg border border-[var(--paper-lines)] transition-colors flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          내 문의 보기
          {inquiries.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              {inquiries.length}건
            </span>
          )}
        </span>
        {showList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* 문의 목록 */}
      {showList && (
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-6 text-red-500 text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
              <button
                onClick={fetchInquiries}
                className="mt-2 text-blue-500 underline text-xs"
              >
                다시 시도
              </button>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-6 text-[var(--pencil-gray)]">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">아직 문의 내역이 없어요</p>
            </div>
          ) : (
            <>
              {/* 요약 */}
              <div className="text-xs text-[var(--pencil-gray)] mb-2">
                총 {inquiries.length}건 중 {answeredCount}건 답변 완료
              </div>

              {/* 문의 카드들 */}
              {inquiries.map((inquiry) => (
                <InquiryItem
                  key={inquiry.id}
                  inquiry={inquiry}
                  expanded={expandedId === inquiry.id}
                  onToggle={() =>
                    setExpandedId(expandedId === inquiry.id ? null : inquiry.id)
                  }
                  formatDate={formatDate}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 개별 문의 아이템
function InquiryItem({
  inquiry,
  expanded,
  onToggle,
  formatDate,
}: {
  inquiry: Inquiry;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (date: string) => string;
}) {
  const category = CATEGORY_LABELS[inquiry.category] || CATEGORY_LABELS.other;
  const status = STATUS_LABELS[inquiry.status] || STATUS_LABELS.pending;

  return (
    <div className="bg-white rounded-lg border border-[var(--paper-lines)] overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-lg">{category.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--ink-black)] truncate text-sm">
              {inquiry.title}
            </span>
            <span
              className={`px-2 py-0.5 text-xs rounded ${status.bgColor} ${status.color}`}
            >
              {status.label}
            </span>
          </div>
          <div className="text-xs text-[var(--pencil-gray)] mt-0.5">
            {formatDate(inquiry.createdAt)}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* 상세 내용 */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-gray-50/50">
          {/* 내 문의 내용 */}
          <div className="py-3">
            <div className="text-xs font-medium text-[var(--pencil-gray)] mb-1">
              내 문의
            </div>
            <div className="bg-white p-3 rounded border text-sm text-[var(--ink-black)] whitespace-pre-wrap">
              {inquiry.content}
            </div>
          </div>

          {/* 관리자 답변 */}
          {inquiry.adminNote ? (
            <div className="py-3 border-t">
              <div className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                관리자 답변
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200 text-sm text-[var(--ink-black)] whitespace-pre-wrap">
                {inquiry.adminNote}
              </div>
              {inquiry.resolvedAt && (
                <div className="text-xs text-[var(--pencil-gray)] mt-1">
                  답변일: {formatDate(inquiry.resolvedAt)}
                </div>
              )}
            </div>
          ) : (
            <div className="py-3 border-t">
              <div className="text-xs text-[var(--pencil-gray)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                아직 답변이 등록되지 않았습니다
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
