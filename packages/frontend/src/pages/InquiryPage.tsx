/**
 * InquiryPage
 * 1:1 문의 페이지 - 사용자가 문의를 작성하고 제출
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { NotebookLayout, NotebookPage } from '../components/notebook';
import { API_BASE_URL } from '../config';

// 문의 카테고리
const INQUIRY_CATEGORIES = [
  { value: 'general', label: '일반 문의', emoji: '💬' },
  { value: 'bug', label: '버그 신고', emoji: '🐛' },
  { value: 'suggestion', label: '기능 제안', emoji: '💡' },
  { value: 'account', label: '계정 문의', emoji: '👤' },
  { value: 'payment', label: '결제 문의', emoji: '💳' },
  { value: 'other', label: '기타', emoji: '📋' },
];

export function InquiryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 유효성 검사
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    if (title.trim().length < 5) {
      setError('제목은 최소 5자 이상 입력해주세요');
      return;
    }
    if (!content.trim()) {
      setError('내용을 입력해주세요');
      return;
    }
    if (content.trim().length < 10) {
      setError('내용은 최소 10자 이상 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'guest',
          userEmail: user?.email || 'anonymous@guest.com',
          userName: user?.name || '익명',
          category,
          title: title.trim(),
          content: content.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowSuccess(true);
        // 3초 후 마이페이지로 이동
        setTimeout(() => {
          navigate('/my');
        }, 3000);
      } else {
        setError(result.error || '문의 등록에 실패했어요. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error('[InquiryPage] Submit error:', err);
      setError('네트워크 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 성공 화면
  if (showSuccess) {
    return (
      <NotebookLayout>
        <NotebookPage>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="handwrite handwrite-xl text-[var(--ink-black)] mb-4">
              문의가 접수되었어요!
            </h1>
            <p className="handwrite text-[var(--pencil-gray)] mb-2">
              빠른 시일 내에 답변 드릴게요.
            </p>
            <p className="text-sm text-[var(--pencil-gray)]">
              잠시 후 마이페이지로 이동합니다...
            </p>
          </div>
        </NotebookPage>
      </NotebookLayout>
    );
  }

  return (
    <NotebookLayout>
      <NotebookPage>
        {/* 헤더 */}
        <div className="text-center mb-6">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 top-4 p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <span className="text-2xl">←</span>
          </button>
          <div className="text-5xl mb-3">📝</div>
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
            1:1 문의하기
          </h1>
          <p className="text-sm text-[var(--pencil-gray)] mt-2">
            궁금한 점이나 건의사항을 남겨주세요
          </p>
        </div>

        {/* 문의 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 카테고리 선택 */}
          <div>
            <label className="block handwrite text-[var(--ink-black)] mb-2">
              📋 문의 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INQUIRY_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`py-2 px-3 rounded-lg border transition-all text-sm flex items-center justify-center gap-1 ${
                    category === cat.value
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-white/50 border-[var(--paper-lines)] text-[var(--pencil-gray)] hover:bg-white'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span className="handwrite">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 제목 입력 */}
          <div>
            <label className="block handwrite text-[var(--ink-black)] mb-2">
              ✏️ 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문의 제목을 입력하세요"
              maxLength={100}
              className="w-full px-4 py-3 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite bg-white/70"
            />
            <p className="text-xs text-[var(--pencil-gray)] mt-1 text-right">
              {title.length}/100
            </p>
          </div>

          {/* 내용 입력 */}
          <div>
            <label className="block handwrite text-[var(--ink-black)] mb-2">
              📄 내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문의 내용을 자세히 적어주세요"
              maxLength={2000}
              rows={8}
              className="w-full px-4 py-3 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite bg-white/70 resize-none"
            />
            <p className="text-xs text-[var(--pencil-gray)] mt-1 text-right">
              {content.length}/2000
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors handwrite text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                제출 중...
              </>
            ) : (
              <>
                <span>📨</span>
                문의 제출하기
              </>
            )}
          </button>
        </form>

        {/* 안내 메모 */}
        <div className="postit mt-6">
          <p className="handwrite text-lg mb-2">💡 문의 안내</p>
          <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
            <li>• 문의 내용은 영업일 기준 1-2일 내 답변드려요</li>
            <li>• 버그 신고 시 발생 상황을 자세히 적어주시면 도움이 됩니다</li>
            <li>• 계정 관련 문의는 가입 이메일을 꼭 적어주세요</li>
          </ul>
        </div>
      </NotebookPage>
    </NotebookLayout>
  );
}
