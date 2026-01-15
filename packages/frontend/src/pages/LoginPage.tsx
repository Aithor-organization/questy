/**
 * LoginPage
 * 로그인 페이지 - 노트북 스타일
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

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
                  ✉️ 이메일 또는 아이디
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com 또는 admin"
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

            {/* 소셜 로그인 */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--paper-lines)]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-[var(--pencil-gray)]">
                    또는
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading}
                className="mt-4 w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-[var(--paper-lines)] rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-[var(--ink-black)] font-medium">
                  Google로 계속하기
                </span>
              </button>
            </div>

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
