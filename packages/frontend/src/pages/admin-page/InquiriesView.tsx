/**
 * InquiriesView
 * 관리자 문의 관리 화면
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  User,
  Mail,
  Tag,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import type { Inquiry } from './types';

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
const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '대기 중', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  in_progress: { label: '처리 중', color: 'text-blue-600 bg-blue-50', icon: AlertCircle },
  resolved: { label: '해결됨', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  closed: { label: '종료', color: 'text-gray-600 bg-gray-50', icon: XCircle },
};

export function InquiriesView() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 문의 목록 조회
  const fetchInquiries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inquiries`);
      const result = await response.json();
      if (result.success) {
        setInquiries(result.data);
      } else {
        setError(result.error || '문의 목록 조회 실패');
      }
    } catch (err) {
      console.error('[InquiriesView] Fetch error:', err);
      setError('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  // 상태 업데이트
  const updateStatus = async (id: string, status: string, adminNote?: string) => {
    setUpdatingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inquiries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote }),
      });
      const result = await response.json();
      if (result.success) {
        setInquiries(prev =>
          prev.map(inq => (inq.id === id ? result.data : inq))
        );
      } else {
        alert(result.error || '상태 업데이트 실패');
      }
    } catch (err) {
      console.error('[InquiriesView] Update error:', err);
      alert('상태 업데이트 실패');
    } finally {
      setUpdatingId(null);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchInquiries();
  }, []);

  // 대기중 문의 수
  const pendingCount = inquiries.filter(i => i.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchInquiries}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <MessageSquare size={20} className="text-green-500" />
          문의 관리
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {pendingCount} 대기
            </span>
          )}
        </h2>
        <button
          onClick={fetchInquiries}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 문의 목록 */}
      {inquiries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
          <p>접수된 문의가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              expanded={expandedId === inquiry.id}
              onToggle={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
              onUpdateStatus={updateStatus}
              updating={updatingId === inquiry.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 문의 카드 컴포넌트
function InquiryCard({
  inquiry,
  expanded,
  onToggle,
  onUpdateStatus,
  updating,
}: {
  inquiry: Inquiry;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: string, adminNote?: string) => void;
  updating: boolean;
}) {
  const [adminNote, setAdminNote] = useState(inquiry.adminNote || '');
  const category = CATEGORY_LABELS[inquiry.category] || CATEGORY_LABELS.other;
  const status = STATUS_LABELS[inquiry.status] || STATUS_LABELS.pending;
  const StatusIcon = status.icon;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
      {/* 헤더 (클릭 가능) */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* 상태 아이콘 */}
        <div className={`p-1.5 rounded ${status.color}`}>
          <StatusIcon size={16} />
        </div>

        {/* 카테고리 */}
        <span className="text-lg">{category.emoji}</span>

        {/* 제목 및 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 truncate">{inquiry.title}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{inquiry.userName}</span>
            <span>•</span>
            <span>{formatDate(inquiry.createdAt)}</span>
          </div>
        </div>

        {/* 확장 아이콘 */}
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* 상세 내용 */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          {/* 사용자 정보 */}
          <div className="py-3 flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <User size={14} />
              <span>{inquiry.userName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail size={14} />
              <span>{inquiry.userEmail}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tag size={14} />
              <span>{category.label}</span>
            </div>
          </div>

          {/* 문의 내용 */}
          <div className="bg-white p-3 rounded border mb-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{inquiry.content}</p>
          </div>

          {/* 답변 작성 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
              <MessageSquare size={12} />
              답변 작성 (사용자에게 표시됨)
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="사용자에게 보여질 답변을 작성하세요"
              rows={3}
              className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:border-green-500 resize-none bg-green-50"
            />
            {inquiry.adminNote && adminNote !== inquiry.adminNote && (
              <p className="text-xs text-orange-600 mt-1">* 답변이 수정되었습니다</p>
            )}
          </div>

          {/* 상태 변경 버튼 */}
          <div className="flex flex-wrap gap-2">
            {/* 답변 저장 버튼 (답변 내용이 있을 때) */}
            {adminNote && adminNote.trim() && (
              <button
                onClick={() => onUpdateStatus(inquiry.id, 'resolved', adminNote)}
                disabled={updating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                답변 저장 및 완료
              </button>
            )}

            {inquiry.status === 'pending' && (
              <button
                onClick={() => onUpdateStatus(inquiry.id, 'in_progress', adminNote)}
                disabled={updating}
                className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                처리 중으로 변경
              </button>
            )}

            {inquiry.status !== 'closed' && inquiry.status !== 'resolved' && (
              <button
                onClick={() => onUpdateStatus(inquiry.id, 'closed', adminNote)}
                disabled={updating}
                className="px-3 py-1.5 bg-gray-500 text-white rounded text-sm font-medium hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                답변 없이 종료
              </button>
            )}

            {(inquiry.status === 'resolved' || inquiry.status === 'closed') && (
              <button
                onClick={() => onUpdateStatus(inquiry.id, 'pending', adminNote)}
                disabled={updating}
                className="px-3 py-1.5 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1"
              >
                {updating ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                다시 열기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
