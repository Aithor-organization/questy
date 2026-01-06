/**
 * LoginPage
 * 로그인 페이지 - 노트북 스타일
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await login(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen notebook-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 노트북 페이지 스타일 카드 */}
        <div className="notebook-page relative">
          {/* 스프링 홀 */}
          <div className="notebook-holes hidden sm:flex">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="notebook-hole" />
            ))}
          </div>

          <div className="p-8 pl-8 sm:pl-20">
            {/* 로고 영역 */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-2">📓</div>
              <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">
                QuestyBook
              </h1>
              <p className="text-[var(--pencil-gray)] text-sm mt-1">
                AI 학습 코치와 함께하는 스마트 학습
              </p>
            </div>

            {/* 구분선 */}
            <div className="border-b-2 border-dashed border-[var(--paper-lines)] mb-6" />

            {/* 로그인 폼 */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  ✉️ 이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-black)] mb-1.5">
                  🔒 비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 border-2 border-[var(--paper-lines)] rounded-lg bg-[var(--paper-cream)] focus:border-[var(--ink-blue)] focus:outline-none transition-colors"
                  required
                />
              </div>

              {error && (
                <div className="bg-[var(--highlight-pink)] border border-[var(--ink-red)] rounded-lg p-3 text-[var(--ink-red)] text-sm">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  isLoading
                    ? 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                    : 'bg-[var(--ink-blue)] text-white hover:opacity-90 active:scale-[0.98]'
                }`}
              >
                {isLoading ? '로그인 중...' : '📝 로그인'}
              </button>
            </form>

            {/* 구분선 */}
            <div className="border-b-2 border-dashed border-[var(--paper-lines)] my-6" />

            {/* 회원가입 링크 */}
            <div className="text-center">
              <span className="text-[var(--pencil-gray)] text-sm">
                아직 계정이 없으신가요?
              </span>
              <Link
                to="/signup"
                className="ml-2 text-[var(--ink-blue)] font-medium hover:underline"
              >
                회원가입 →
              </Link>
            </div>
          </div>
        </div>

        {/* 와시 테이프 장식 */}
        <div className="flex justify-center mt-4">
          <div className="washi-tape w-32 h-4 rounded-sm" />
        </div>

        {/* 하단 메시지 */}
        <p className="text-center text-[var(--pencil-gray)] text-xs mt-6 handwrite">
          💡 매일 조금씩, 꾸준히 성장해요!
        </p>
      </div>
    </div>
  );
}
